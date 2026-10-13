import { prisma } from "../_lib/prisma-client.mjs";
import { mongoCollection } from "../_lib/mongo-client.mjs";
import { completeChatWithFallback } from "./ai-providers.mjs";
import { timed } from "../_lib/timing.mjs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const DEFAULT_COUNTER_SEEDS = {
  employee: 1000,
  project: 5000,
  projectEmployee: 7000,
};


/** Client errors the handler returns with `status` and message instead of a 500. */
export function clientError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

/** Record ids are positive integers (Prisma `Int`); anything else is rejected before a query. */
export function isRecordId(value) {
  return Number.isInteger(value) && value > 0;
}

const READINESS_DEFINITIONS = [
  {
    id: "scopeDefined",
    title: "Scope Confirmed",
    description: "Requirements baseline captured and shared with stakeholders.",
    category: "Scope",
    weight: 25,
  },
  {
    id: "budgetApproved",
    title: "Budget Approved",
    description: "Finance sign-off received for the projected spend.",
    category: "Budget",
    weight: 20,
  },
  {
    id: "legalReviewed",
    title: "Contracts Reviewed",
    description: "Master services agreement and NDAs cleared with legal.",
    category: "Legal",
    weight: 20,
  },
  {
    id: "assetsPrepared",
    title: "Assets Prepared",
    description: "Brand assets, data rooms, and collateral ready to share.",
    category: "Assets",
    weight: 15,
  },
  {
    id: "kickoffScheduled",
    title: "Kickoff Scheduled",
    description: "Kickoff meeting on calendar with internal and client teams.",
    category: "Timeline",
    weight: 20,
  },
];

const READINESS_TOTAL_WEIGHT = READINESS_DEFINITIONS.reduce(
  (total, item) => total + item.weight,
  0
);

const READINESS_STATUS_VALUES = {
  not_started: 0,
  in_progress: 0.5,
  blocked: 0,
  done: 1,
};

const RESOURCE_CAPACITY_PCT = 100;
const RESOURCE_STATUS_AVAILABLE = "available";
const RESOURCE_STATUS_LIMITED = "limited";
const RESOURCE_STATUS_OVERBOOKED = "overbooked";

const CONTENTFUL_SPACE_ID = process.env.CMS_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.CMS_ENVIRONMENT || "master";
const CONTENTFUL_DELIVERY_TOKEN = process.env.CMS_DELIVERY_TOKEN;
const CONTENTFUL_PREVIEW_TOKEN = process.env.CMS_PREVIEW_TOKEN;

const APPROVAL_STATUSES = new Set([
  "draft",
  "in_review",
  "approved",
  "rejected",
]);

/** Delivery status of an approved project, kept in `status`; `approvalStatus` keeps the approval workflow. */
const DELIVERY_LABELS = {
  in_flight: "In Flight",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
const DELIVERY_STATUSES = new Set(Object.keys(DELIVERY_LABELS));
const CLOSED_STATUSES = new Set(["completed", "done", "cancelled", "canceled"]);

/** Completed and cancelled projects are closed: no capacity, no team changes. */
function isProjectClosed(project) {
  return CLOSED_STATUSES.has(String(project?.status ?? "").trim().toLowerCase());
}

/** A delivery status only applies once approved; otherwise status mirrors the approval step. */
function initialProjectStatus(approvalStatus, requested) {
  if (approvalStatus !== "approved") {
    return approvalStatus;
  }
  const status = String(requested ?? "").trim().toLowerCase();
  return DELIVERY_STATUSES.has(status) ? status : "in_flight";
}

const APPROVAL_LABELS = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
};

function toDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (ISO_DATE_PATTERN.test(trimmed)) {
      return new Date(trimmed);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

function formatDate(value) {
  if (!value) {
    return value;
  }
  const date = value instanceof Date ? value : toDate(value);
  if (!date) {
    return value;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextSequenceValue(key, startAt) {
  return timed(`counter:${key}`, () => incrementCounter(key, startAt));
}

/**
 * Atomic single-round-trip increment via the native driver. Prisma's
 * `counter.upsert` cannot read back the legacy counter documents
 * ("required to return data, but found no record(s)"), so it is not used here.
 */
async function incrementCounter(key, startAt) {
  const seed = startAt ?? DEFAULT_COUNTER_SEEDS[key] ?? 1;
  const counters = await mongoCollection("Counter");
  const now = new Date();
  const counter = await counters.findOneAndUpdate(
    { key },
    [
      {
        $set: {
          key,
          value: { $add: [{ $ifNull: ["$value", seed - 1] }, 1] },
          createdAt: { $ifNull: ["$createdAt", now] },
          updatedAt: now,
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );
  const value = Number(counter?.value);
  if (!Number.isFinite(value)) {
    throw new Error(`Failed to increment counter for key ${key}`);
  }
  return value;
}

/**
 * Helper function to perform MongoDB update with native driver fallback
 * This is needed because Prisma's update() can return null with MongoDB
 * @param {string} prismaModelName - Prisma model name (camelCase, e.g., "employee", "project", "projectEmployee")
 * @param {string} whereField - Field name to match (e.g., "employeeId", "projectId", "empProjectId")
 * @param {any} whereValue - Value to match
 * @param {object} updateData - Data to update
 * @param {function} fetchAfterUpdate - Function to fetch the updated record using Prisma
 */
async function updateWithMongoFallback(prismaModelName, whereField, whereValue, updateData, fetchAfterUpdate) {
  // Convert Prisma model name to MongoDB collection name (PascalCase)
  const collectionNameMap = {
    employee: "Employee",
    project: "Project",
    projectEmployee: "ProjectEmployee",
  };
  const mongoCollectionName = collectionNameMap[prismaModelName] || prismaModelName;
  
  // Try Prisma update first
  let updateSucceeded = false;
  let record = null;
  
  try {
    const updateResult = await prisma[prismaModelName].update({
      where: { [whereField]: whereValue },
      data: updateData,
    });
    if (updateResult) {
      record = updateResult;
      updateSucceeded = true;
    }
  } catch (updateError) {
    if (updateError.code === 'P2025') {
      throw Object.assign(new Error(`Record not found with ${whereField} ${whereValue}`), {
        code: "P2025",
      });
    }
  }
  
  // If Prisma update failed or returned null, use MongoDB native driver
  if (!updateSucceeded) {
    const collection = await mongoCollection(mongoCollectionName);
    const updateResult = await collection.updateOne(
      { [whereField]: whereValue },
      { $set: updateData }
    );
    if (updateResult.matchedCount === 0) {
      throw new Error(`No record found with ${whereField} ${whereValue}`);
    }
    record = await fetchAfterUpdate();
    if (!record) {
      throw new Error(`Record not found after MongoDB native update for ${whereField} ${whereValue}`);
    }
  }

  return record;
}

/**
 * Deletes one project or employee and every assignment pointing at it via the
 * native driver. Prisma's MongoDB `deleteMany` resolves rows by `_id` first and
 * silently skips documents whose `_id` is not an ObjectId, which left orphaned
 * assignments behind. A second sweep catches assignments created while the
 * delete was running; any survivor is an error, never a silent orphan.
 */
async function deleteWithAssignments({ collection, keyField, assignmentField, id }) {
  const [parents, assignments] = await Promise.all([
    mongoCollection(collection),
    mongoCollection("ProjectEmployee"),
  ]);
  const filter = { [assignmentField]: id };
  const first = await assignments.deleteMany(filter);
  const { deletedCount } = await parents.deleteOne({ [keyField]: id });
  if (deletedCount === 0) {
    throw Object.assign(new Error(`${collection} ${id} not found`), { code: "P2025" });
  }
  const sweep = await assignments.deleteMany(filter);
  const remaining = await assignments.countDocuments(filter);
  if (remaining > 0) {
    throw new Error(`${remaining} assignment(s) still reference ${keyField} ${id} after delete`);
  }
  return first.deletedCount + sweep.deletedCount;
}

function contentfulBaseUrl(preview = false) {
  if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_ENVIRONMENT) {
    throw new Error("Contentful credentials are not configured.");
  }
  const host = preview ? "preview.contentful.com" : "cdn.contentful.com";
  return `https://${host}/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;
}

async function fetchContentful(path, { preview = false, query = {} } = {}) {
  const baseUrl = contentfulBaseUrl(preview);
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  const token = preview ? CONTENTFUL_PREVIEW_TOKEN : CONTENTFUL_DELIVERY_TOKEN;
  if (!token) {
    throw new Error("Contentful access token missing.");
  }
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) {
      throw clientError(404, "Contentful entry not found.");
    }
    if (response.status === 400 || response.status === 422) {
      throw clientError(400, "Contentful rejected the query. Check the content type and slug.");
    }
    throw new Error(`Contentful request failed (${response.status}): ${text}`);
  }
  return response.json();
}

function sanitizeArray(values) {
  if (!values) {
    return [];
  }
  if (Array.isArray(values)) {
    return values
      .map((value) =>
        typeof value === "string" ? value.trim() : value?.toString()?.trim()
      )
      .filter((value) => value && value.length > 0);
  }
  if (typeof values === "string") {
    return values
      .split(/[\r\n]+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  return [];
}

function richTextToPlainText(node) {
  if (!node) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (Array.isArray(node)) {
    return node
      .map((child) => richTextToPlainText(child))
      .filter((value) => value && value.length > 0)
      .join("\n");
  }
  if (typeof node === "object") {
    if (typeof node.value === "string") {
      return node.value;
    }
    if (Array.isArray(node.content)) {
      return node.content
        .map((child) => richTextToPlainText(child))
        .join(node.nodeType === "paragraph" ? "\n" : "");
    }
  }
  return "";
}

function coerceFieldToString(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return richTextToPlainText(value).trim();
}

function buildOverviewFromContentful(entry) {
  if (!entry || typeof entry !== "object") {
    return {};
  }
  const fields = entry.fields ?? {};
  const summary = coerceFieldToString(
    fields.summary ?? fields.description ?? fields.body ?? fields.overview
  );
  const objectives =
    fields.objectives ??
    fields.goals ??
    fields.objectivesList ??
    fields.highlights ??
    [];
  const successCriteria =
    fields.successCriteria ??
    fields.successMetrics ??
    fields.kpis ??
    fields.deliverables ??
    [];
  const stakeholderNotes = coerceFieldToString(
    fields.stakeholderNotes ??
      fields.notes ??
      fields.comments ??
      fields.additionalInfo ??
      ""
  );

  return {
    summary,
    objectives: sanitizeArray(objectives),
    successCriteria: sanitizeArray(successCriteria),
    stakeholderNotes,
  };
}

function buildContentfulBrief(entry) {
  const overview = buildOverviewFromContentful(entry);
  if (overview) {
    overview.aiDraftSource = "contentful";
    overview.cmsEntryId = entry?.sys?.id ?? null;
    overview.cmsEntryTitle =
      entry?.fields?.title ?? entry?.fields?.name ?? null;
  }
  return {
    entryId: entry?.sys?.id ?? null,
    title: entry?.fields?.title ?? entry?.fields?.name ?? null,
    overview,
    raw: entry,
  };
}

function parseOverviewJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty AI response.");
  }
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(candidate);
  const overview = {
    summary: parsed.summary ?? parsed.brief ?? "",
    objectives: sanitizeArray(parsed.objectives ?? parsed.goals),
    successCriteria: sanitizeArray(
      parsed.successCriteria ?? parsed.successMetrics ?? parsed.kpis
    ),
    stakeholderNotes:
      typeof parsed.stakeholderNotes === "string"
        ? parsed.stakeholderNotes
        : parsed.notes ?? "",
  };
  return overview;
}

function buildOverviewPrompt(payload) {
  const context = {
    project: {
      projectId: payload?.project?.projectId ?? null,
      projectName: payload?.project?.projectName ?? "",
      clientName: payload?.project?.clientName ?? "",
      startDate: payload?.project?.startDate ?? "",
      contactPerson: payload?.project?.contactPerson ?? "",
      overview: payload?.project?.overview ?? {},
    },
    readiness: payload?.readiness ?? {},
    assignments: (payload?.assignments ?? []).map((assignment) => ({
      employeeName:
        assignment?.employeeName ?? assignment?.employee?.employeeName ?? "",
      role: assignment?.role ?? assignment?.employee?.role ?? "",
      allocationPct:
        assignment?.allocationPct ??
        assignment?.employee?.allocationPct ??
        null,
      status: assignment?.allocationStatus ?? null,
    })),
  };
  return `
Use the project data to draft an updated overview.
Return ONLY a JSON object with keys: summary (string, max 140 words),
objectives (array of 3 short bullet strings),
successCriteria (array of 3 short bullet strings),
stakeholderNotes (string, optional).
Avoid markdown or code fences.
Project data:
${JSON.stringify(context, null, 2)}
`.trim();
}

function normalizeAllocationPct(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

function buildAssignmentSummary(assignments, projectLookup) {
  const summary = new Map();
  assignments.forEach((assignment) => {
    const empId = assignment.empId;
    if (!summary.has(empId)) {
      summary.set(empId, {
        allocatedPct: 0,
        assignments: [],
      });
    }
    const entry = summary.get(empId);
    const allocation = normalizeAllocationPct(assignment.allocationPct ?? 0);
    entry.allocatedPct += allocation;
    entry.assignments.push({
      projectId: assignment.projectId,
      projectName:
        projectLookup.get(assignment.projectId)?.projectName ?? undefined,
      allocationPct: allocation || null,
      role: assignment.role ?? "",
      assignedDate: assignment.assignedDate
        ? assignment.assignedDate.toISOString()
        : undefined,
      isActive: assignment.isActive ?? true,
    });
  });
  return summary;
}

function deriveLoadStatus(allocatedPct) {
  if (allocatedPct >= 110) {
    return RESOURCE_STATUS_OVERBOOKED;
  }
  if (allocatedPct >= 80) {
    return RESOURCE_STATUS_LIMITED;
  }
  return RESOURCE_STATUS_AVAILABLE;
}

function buildResourceProfile({
  employee,
  summary,
  projectLookup,
  currentProjectId,
}) {
  const aggregate = summary ?? {
    allocatedPct: 0,
    assignments: [],
  };

  const allocatedPct = Math.max(
    0,
    Math.round(aggregate.allocatedPct * 10) / 10
  );
  const availablePct = Math.max(
    0,
    Math.round((RESOURCE_CAPACITY_PCT - aggregate.allocatedPct) * 10) / 10
  );

  const activeAssignments = aggregate.assignments.map((assignment) => ({
    projectId: assignment.projectId,
    projectName:
      assignment.projectName ??
      projectLookup.get(assignment.projectId)?.projectName ??
      undefined,
    allocationPct: assignment.allocationPct,
    role: assignment.role,
    isCurrentProject: assignment.projectId === currentProjectId,
    assignedDate: assignment.assignedDate,
    isActive: assignment.isActive !== false,
  }));

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    role: employee.role ?? undefined,
    title: employee.title ?? undefined,
    department: employee.department ?? undefined,
    location: employee.location ?? undefined,
    timezone: employee.timezone ?? undefined,
    employmentType: employee.employmentType ?? undefined,
    skills: Array.isArray(employee.skills) ? employee.skills : [],
    tags: Array.isArray(employee.tags) ? employee.tags : [],
    certifications: Array.isArray(employee.certifications)
      ? employee.certifications
      : [],
    allocation: {
      capacityPct: RESOURCE_CAPACITY_PCT,
      allocatedPct,
      availablePct,
      status: deriveLoadStatus(allocatedPct),
      activeAssignments: activeAssignments.length,
    },
    activeAssignments,
    lastActiveAt: employee.lastActiveAt
      ? employee.lastActiveAt.toISOString()
      : undefined,
    isActive: employee.isActive !== false,
  };
}

function leadCandidateScore(profile, preferredDepartment) {
  let score = 0;
  const role = (profile.role ?? "").toLowerCase();
  const title = (profile.title ?? "").toLowerCase();
  if (
    role.includes("lead") ||
    role.includes("manager") ||
    role.includes("head")
  ) {
    score += 30;
  }
  if (
    title.includes("lead") ||
    title.includes("manager") ||
    title.includes("director")
  ) {
    score += 25;
  }
  if (preferredDepartment && profile.department === preferredDepartment) {
    score += 15;
  }
  score += Math.max(0, profile.allocation.availablePct);
  return score;
}

function collaboratorScore(profile) {
  let score = Math.max(0, profile.allocation.availablePct);
  if ((profile.skills ?? []).length) {
    score += Math.min(15, profile.skills.length * 3);
  }
  if (profile.allocation.status === RESOURCE_STATUS_AVAILABLE) {
    score += 10;
  }
  return score;
}

function buildFitNotes(profile, preferredDepartment) {
  const notes = [];
  if (
    preferredDepartment &&
    profile.department &&
    profile.department === preferredDepartment
  ) {
    notes.push("Same department");
  }
  const roleDescriptor = (profile.role ?? "").toLowerCase();
  const titleDescriptor = (profile.title ?? "").toLowerCase();
  if (roleDescriptor.includes("lead") || roleDescriptor.includes("manager")) {
    notes.push("Leadership experience");
  } else if (
    titleDescriptor.includes("lead") ||
    titleDescriptor.includes("manager") ||
    titleDescriptor.includes("director")
  ) {
    notes.push("Leadership title");
  }
  if (profile.allocation.status === RESOURCE_STATUS_OVERBOOKED) {
    notes.push("Fully allocated");
  } else if (profile.allocation.availablePct >= 40) {
    notes.push("High availability");
  } else if (profile.allocation.status === RESOURCE_STATUS_LIMITED) {
    notes.push("Limited availability");
  }
  return notes;
}

function normalizeReadinessChecklist(raw) {
  const now = new Date();
  const entries = Array.isArray(raw?.items) ? raw.items : [];
  const itemsById = new Map(
    entries
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item])
  );

  let completedWeight = 0;
  const items = READINESS_DEFINITIONS.map((definition) => {
    const incoming = itemsById.get(definition.id) ?? {};
    const incomingStatus = incoming.status;
    const status =
      typeof incomingStatus === "string" &&
      Object.prototype.hasOwnProperty.call(
        READINESS_STATUS_VALUES,
        incomingStatus
      )
        ? incomingStatus
        : "not_started";
    const ownerId =
      typeof incoming.ownerId === "number"
        ? incoming.ownerId
        : Number.isFinite(Number(incoming.ownerId))
        ? Number(incoming.ownerId)
        : null;
    const dueDate =
      typeof incoming.dueDate === "string" && incoming.dueDate.trim().length > 0
        ? incoming.dueDate.substring(0, 10)
        : null;
    const notes =
      typeof incoming.notes === "string" ? incoming.notes.trim() : "";
    const ownerName =
      typeof incoming.ownerName === "string" && incoming.ownerName.trim().length
        ? incoming.ownerName
        : null;
    const statusUpdatedAt = incoming.statusUpdatedAt
      ? new Date(incoming.statusUpdatedAt).toISOString()
      : now.toISOString();
    const lastUpdatedBy =
      typeof incoming.lastUpdatedBy === "number" ||
      typeof incoming.lastUpdatedBy === "string"
        ? incoming.lastUpdatedBy
        : null;

    completedWeight += definition.weight * READINESS_STATUS_VALUES[status];

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      weight: definition.weight,
      status,
      ownerId,
      ownerName,
      dueDate,
      notes,
      statusUpdatedAt,
      lastUpdatedBy,
    };
  });

  const percent = READINESS_TOTAL_WEIGHT
    ? Math.round((completedWeight / READINESS_TOTAL_WEIGHT) * 100)
    : 0;

  return {
    items,
    totalWeight: READINESS_TOTAL_WEIGHT,
    completedWeight,
    percent,
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : now.toISOString(),
    updatedBy:
      typeof raw?.updatedBy === "number" || typeof raw?.updatedBy === "string"
        ? raw.updatedBy
        : null,
    summary:
      typeof raw?.summary === "string" && raw.summary.trim().length
        ? raw.summary
        : null,
  };
}

function normalizeApprovalStatus(value) {
  if (typeof value !== "string") {
    return "draft";
  }
  const normalized = value.trim().toLowerCase();
  return APPROVAL_STATUSES.has(normalized) ? normalized : "draft";
}

function normalizeStatusHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const changedAt = entry.changedAt
        ? new Date(entry.changedAt).toISOString()
        : new Date().toISOString();
      const status = normalizeApprovalStatus(entry.status);
      return {
        status,
        previousStatus: entry.previousStatus
          ? normalizeApprovalStatus(entry.previousStatus)
          : undefined,
        changedAt,
        changedBy: entry.changedBy ?? null,
        changedByName:
          typeof entry.changedByName === "string"
            ? entry.changedByName
            : undefined,
        comment:
          typeof entry.comment === "string" && entry.comment.trim().length
            ? entry.comment
            : undefined,
        note:
          typeof entry.note === "string" && entry.note.trim().length
            ? entry.note
            : undefined,
        attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
        metadata:
          entry.metadata && typeof entry.metadata === "object"
            ? entry.metadata
            : {},
        id: entry.id ?? `history-${index}`,
      };
    })
    .filter(Boolean);
}

function normalizeTimelineEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const occurredAt = entry.occurredAt
        ? new Date(entry.occurredAt).toISOString()
        : new Date().toISOString();
      const dueAt =
        typeof entry.dueAt === "string" && entry.dueAt.trim().length
          ? new Date(entry.dueAt).toISOString()
          : undefined;
      return {
        id: entry.id ?? `timeline-${index}`,
        label:
          typeof entry.label === "string" && entry.label.trim().length
            ? entry.label
            : "Event",
        description:
          typeof entry.description === "string" &&
          entry.description.trim().length
            ? entry.description
            : undefined,
        state: entry.state ?? "completed",
        occurredAt,
        dueAt,
        assigneeIds: Array.isArray(entry.assigneeIds) ? entry.assigneeIds : [],
        supportingDocs: Array.isArray(entry.supportingDocs)
          ? entry.supportingDocs
          : [],
        status: entry.status
          ? normalizeApprovalStatus(entry.status)
          : undefined,
        actorId: entry.actorId ?? null,
        actorName:
          typeof entry.actorName === "string" && entry.actorName.trim().length
            ? entry.actorName
            : undefined,
      };
    })
    .filter(Boolean);
}

function normalizeReviewerComments(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const createdAt = entry.createdAt
        ? new Date(entry.createdAt).toISOString()
        : new Date().toISOString();
      return {
        id: entry.id ?? `comment-${index}`,
        section:
          typeof entry.section === "string" && entry.section.trim().length
            ? entry.section
            : "overview",
        comment: typeof entry.comment === "string" ? entry.comment.trim() : "",
        reviewerId:
          typeof entry.reviewerId === "number"
            ? entry.reviewerId
            : Number(entry.reviewerId) || null,
        reviewerName:
          typeof entry.reviewerName === "string"
            ? entry.reviewerName
            : undefined,
        createdAt,
        severity: entry.severity ?? "info",
        suggestions: Array.isArray(entry.suggestions) ? entry.suggestions : [],
        resolved: entry.resolved === true,
        resolvedAt: entry.resolvedAt
          ? new Date(entry.resolvedAt).toISOString()
          : undefined,
        resolvedBy: entry.resolvedBy ?? undefined,
      };
    })
    .filter(Boolean);
}

export async function listParentDepartments() {
  return prisma.departmentParent.findMany({
    orderBy: { departmentId: "asc" },
  });
}

export async function listChildDepartmentsByParent(parentDeptId) {
  return prisma.departmentChild.findMany({
    where: { parentDeptId: Number(parentDeptId) },
    orderBy: { childDeptId: "asc" },
  });
}

async function resolveDepartmentNameByChildId(childDeptId, fallback) {
  if (!childDeptId) {
    return fallback ?? null;
  }
  const child = await prisma.departmentChild.findUnique({
    where: { childDeptId: Number(childDeptId) },
    select: { departmentName: true },
  });
  return child?.departmentName ?? fallback ?? null;
}

function mapEmployee(employee) {
  if (!employee) {
    return employee;
  }
  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    contactNo: employee.contactNo ?? "",
    emailId: employee.emailId ?? "",
    deptId: employee.deptId ?? 0,
    password: employee.password ?? "",
    gender: employee.gender ?? "",
    role: employee.role ?? "",
    department: employee.department ?? "",
    title: employee.title ?? "",
    avatarUrl: employee.avatarUrl ?? "",
    location: employee.location ?? "",
    timezone: employee.timezone ?? "",
    employmentType: employee.employmentType ?? "",
    managerId: employee.managerId ?? undefined,
    hireDate: formatDate(employee.hireDate),
    bio: employee.bio ?? "",
    about: employee.about ?? "",
    notes: employee.notes ?? "",
    tags: employee.tags ?? [],
    skills: employee.skills ?? [],
    certifications: employee.certifications ?? [],
    interests: employee.interests ?? [],
    languages: employee.languages ?? [],
    socialLinks: employee.socialLinks ?? {},
    workPreferences: employee.workPreferences ?? {},
    availability: employee.availability ?? {},
    preferences: employee.preferences ?? {},
    performanceSnapshot: employee.performanceSnapshot ?? {},
    documents: employee.documents ?? [],
    customFields: employee.customFields ?? {},
    isActive: employee.isActive,
    createdAt: employee.createdAt?.toISOString(),
    updatedAt: employee.updatedAt?.toISOString(),
    lastActiveAt: employee.lastActiveAt
      ? employee.lastActiveAt.toISOString()
      : undefined,
  };
}

export async function listEmployees() {
  const employees = await prisma.employee.findMany({
    orderBy: { employeeId: "asc" },
  });
  return employees.map(mapEmployee);
}

export async function createEmployee(payload) {
  // Validate required fields
  if (!payload.employeeName) {
    throw clientError(400, "employeeName is required to create an employee");
  }

  const [employeeId, departmentName] = await Promise.all([
    getNextSequenceValue("employee"),
    resolveDepartmentNameByChildId(payload.deptId, payload.department),
  ]);

  const record = await prisma.employee.create({
    data: {
      employeeId,
      employeeName: payload.employeeName,
      contactNo: payload.contactNo ?? null,
      emailId: payload.emailId ?? null,
      deptId: payload.deptId ?? null,
      department: departmentName,
      password: payload.password ?? null,
      gender: payload.gender ?? null,
      role: payload.role ?? null,
      title: payload.title ?? null,
      avatarUrl: payload.avatarUrl ?? null,
      location: payload.location ?? null,
      timezone: payload.timezone ?? null,
      employmentType: payload.employmentType ?? null,
      managerId: payload.managerId ?? null,
      hireDate: toDate(payload.hireDate),
      bio: payload.bio ?? null,
      about: payload.about ?? null,
      notes: payload.notes ?? null,
      tags: payload.tags ?? [],
      skills: payload.skills ?? [],
      certifications: payload.certifications ?? [],
      interests: payload.interests ?? [],
      languages: payload.languages ?? [],
      socialLinks: payload.socialLinks ?? null,
      workPreferences: payload.workPreferences ?? null,
      availability: payload.availability ?? null,
      preferences: payload.preferences ?? null,
      performanceSnapshot: payload.performanceSnapshot ?? null,
      documents: payload.documents ?? null,
      customFields: payload.customFields ?? null,
      isActive: payload.isActive !== false,
    },
  });

  // Verify the record was created (should never be null after successful create)
  if (!record) {
    throw new Error("Failed to create employee record");
  }

  return mapEmployee(record);
}

export async function updateEmployee(employeeId, payload) {
  const departmentChanged =
    payload.deptId !== undefined || payload.department !== undefined;
  const [existingRecord, departmentName] = await Promise.all([
    prisma.employee.findUnique({ where: { employeeId: Number(employeeId) } }),
    departmentChanged
      ? resolveDepartmentNameByChildId(payload.deptId, payload.department)
      : null,
  ]);

  if (!existingRecord) {
    throw Object.assign(new Error(`Employee with employeeId ${employeeId} not found`), {
      code: "P2025",
    });
  }

  // Build update data object, only including fields that are provided
  const updateData = {};

  // Only update employeeName if provided (it's a required field, so don't set to undefined)
  if (payload.employeeName !== undefined) {
    updateData.employeeName = payload.employeeName;
  }

  // Update optional fields only if provided
  if (payload.contactNo !== undefined) {
    updateData.contactNo = payload.contactNo ?? null;
  }
  if (payload.emailId !== undefined) {
    updateData.emailId = payload.emailId ?? null;
  }
  if (departmentChanged) {
    updateData.deptId = payload.deptId ?? null;
    updateData.department = departmentName;
  }
  if (payload.password !== undefined) {
    updateData.password = payload.password ?? null;
  }
  if (payload.gender !== undefined) {
    updateData.gender = payload.gender ?? null;
  }
  if (payload.role !== undefined) {
    updateData.role = payload.role ?? null;
  }
  if (payload.title !== undefined) {
    updateData.title = payload.title ?? null;
  }
  if (payload.avatarUrl !== undefined) {
    updateData.avatarUrl = payload.avatarUrl ?? null;
  }
  if (payload.location !== undefined) {
    updateData.location = payload.location ?? null;
  }
  if (payload.timezone !== undefined) {
    updateData.timezone = payload.timezone ?? null;
  }
  if (payload.employmentType !== undefined) {
    updateData.employmentType = payload.employmentType ?? null;
  }
  if (payload.managerId !== undefined) {
    updateData.managerId = payload.managerId ?? null;
  }
  if (payload.hireDate !== undefined) {
    updateData.hireDate = toDate(payload.hireDate);
  }
  if (payload.bio !== undefined) {
    updateData.bio = payload.bio ?? null;
  }
  if (payload.about !== undefined) {
    updateData.about = payload.about ?? null;
  }
  if (payload.notes !== undefined) {
    updateData.notes = payload.notes ?? null;
  }
  if (payload.tags !== undefined) {
    updateData.tags = payload.tags ?? [];
  }
  if (payload.skills !== undefined) {
    updateData.skills = payload.skills ?? [];
  }
  if (payload.certifications !== undefined) {
    updateData.certifications = payload.certifications ?? [];
  }
  if (payload.interests !== undefined) {
    updateData.interests = payload.interests ?? [];
  }
  if (payload.languages !== undefined) {
    updateData.languages = payload.languages ?? [];
  }
  if (payload.socialLinks !== undefined) {
    updateData.socialLinks = payload.socialLinks ?? null;
  }
  if (payload.workPreferences !== undefined) {
    updateData.workPreferences = payload.workPreferences ?? null;
  }
  if (payload.availability !== undefined) {
    updateData.availability = payload.availability ?? null;
  }
  if (payload.preferences !== undefined) {
    updateData.preferences = payload.preferences ?? null;
  }
  if (payload.performanceSnapshot !== undefined) {
    updateData.performanceSnapshot = payload.performanceSnapshot ?? null;
  }
  if (payload.documents !== undefined) {
    updateData.documents = payload.documents ?? null;
  }
  if (payload.customFields !== undefined) {
    updateData.customFields = payload.customFields ?? null;
  }
  if (payload.isActive !== undefined) {
    updateData.isActive = payload.isActive !== false;
  }
  if (payload.lastActiveAt !== undefined) {
    updateData.lastActiveAt = toDate(payload.lastActiveAt);
  }

  // If no fields to update, return the existing record
  if (Object.keys(updateData).length === 0) {
    return mapEmployee(existingRecord);
  }

  // Use MongoDB native driver fallback for update
  const record = await updateWithMongoFallback(
    "employee",
    "employeeId",
    Number(employeeId),
    updateData,
    async () => {
      return await prisma.employee.findUnique({
        where: { employeeId: Number(employeeId) },
      });
    }
  );

  if (!record) {
    throw new Error(`Failed to update employee with employeeId ${employeeId}`);
  }

  return mapEmployee(record);
}

export async function deleteEmployee(employeeId) {
  const id = Number(employeeId);

  const employee = await prisma.employee.findUnique({
    where: { employeeId: id },
  });
  if (!employee) {
    throw new Error("Employee not found");
  }

  await deleteWithAssignments({
    collection: "Employee",
    keyField: "employeeId",
    assignmentField: "empId",
    id,
  });

  const ledProjects = await prisma.project.findMany({
    where: { leadByEmpId: id },
    select: { projectId: true },
  });
  for (const { projectId } of ledProjects) {
    await updateWithMongoFallback("project", "projectId", projectId, { leadByEmpId: null }, () =>
      prisma.project.findUnique({ where: { projectId } })
    );
  }

  return mapEmployee(employee);
}

/** Projects saved without overview content still return the arrays the client renders. */
function normalizeProjectOverview(overview) {
  const value = overview && typeof overview === "object" && !Array.isArray(overview) ? overview : {};
  return {
    ...value,
    summary: typeof value.summary === "string" ? value.summary : "",
    objectives: sanitizeArray(value.objectives),
    successCriteria: sanitizeArray(value.successCriteria),
  };
}

function mapProject(project, extras = {}) {
  if (!project) {
    return project;
  }

  const readiness = normalizeReadinessChecklist(project.readinessChecklist);
  const statusHistory = normalizeStatusHistory(project.statusHistory);
  const timeline = normalizeTimelineEntries(project.timeline);
  const reviewerComments = normalizeReviewerComments(project.reviewerComments);
  const approvalStatus = normalizeApprovalStatus(project.approvalStatus);
  const leadByEmpId =
    typeof project.leadByEmpId === "number"
      ? project.leadByEmpId
      : project.leadByEmpId
      ? Number(project.leadByEmpId)
      : null;

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    clientName: project.clientName ?? "",
    clientIndustry: project.clientIndustry ?? "",
    startDate: formatDate(project.startDate),
    endDate: formatDate(project.endDate),
    leadByEmpId,
    sponsorEmpId: project.sponsorEmpId ?? undefined,
    contactPerson: project.contactPerson ?? "",
    contactNo: project.contactNo ?? "",
    emailId: project.emailId ?? "",
    employeeName: extras.employeeName ?? project.employeeName ?? "",
    contactTitle: project.contactTitle ?? "",
    contactNotes: project.contactNotes ?? "",
    overview: normalizeProjectOverview(project.overview),
    scope: project.scope ?? {},
    successMetrics: project.successMetrics ?? [],
    status: project.status ?? approvalStatus,
    statusReason: project.statusReason ?? "",
    statusHistory,
    timeline,
    milestones: project.milestones ?? [],
    categories: project.categories ?? [],
    tags: project.tags ?? [],
    focusAreas: project.focusAreas ?? [],
    blockers: project.blockers ?? [],
    risks: project.risks ?? [],
    riskRegister: project.riskRegister ?? {},
    budget: project.budget ?? {},
    financials: project.financials ?? {},
    resourcesPlan: project.resourcesPlan ?? {},
    readinessChecklist: readiness,
    readinessScore: project.readinessScore ?? readiness.percent,
    approvalStatus,
    approvalRequestedAt: project.approvalRequestedAt
      ? project.approvalRequestedAt.toISOString()
      : undefined,
    approvalRequestedBy: project.approvalRequestedBy ?? undefined,
    approvalResolvedAt: project.approvalResolvedAt
      ? project.approvalResolvedAt.toISOString()
      : undefined,
    approvalResolvedBy: project.approvalResolvedBy ?? undefined,
    approvalReason: project.approvalReason ?? undefined,
    approvalNotes: project.approvalNotes ?? {},
    reviewerComments,
    progress: project.progress ?? null,
    health: project.health ?? "",
    documents: project.documents ?? [],
    externalLinks: project.externalLinks ?? [],
    aiGeneratedInsights: project.aiGeneratedInsights ?? {},
    cmsContentRefs: project.cmsContentRefs ?? [],
    lastSyncedAt: project.lastSyncedAt
      ? project.lastSyncedAt.toISOString()
      : undefined,
    stageGate: project.stageGate ?? {},
    governance: project.governance ?? {},
    communicationPlan: project.communicationPlan ?? {},
    createdAt: project.createdAt?.toISOString(),
    updatedAt: project.updatedAt?.toISOString(),
    archivedAt: project.archivedAt
      ? project.archivedAt.toISOString()
      : undefined,
    archivedBy: project.archivedBy ?? undefined,
  };
}

async function leadNameByEmployeeId(projects) {
  const ids = [
    ...new Set(
      (projects ?? [])
        .map((project) =>
          project?.leadByEmpId != null ? Number(project.leadByEmpId) : null
        )
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  if (ids.length === 0) {
    return new Map();
  }
  const employees = await prisma.employee.findMany({
    where: { employeeId: { in: ids } },
    select: { employeeId: true, employeeName: true },
  });
  return new Map(
    employees.map((employee) => [employee.employeeId, employee.employeeName])
  );
}

function mapProjectWithLeadNames(project, nameById) {
  const leadId =
    project?.leadByEmpId != null ? Number(project.leadByEmpId) : null;
  return mapProject(project, {
    employeeName: leadId && nameById.has(leadId) ? nameById.get(leadId) : "",
  });
}

async function mapProjectsWithLeadNames(projects) {
  const nameById = await leadNameByEmployeeId(projects);
  return projects.map((project) => mapProjectWithLeadNames(project, nameById));
}

async function mapProjectWithLeadName(project) {
  if (!project) {
    return mapProject(project);
  }
  const [mapped] = await mapProjectsWithLeadNames([project]);
  return mapped;
}

export async function listProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { projectId: "asc" },
  });
  return mapProjectsWithLeadNames(projects);
}

export async function getProject(projectId) {
  const project = await prisma.project.findUnique({
    where: { projectId: Number(projectId) },
  });
  return mapProjectWithLeadName(project);
}

export async function getProjectResourceInsights(projectId) {
  const numericId = Number(projectId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error("Invalid project identifier");
  }

  const project = await prisma.project.findUnique({
    where: { projectId: numericId },
    select: {
      projectId: true,
      projectName: true,
      leadByEmpId: true,
      resourcesPlan: true,
    },
  });

  if (!project) {
    return null;
  }

  const [employees, projectAssignments, activeAssignments, projects] =
    await Promise.all([
      prisma.employee.findMany({
        select: {
          employeeId: true,
          employeeName: true,
          role: true,
          title: true,
          department: true,
          location: true,
          timezone: true,
          employmentType: true,
          skills: true,
          tags: true,
          certifications: true,
          isActive: true,
          lastActiveAt: true,
        },
      }),
      prisma.projectEmployee.findMany({
        where: { projectId: numericId },
        orderBy: { empProjectId: "desc" },
        select: {
          empProjectId: true,
          projectId: true,
          empId: true,
          assignedDate: true,
          role: true,
          isActive: true,
          allocationPct: true,
        },
      }),
      prisma.projectEmployee.findMany({
        where: { isActive: true },
        select: {
          projectId: true,
          empId: true,
          assignedDate: true,
          allocationPct: true,
          role: true,
          isActive: true,
        },
      }),
      prisma.project.findMany({
        select: { projectId: true, projectName: true, archivedAt: true, status: true },
      }),
    ]);

  const projectLookup = new Map(
    projects
      .filter((item) => !item.archivedAt && !isProjectClosed(item))
      .map((item) => [item.projectId, item])
  );
  const employeeLookup = new Map(
    employees.map((employee) => [employee.employeeId, employee])
  );
  const liveAssignments = activeAssignments.filter((assignment) =>
    projectLookup.has(assignment.projectId)
  );
  const summaryMap = buildAssignmentSummary(liveAssignments, projectLookup);

  const activeProjectAssignments = projectAssignments.filter(
    (assignment) => assignment.isActive !== false
  );

  const teamAssignments = activeProjectAssignments
    .map((assignment) => {
      const employee = employeeLookup.get(assignment.empId);
      if (!employee) {
        return null;
      }
      const profile = buildResourceProfile({
        employee,
        summary: summaryMap.get(employee.employeeId),
        projectLookup,
        currentProjectId: project.projectId,
      });
      return {
        empProjectId: assignment.empProjectId,
        role: assignment.role ?? "",
        allocationPct:
          assignment.allocationPct !== null &&
          assignment.allocationPct !== undefined
            ? Number(assignment.allocationPct)
            : null,
        isActive: assignment.isActive !== false,
        assignedDate: assignment.assignedDate
          ? assignment.assignedDate.toISOString()
          : undefined,
        allocationStatus: profile.allocation.status,
        employee: profile,
      };
    })
    .filter(Boolean);

  const teamEmployeeIds = new Set(
    teamAssignments.map((assignment) => assignment.employee.employeeId)
  );

  const leadEmployee = project.leadByEmpId
    ? employeeLookup.get(project.leadByEmpId)
    : undefined;

  const leadProfile = leadEmployee
    ? buildResourceProfile({
        employee: leadEmployee,
        summary: summaryMap.get(leadEmployee.employeeId),
        projectLookup,
        currentProjectId: project.projectId,
      })
    : null;

  if (leadProfile) {
    teamEmployeeIds.add(leadProfile.employeeId);
  }

  const preferredDepartment =
    leadEmployee?.department ??
    teamAssignments.find(
      (assignment) =>
        assignment?.employee?.department &&
        assignment.employee.department.trim().length > 0
    )?.employee.department ??
    undefined;

  const leadRecommendations = employees
    .filter((employee) => employee.isActive !== false)
    .filter((employee) => employee.employeeId !== project.leadByEmpId)
    .map((employee) => {
      const profile = buildResourceProfile({
        employee,
        summary: summaryMap.get(employee.employeeId),
        projectLookup,
        currentProjectId: project.projectId,
      });
      const score = leadCandidateScore(profile, preferredDepartment);
      const notes = buildFitNotes(profile, preferredDepartment);
      return { profile, score, notes };
    })
    .filter(
      (entry) =>
        entry.profile.allocation.status !== RESOURCE_STATUS_OVERBOOKED ||
        entry.score >= 40
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (
        (b.profile.allocation.availablePct ?? 0) -
        (a.profile.allocation.availablePct ?? 0)
      );
    })
    .slice(0, 3)
    .map((entry) => ({
      ...entry.profile,
      fitScore: Math.round(entry.score * 10) / 10,
      fitNotes: entry.notes.length ? entry.notes.join(" • ") : undefined,
    }));

  const collaboratorRecommendations = employees
    .filter((employee) => employee.isActive !== false)
    .filter((employee) => !teamEmployeeIds.has(employee.employeeId))
    .map((employee) => {
      const profile = buildResourceProfile({
        employee,
        summary: summaryMap.get(employee.employeeId),
        projectLookup,
        currentProjectId: project.projectId,
      });
      const score = collaboratorScore(profile);
      const notes = buildFitNotes(profile, preferredDepartment);
      return { profile, score, notes };
    })
    .filter(
      (entry) => entry.profile.allocation.status !== RESOURCE_STATUS_OVERBOOKED
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (
        (b.profile.allocation.availablePct ?? 0) -
        (a.profile.allocation.availablePct ?? 0)
      );
    })
    .slice(0, 5)
    .map((entry) => ({
      ...entry.profile,
      fitScore: Math.round(entry.score * 10) / 10,
      fitNotes: entry.notes.length ? entry.notes.join(" • ") : undefined,
    }));

  const allocations = employees.map((employee) => {
    const aggregate = summaryMap.get(employee.employeeId);
    return aggregate ? aggregate.allocatedPct : 0;
  });
  const totalAllocation = allocations.reduce((sum, value) => sum + value, 0);
  const averageAllocation =
    allocations.length > 0
      ? Math.round((totalAllocation / allocations.length) * 10) / 10
      : 0;
  const benchCount = employees.filter((employee) => {
    if (employee.isActive === false) {
      return false;
    }
    const aggregate = summaryMap.get(employee.employeeId);
    return !aggregate || aggregate.allocatedPct === 0;
  }).length;
  const overbookedCount = employees.filter((employee) => {
    if (employee.isActive === false) {
      return false;
    }
    const aggregate = summaryMap.get(employee.employeeId);
    const allocated = aggregate ? aggregate.allocatedPct : 0;
    return deriveLoadStatus(allocated) === RESOURCE_STATUS_OVERBOOKED;
  }).length;

  const metrics = {
    benchCount,
    overbookedCount,
    averageAllocation,
    activeAssignmentCount: liveAssignments.length,
    teamSize: teamAssignments.length,
  };

  const leadFitScore = leadProfile
    ? Math.round(leadCandidateScore(leadProfile, preferredDepartment) * 10) / 10
    : undefined;

  const leadData = leadProfile
    ? {
        ...leadProfile,
        fitScore: leadFitScore,
        fitNotes:
          buildFitNotes(leadProfile, preferredDepartment).join(" • ") ||
          undefined,
      }
    : null;

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    retrievedAt: new Date().toISOString(),
    resourcesPlan: project.resourcesPlan ?? null,
    lead: leadData,
    assignments: teamAssignments,
    recommendedLeads: leadRecommendations,
    recommendedCollaborators: collaboratorRecommendations,
    metrics,
  };
}

export async function createProject(payload) {
  // Validate required fields
  if (!payload.projectName) {
    throw clientError(400, "projectName is required to create a project");
  }

  const leadId = payload.leadByEmpId ? Number(payload.leadByEmpId) : null;
  const [projectId, leadNames] = await Promise.all([
    getNextSequenceValue("project"),
    leadNameByEmployeeId([payload]),
  ]);
  assertLeadExists(leadId, leadNames);
  const readiness = normalizeReadinessChecklist(payload.readinessChecklist);
  const statusHistory = normalizeStatusHistory(payload.statusHistory);
  const timeline = normalizeTimelineEntries(payload.timeline);
  const reviewerComments = normalizeReviewerComments(payload.reviewerComments);
  const approvalStatus = normalizeApprovalStatus(payload.approvalStatus);

  if (!statusHistory.length) {
    statusHistory.push(
      buildApprovalHistoryEntry({
        status: approvalStatus,
        previousStatus: null,
        actorId: payload?.audit?.createdBy ?? null,
        actorName: payload?.audit?.createdByName ?? undefined,
        comment: "Project created",
      })
    );
  }

  if (!timeline.length) {
    timeline.push(
      buildApprovalTimelineEntry({
        status: approvalStatus,
        actorId: payload?.audit?.createdBy ?? null,
        actorName: payload?.audit?.createdByName ?? undefined,
        comment: "Initial status recorded",
      })
    );
  }

  const record = await prisma.project.create({
    data: {
      projectId,
      projectName: payload.projectName,
      clientName: payload.clientName ?? null,
      clientIndustry: payload.clientIndustry ?? null,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      leadByEmpId: leadId,
      sponsorEmpId: payload.sponsorEmpId ? Number(payload.sponsorEmpId) : null,
      contactPerson: payload.contactPerson ?? null,
      contactNo: payload.contactNo ?? null,
      emailId: payload.emailId ?? null,
      contactTitle: payload.contactTitle ?? null,
      contactNotes: payload.contactNotes ?? null,
      overview: payload.overview ?? null,
      scope: payload.scope ?? null,
      successMetrics: payload.successMetrics ?? [],
      status: initialProjectStatus(approvalStatus, payload.status),
      statusReason: payload.statusReason ?? null,
      statusHistory,
      timeline,
      milestones: payload.milestones ?? [],
      categories: payload.categories ?? [],
      tags: payload.tags ?? [],
      focusAreas: payload.focusAreas ?? [],
      blockers: payload.blockers ?? [],
      risks: payload.risks ?? [],
      riskRegister: payload.riskRegister ?? null,
      budget: payload.budget ?? null,
      financials: payload.financials ?? null,
      resourcesPlan: payload.resourcesPlan ?? null,
      readinessChecklist: readiness,
      readinessScore:
        typeof payload.readinessScore === "number"
          ? payload.readinessScore
          : readiness.percent,
      approvalStatus,
      approvalRequestedAt: toDate(payload.approvalRequestedAt),
      approvalRequestedBy: payload.approvalRequestedBy
        ? Number(payload.approvalRequestedBy)
        : null,
      approvalResolvedAt: toDate(payload.approvalResolvedAt),
      approvalResolvedBy: payload.approvalResolvedBy
        ? Number(payload.approvalResolvedBy)
        : null,
      approvalReason: payload.approvalReason ?? null,
      approvalNotes: payload.approvalNotes ?? {},
      reviewerComments,
      progress: payload.progress ?? null,
      health: payload.health ?? null,
      documents: payload.documents ?? [],
      externalLinks: payload.externalLinks ?? [],
      aiGeneratedInsights: payload.aiGeneratedInsights ?? null,
      cmsContentRefs: payload.cmsContentRefs ?? [],
      lastSyncedAt: toDate(payload.lastSyncedAt),
      stageGate: payload.stageGate ?? null,
      governance: payload.governance ?? null,
      communicationPlan: payload.communicationPlan ?? null,
    },
  });
  await ensureLeadAssignment(projectId, leadId);

  return mapProjectWithLeadNames(record, leadNames);
}

function assertLeadExists(leadId, leadNames) {
  if (leadId !== null && !leadNames.has(leadId)) {
    throw clientError(404, "Lead employee not found");
  }
}

/**
 * `leadByEmpId` is the source of truth for who leads a project, and the lead
 * always holds an active assignment on it: a missing one is created as
 * "Project Lead" and an inactive one is reactivated. Roles are never renamed.
 */
async function ensureLeadAssignment(projectId, leadId) {
  if (!isRecordId(leadId)) {
    return;
  }
  const existing = await prisma.projectEmployee.findMany({
    where: { projectId, empId: leadId },
    orderBy: { empProjectId: "asc" },
    select: { empProjectId: true, isActive: true },
  });
  if (existing.some((assignment) => assignment.isActive)) {
    return;
  }
  if (existing.length > 0) {
    const empProjectId = existing[0].empProjectId;
    await updateWithMongoFallback(
      "projectEmployee",
      "empProjectId",
      empProjectId,
      { isActive: true, unassignedAt: null },
      () => prisma.projectEmployee.findUnique({ where: { empProjectId } })
    );
    return;
  }
  const empProjectId = await getNextSequenceValue("projectEmployee");
  await prisma.projectEmployee
    .create({
      data: {
        empProjectId,
        projectId,
        empId: leadId,
        role: "Project Lead",
        isActive: true,
        assignedDate: new Date(),
        responsibilities: [],
        skillsApplied: [],
        toolsUsed: [],
      },
    })
    .catch((error) => {
      // A concurrent save already assigned the lead; the unique (projectId, empId) index kept one row.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    });
}

export async function updateProject(projectId, payload) {
  // Verify the record exists before attempting to update
  const existingRecord = await prisma.project.findUnique({
    where: { projectId: Number(projectId) },
  });

  if (!existingRecord) {
    throw Object.assign(new Error(`Project with projectId ${projectId} not found`), { code: "P2025" });
  }

  // Build update data object, only including fields that are provided
  const updateData = {};

  // Only update projectName if provided (it's a required field, so don't set to undefined)
  if (payload.projectName !== undefined) {
    updateData.projectName = payload.projectName;
  }

  // Normalize complex fields only if provided
  if (payload.readinessChecklist !== undefined) {
    updateData.readinessChecklist = normalizeReadinessChecklist(
      payload.readinessChecklist
    );
  }
  // Status, approval, history, timeline and reviewer comments are owned by their
  // own actions; the edit form sends back the whole loaded project, so copies
  // of them here would overwrite newer changes.

  // Update optional fields only if provided
  if (payload.clientName !== undefined) {
    updateData.clientName = payload.clientName ?? null;
  }
  if (payload.clientIndustry !== undefined) {
    updateData.clientIndustry = payload.clientIndustry ?? null;
  }
  if (payload.startDate !== undefined) {
    updateData.startDate = toDate(payload.startDate);
  }
  if (payload.endDate !== undefined) {
    updateData.endDate = toDate(payload.endDate);
  }
  if (payload.leadByEmpId !== undefined) {
    updateData.leadByEmpId = payload.leadByEmpId
      ? Number(payload.leadByEmpId)
      : null;
  }
  if (payload.sponsorEmpId !== undefined) {
    updateData.sponsorEmpId = payload.sponsorEmpId
      ? Number(payload.sponsorEmpId)
      : null;
  }
  if (payload.contactPerson !== undefined) {
    updateData.contactPerson = payload.contactPerson ?? null;
  }
  if (payload.contactNo !== undefined) {
    updateData.contactNo = payload.contactNo ?? null;
  }
  if (payload.emailId !== undefined) {
    updateData.emailId = payload.emailId ?? null;
  }
  if (payload.contactTitle !== undefined) {
    updateData.contactTitle = payload.contactTitle ?? null;
  }
  if (payload.contactNotes !== undefined) {
    updateData.contactNotes = payload.contactNotes ?? null;
  }
  if (payload.overview !== undefined) {
    updateData.overview = payload.overview ?? null;
  }
  if (payload.scope !== undefined) {
    updateData.scope = payload.scope ?? null;
  }
  if (payload.successMetrics !== undefined) {
    updateData.successMetrics = payload.successMetrics ?? [];
  }
  if (payload.statusReason !== undefined) {
    updateData.statusReason = payload.statusReason ?? null;
  }
  if (payload.milestones !== undefined) {
    updateData.milestones = payload.milestones ?? [];
  }
  if (payload.categories !== undefined) {
    updateData.categories = payload.categories ?? [];
  }
  if (payload.tags !== undefined) {
    updateData.tags = payload.tags ?? [];
  }
  if (payload.focusAreas !== undefined) {
    updateData.focusAreas = payload.focusAreas ?? [];
  }
  if (payload.blockers !== undefined) {
    updateData.blockers = payload.blockers ?? [];
  }
  if (payload.risks !== undefined) {
    updateData.risks = payload.risks ?? [];
  }
  if (payload.riskRegister !== undefined) {
    updateData.riskRegister = payload.riskRegister ?? null;
  }
  if (payload.budget !== undefined) {
    updateData.budget = payload.budget ?? null;
  }
  if (payload.financials !== undefined) {
    updateData.financials = payload.financials ?? null;
  }
  if (payload.resourcesPlan !== undefined) {
    updateData.resourcesPlan = payload.resourcesPlan ?? null;
  }
  if (payload.readinessScore !== undefined) {
    updateData.readinessScore =
      typeof payload.readinessScore === "number"
        ? payload.readinessScore
        : updateData.readinessChecklist?.percent ?? null;
  }
  if (payload.progress !== undefined) {
    updateData.progress = payload.progress ?? null;
  }
  if (payload.health !== undefined) {
    updateData.health = payload.health ?? null;
  }
  if (payload.documents !== undefined) {
    updateData.documents = payload.documents ?? [];
  }
  if (payload.externalLinks !== undefined) {
    updateData.externalLinks = payload.externalLinks ?? [];
  }
  if (payload.aiGeneratedInsights !== undefined) {
    updateData.aiGeneratedInsights = payload.aiGeneratedInsights ?? null;
  }
  if (payload.cmsContentRefs !== undefined) {
    updateData.cmsContentRefs = payload.cmsContentRefs ?? [];
  }
  if (payload.lastSyncedAt !== undefined) {
    updateData.lastSyncedAt = toDate(payload.lastSyncedAt);
  }
  if (payload.stageGate !== undefined) {
    updateData.stageGate = payload.stageGate ?? null;
  }
  if (payload.governance !== undefined) {
    updateData.governance = payload.governance ?? null;
  }
  if (payload.communicationPlan !== undefined) {
    updateData.communicationPlan = payload.communicationPlan ?? null;
  }

  // If no fields to update, return the existing record
  if (Object.keys(updateData).length === 0) {
    return mapProjectWithLeadName(existingRecord);
  }

  const leadProvided = "leadByEmpId" in updateData;
  const leadByEmpId = leadProvided ? updateData.leadByEmpId : existingRecord.leadByEmpId;
  const lockedMessage = teamLockedMessage(existingRecord);
  const leadChanged =
    leadProvided && Number(leadByEmpId ?? 0) !== Number(existingRecord.leadByEmpId ?? 0);
  if (lockedMessage && leadChanged) {
    throw clientError(409, lockedMessage);
  }
  const leadNames = await leadNameByEmployeeId([{ leadByEmpId }]);
  if (leadChanged) {
    assertLeadExists(leadByEmpId, leadNames);
  }
  const record = await updateWithMongoFallback(
    "project",
    "projectId",
    Number(projectId),
    updateData,
    () => prisma.project.findUnique({ where: { projectId: Number(projectId) } })
  );
  if (leadProvided && !lockedMessage && leadNames.has(leadByEmpId)) {
    await ensureLeadAssignment(record.projectId, leadByEmpId);
  }

  return mapProjectWithLeadNames(record, leadNames);
}

function buildApprovalHistoryEntry({
  status,
  previousStatus,
  actorId,
  actorName,
  comment,
}) {
  return {
    id: `history-${Date.now()}`,
    status,
    previousStatus,
    changedAt: new Date().toISOString(),
    changedBy: actorId ?? null,
    changedByName: actorName ?? undefined,
    comment: comment && comment.trim().length ? comment.trim() : undefined,
  };
}

function buildApprovalTimelineEntry({ status, actorId, actorName, comment }) {
  return {
    id: `approval-${Date.now()}`,
    label: `${APPROVAL_LABELS[status] ?? status} Status`,
    description: comment && comment.trim().length ? comment.trim() : undefined,
    state: "completed",
    occurredAt: new Date().toISOString(),
    status,
    actorId: actorId ?? null,
    actorName: actorName ?? undefined,
  };
}

export async function transitionProjectApproval(projectId, action, payload) {
  const numericId = Number(projectId);
  if (!numericId) {
    throw new Error("Invalid projectId");
  }

  const project = await prisma.project.findUnique({
    where: { projectId: numericId },
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const actorId =
    typeof payload?.actorId === "number"
      ? payload.actorId
      : Number(payload?.actorId) || null;
  const actorName =
    typeof payload?.actorName === "string" && payload.actorName.trim().length
      ? payload.actorName.trim()
      : undefined;
  const comment =
    typeof payload?.comment === "string" ? payload.comment.trim() : "";

  const currentStatus = normalizeApprovalStatus(project.approvalStatus);
  let nextStatus = currentStatus;
  let approvalRequestedAt = project.approvalRequestedAt
    ? new Date(project.approvalRequestedAt)
    : null;
  let approvalRequestedBy = project.approvalRequestedBy ?? null;
  let approvalResolvedAt = project.approvalResolvedAt
    ? new Date(project.approvalResolvedAt)
    : null;
  let approvalResolvedBy = project.approvalResolvedBy ?? null;
  let approvalReason = project.approvalReason ?? null;

  switch (action) {
    case "request":
      if (currentStatus === "draft" || currentStatus === "rejected") {
        nextStatus = "in_review";
        approvalRequestedAt = new Date();
        approvalRequestedBy = actorId;
        approvalResolvedAt = null;
        approvalResolvedBy = null;
        approvalReason = comment || approvalReason;
      }
      break;
    case "approve":
      if (currentStatus === "in_review") {
        nextStatus = "approved";
        approvalResolvedAt = new Date();
        approvalResolvedBy = actorId;
        approvalReason = comment || approvalReason;
      }
      break;
    case "reject":
      if (currentStatus === "in_review") {
        nextStatus = "rejected";
        approvalResolvedAt = new Date();
        approvalResolvedBy = actorId;
        approvalReason = comment || "Rejected";
      }
      break;
    case "reset":
      nextStatus = "draft";
      approvalRequestedAt = null;
      approvalRequestedBy = null;
      approvalResolvedAt = null;
      approvalResolvedBy = null;
      approvalReason = null;
      break;
    default:
      throw new Error(`Unsupported approval action: ${action}`);
  }

  if (nextStatus === currentStatus && action !== "reset") {
    return mapProjectWithLeadName(project);
  }

  const history = normalizeStatusHistory(project.statusHistory);
  history.push(
    buildApprovalHistoryEntry({
      status: nextStatus,
      previousStatus: currentStatus,
      actorId,
      actorName,
      comment,
    })
  );

  const timeline = normalizeTimelineEntries(project.timeline);
  timeline.push(
    buildApprovalTimelineEntry({
      status: nextStatus,
      actorId,
      actorName,
      comment,
    })
  );

  const approvalNotes =
    project.approvalNotes && typeof project.approvalNotes === "object"
      ? { ...project.approvalNotes }
      : {};
  approvalNotes.lastAction = action;
  approvalNotes.lastComment = comment;
  approvalNotes.lastActorId = actorId ?? null;
  approvalNotes.lastActorName = actorName ?? null;

  const updateData = {
    status: nextStatus === "approved" ? "in_flight" : nextStatus,
    approvalStatus: nextStatus,
    approvalRequestedAt,
    approvalRequestedBy,
    approvalResolvedAt,
    approvalResolvedBy,
    approvalReason,
    approvalNotes,
    statusHistory: history,
    timeline,
  };

  const updated = await updateWithMongoFallback(
    "project",
    "projectId",
    numericId,
    updateData,
    async () => {
      return await prisma.project.findUnique({
        where: { projectId: numericId },
      });
    }
  );

  if (!updated) {
    throw new Error(`Failed to update project approval status for projectId ${numericId}`);
  }

  return mapProjectWithLeadName(updated);
}

export async function addProjectReviewerComment(projectId, payload) {
  const numericId = Number(projectId);
  if (!numericId) {
    throw new Error("Invalid projectId");
  }

  const project = await prisma.project.findUnique({
    where: { projectId: numericId },
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const comments = normalizeReviewerComments(project.reviewerComments);
  const now = new Date();
  const entry = {
    id: `comment-${Date.now()}`,
    section:
      typeof payload?.section === "string" && payload.section.trim().length
        ? payload.section.trim()
        : "overview",
    comment: typeof payload?.comment === "string" ? payload.comment.trim() : "",
    reviewerId:
      typeof payload?.reviewerId === "number"
        ? payload.reviewerId
        : Number(payload?.reviewerId) || null,
    reviewerName:
      typeof payload?.reviewerName === "string" &&
      payload.reviewerName.trim().length
        ? payload.reviewerName.trim()
        : undefined,
    createdAt: now.toISOString(),
    severity: payload?.severity ?? "info",
    suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
    resolved: false,
  };
  comments.push(entry);

  const timeline = normalizeTimelineEntries(project.timeline);
  timeline.push({
    id: `review-${Date.now()}`,
    label: `Reviewer comment (${entry.section})`,
    description: entry.comment,
    state: "completed",
    occurredAt: now.toISOString(),
    status: project.approvalStatus ?? "draft",
    actorId: entry.reviewerId ?? null,
    actorName: entry.reviewerName ?? undefined,
  });

  const updateData = {
    reviewerComments: comments,
    timeline,
  };

  const updated = await updateWithMongoFallback(
    "project",
    "projectId",
    numericId,
    updateData,
    async () => {
      return await prisma.project.findUnique({
        where: { projectId: numericId },
      });
    }
  );

  if (!updated) {
    throw new Error(`Failed to add reviewer comment for projectId ${numericId}`);
  }

  return mapProjectWithLeadName(updated);
}

export async function resolveProjectReviewerComment(
  projectId,
  commentId,
  payload
) {
  const numericId = Number(projectId);
  if (!numericId) {
    throw new Error("Invalid projectId");
  }
  const project = await prisma.project.findUnique({
    where: { projectId: numericId },
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const comments = normalizeReviewerComments(project.reviewerComments);
  const index = comments.findIndex((comment) => comment.id === commentId);
  if (index === -1) {
    throw new Error("Reviewer comment not found");
  }

  const resolved = payload?.resolved === true;
  const actorId =
    typeof payload?.actorId === "number"
      ? payload.actorId
      : Number(payload?.actorId) || null;
  const actorName =
    typeof payload?.actorName === "string" && payload.actorName.trim().length
      ? payload.actorName.trim()
      : undefined;

  comments[index] = {
    ...comments[index],
    resolved,
    resolvedAt: resolved ? new Date().toISOString() : undefined,
    resolvedBy: resolved ? actorId ?? actorName ?? null : undefined,
  };

  const updateData = {
    reviewerComments: comments,
  };

  const updated = await updateWithMongoFallback(
    "project",
    "projectId",
    numericId,
    updateData,
    async () => {
      return await prisma.project.findUnique({
        where: { projectId: numericId },
      });
    }
  );

  if (!updated) {
    throw new Error(`Failed to resolve reviewer comment for projectId ${numericId}`);
  }

  return mapProjectWithLeadName(updated);
}

/**
 * Deletes a project and all of its assignments. Returns the mapped project
 * plus the pre-delete assignments so stakeholder recipients can be resolved
 * after the response is sent.
 */
export async function deleteProject(projectId) {
  const id = Number(projectId);

  const [project, assignments] = await Promise.all([
    prisma.project.findUnique({ where: { projectId: id } }),
    prisma.projectEmployee.findMany({
      where: { projectId: id },
      select: { empId: true, isActive: true },
    }),
  ]);
  if (!project) {
    throw new Error("Project not found");
  }

  const [mappedProject, deletedAssignments] = await Promise.all([
    mapProjectWithLeadName(project),
    deleteWithAssignments({
      collection: "Project",
      keyField: "projectId",
      assignmentField: "projectId",
      id,
    }),
  ]);

  return { project: mappedProject, stakeholderSource: project, assignments, deletedAssignments };
}

/**
 * Archiving hides a project and its assignments from schedules, capacity and
 * insights without deleting anything; restoring brings both back unchanged.
 */
export async function setProjectArchived(projectId, archived, actor = {}) {
  const id = Number(projectId);
  const existing = await prisma.project.findUnique({ where: { projectId: id } });
  if (!existing) {
    throw Object.assign(new Error(`Project with projectId ${id} not found`), { code: "P2025" });
  }
  if (Boolean(existing.archivedAt) === archived) {
    return mapProjectWithLeadName(existing);
  }

  const approvalStatus = normalizeApprovalStatus(existing.approvalStatus);
  const actorName = actor.displayName ?? actor.username ?? undefined;
  const statusHistory = [
    ...normalizeStatusHistory(existing.statusHistory),
    buildApprovalHistoryEntry({
      status: approvalStatus,
      previousStatus: approvalStatus,
      actorId: null,
      actorName,
      comment: archived ? "Project archived" : "Project restored",
    }),
  ];

  const record = await updateWithMongoFallback(
    "project",
    "projectId",
    id,
    {
      archivedAt: archived ? new Date() : null,
      archivedBy: archived ? actorName ?? null : null,
      statusHistory,
    },
    () => prisma.project.findUnique({ where: { projectId: id } })
  );
  return mapProjectWithLeadName(record);
}

/**
 * Sets the delivery status of an approved, unarchived project. 400 for an
 * unknown status, 404 for a missing project, 409 when the project isn't
 * approved or is archived; an unchanged status is a no-op.
 */
export async function setProjectDeliveryStatus(projectId, status, actor = {}) {
  const id = Number(projectId);
  const nextStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (!DELIVERY_STATUSES.has(nextStatus)) {
    throw clientError(400, `status must be one of: ${[...DELIVERY_STATUSES].join(", ")}`);
  }
  const existing = await prisma.project.findUnique({ where: { projectId: id } });
  if (!existing) {
    throw clientError(404, "Project not found");
  }
  if (existing.archivedAt) {
    throw clientError(409, "Project is archived. Restore it before changing its status");
  }
  if (normalizeApprovalStatus(existing.approvalStatus) !== "approved") {
    throw clientError(409, "Only approved projects have a delivery status");
  }
  const previousStatus = String(existing.status ?? "").trim().toLowerCase();
  if (previousStatus === nextStatus) {
    return mapProjectWithLeadName(existing);
  }

  const actorName = actor.displayName ?? actor.username ?? undefined;
  const label = DELIVERY_LABELS[nextStatus];
  const record = await updateWithMongoFallback(
    "project",
    "projectId",
    id,
    {
      status: nextStatus,
      statusHistory: [
        ...normalizeStatusHistory(existing.statusHistory),
        buildApprovalHistoryEntry({
          status: nextStatus,
          previousStatus,
          actorId: null,
          actorName,
          comment: `Delivery status set to ${label}`,
        }),
      ],
      timeline: [
        ...normalizeTimelineEntries(existing.timeline),
        {
          id: `delivery-${Date.now()}`,
          label: `${label} Status`,
          state: "completed",
          occurredAt: new Date().toISOString(),
          status: nextStatus,
          actorId: null,
          actorName,
        },
      ],
    },
    () => prisma.project.findUnique({ where: { projectId: id } })
  );
  return mapProjectWithLeadName(record);
}

function mapProjectEmployee(item, projectLookup, employeeLookup) {
  // Safety check: ensure item is not null
  if (!item) {
    throw new Error("Cannot map null or undefined ProjectEmployee item");
  }

  const project = item.projectId ? projectLookup.get(item.projectId) : null;
  const employee = item.empId ? employeeLookup.get(item.empId) : null;

  return {
    empProjectId: item.empProjectId,
    projectId: item.projectId,
    empId: item.empId,
    assignedDate: formatDate(item.assignedDate),
    role: item.role ?? "",
    isActive: item.isActive ? "Y" : "N",
    projectName: project?.projectName ?? "Unknown Project",
    projectArchivedAt: project?.archivedAt ? project.archivedAt.toISOString() : null,
    projectStatus: project?.status ?? null,
    employeeName: employee?.employeeName ?? "Unknown Employee",
    employeeAvatarUrl: employee?.avatarUrl ?? null,
    allocationPct: item.allocationPct ?? null,
    billable: item.billable ?? null,
    billingRate: item.billingRate ?? null,
    costRate: item.costRate ?? null,
    notes: item.notes ?? "",
    responsibilities: item.responsibilities ?? [],
    skillsApplied: item.skillsApplied ?? [],
    toolsUsed: item.toolsUsed ?? [],
    schedule: item.schedule ?? {},
    contribution: item.contribution ?? {},
    unassignedAt: formatDate(item.unassignedAt),
    createdAt: formatDate(item.createdAt),
    updatedAt: formatDate(item.updatedAt),
  };
}

/** Maps one assignment with only its own project/employee looked up (plus `employeeEmail` for notifications). */
async function mapAssignmentRecord(record) {
  const [project, employee] = await Promise.all([
    prisma.project.findUnique({
      where: { projectId: record.projectId },
      select: { projectId: true, projectName: true, archivedAt: true, status: true },
    }),
    prisma.employee.findUnique({
      where: { employeeId: record.empId },
      select: { employeeId: true, employeeName: true, emailId: true, avatarUrl: true },
    }),
  ]);
  const mapped = mapProjectEmployee(
    record,
    new Map(project ? [[project.projectId, project]] : []),
    new Map(employee ? [[employee.employeeId, employee]] : [])
  );
  if (employee) {
    mapped.employeeEmail = employee.emailId;
  }
  return mapped;
}

export async function listProjectEmployees() {
  const [projectEmployees, projects, employees] = await Promise.all([
    prisma.projectEmployee.findMany({
      orderBy: { empProjectId: "asc" },
    }),
    prisma.project.findMany({
      select: { projectId: true, projectName: true, archivedAt: true, status: true },
    }),
    prisma.employee.findMany({
      select: {
        employeeId: true,
        employeeName: true,
        avatarUrl: true,
        emailId: true,
      },
    }),
  ]);

  const projectLookup = new Map(
    projects.map((project) => [project.projectId, project])
  );
  const employeeLookup = new Map(
    employees.map((employee) => [employee.employeeId, employee])
  );

  return projectEmployees
    .filter((item) => projectLookup.has(item.projectId) && employeeLookup.has(item.empId))
    .map((item) => mapProjectEmployee(item, projectLookup, employeeLookup));
}

const ARCHIVED_TEAM_MESSAGE = "Project is archived. Restore it before changing its team";
const CLOSED_TEAM_MESSAGE =
  "Project is closed. Set it back to In Flight or On Hold before changing its team";

/** Why a project's team and lead can't change right now, or null when they can. */
function teamLockedMessage(project) {
  if (project?.archivedAt) {
    return ARCHIVED_TEAM_MESSAGE;
  }
  return isProjectClosed(project) ? CLOSED_TEAM_MESSAGE : null;
}

const DUPLICATE_ASSIGNMENT_MESSAGE = "Employee is already assigned to this project";

/**
 * Throws 400 for a non-integer id, 404 when a referenced project or employee
 * is missing and 409 when the project is archived or closed; omitted ids are not checked.
 */
async function assertAssignmentTargetsExist({ projectId, empId }) {
  if (projectId !== undefined && !isRecordId(projectId)) {
    throw clientError(400, "projectId must be a positive whole number");
  }
  if (empId !== undefined && !isRecordId(empId)) {
    throw clientError(400, "empId must be a positive whole number");
  }
  const [project, employee] = await Promise.all([
    projectId === undefined
      ? true
      : prisma.project.findUnique({
          where: { projectId },
          select: { projectId: true, archivedAt: true, status: true },
        }),
    empId === undefined
      ? true
      : prisma.employee.findUnique({ where: { employeeId: empId }, select: { employeeId: true } }),
  ]);
  if (!project) {
    throw clientError(404, "Project not found");
  }
  if (!employee) {
    throw clientError(404, "Employee not found");
  }
  const lockedMessage = teamLockedMessage(project);
  if (lockedMessage) {
    throw clientError(409, lockedMessage);
  }
}

/** One assignment per employee per project; `ignoreId` is the row being edited. */
async function assertNotAlreadyAssigned(projectId, empId, ignoreId) {
  const clash = await prisma.projectEmployee.findFirst({
    where: { projectId, empId },
    select: { empProjectId: true },
  });
  if (clash && clash.empProjectId !== ignoreId) {
    throw clientError(409, DUPLICATE_ASSIGNMENT_MESSAGE);
  }
}

async function assertProjectTeamOpen(projectId) {
  const project = await prisma.project.findUnique({
    where: { projectId },
    select: { archivedAt: true, status: true },
  });
  const lockedMessage = teamLockedMessage(project);
  if (lockedMessage) {
    throw clientError(409, lockedMessage);
  }
}

/**
 * The unique (projectId, empId) index is the last line against concurrent
 * duplicates: P2002 from Prisma, 11000 from the native update fallback.
 */
function isDuplicateKeyError(error) {
  return error?.code === "P2002" || error?.code === 11000;
}

function rethrowDuplicateAssignment(error) {
  if (isDuplicateKeyError(error)) {
    throw clientError(409, DUPLICATE_ASSIGNMENT_MESSAGE);
  }
  throw error;
}

export async function createProjectEmployee(payload) {
  // Validate required fields
  if (!payload.projectId) {
    throw clientError(400, "projectId is required to create a project employee assignment");
  }
  if (!payload.empId) {
    throw clientError(400, "empId is required to create a project employee assignment");
  }

  const projectId = Number(payload.projectId);
  const empId = Number(payload.empId);
  // Existence checks run alongside the id increment; a rejected request only leaves an id gap.
  const [, , empProjectId] = await Promise.all([
    assertAssignmentTargetsExist({ projectId, empId }),
    assertNotAlreadyAssigned(projectId, empId),
    getNextSequenceValue("projectEmployee"),
  ]);

  const record = await prisma.projectEmployee.create({
    data: {
      empProjectId,
      projectId,
      empId,
      assignedDate: toDate(payload.assignedDate),
      role: payload.role ?? null,
      isActive:
        payload.isActive === "Y" ||
        payload.isActive === "true" ||
        payload.isActive === true,
      allocationPct: payload.allocationPct ?? null,
      billable:
        typeof payload.billable === "boolean"
          ? payload.billable
          : payload.billable === "Y" || payload.billable === "true",
      billingRate: payload.billingRate ?? null,
      costRate: payload.costRate ?? null,
      notes: payload.notes ?? null,
      responsibilities: payload.responsibilities ?? [],
      skillsApplied: payload.skillsApplied ?? [],
      toolsUsed: payload.toolsUsed ?? [],
      schedule: payload.schedule ?? null,
      contribution: payload.contribution ?? null,
    },
  }).catch(rethrowDuplicateAssignment);

  return mapAssignmentRecord(record);
}

export async function updateProjectEmployee(empProjectId, payload) {
  const id = Number(empProjectId);

  // Build update data object, only including fields that are provided
  const updateData = {};

  // Only update projectId if provided (it's a required field, so don't set to null)
  if (payload.projectId !== undefined && payload.projectId !== null) {
    updateData.projectId = Number(payload.projectId);
  }

  // Only update empId if provided (it's a required field, so don't set to null)
  if (payload.empId !== undefined && payload.empId !== null) {
    updateData.empId = Number(payload.empId);
  }

  // Update optional fields
  if (payload.assignedDate !== undefined) {
    updateData.assignedDate = toDate(payload.assignedDate);
  }
  if (payload.role !== undefined) {
    updateData.role = payload.role ?? null;
  }
  if (payload.isActive !== undefined) {
    updateData.isActive =
      payload.isActive === "Y" ||
      payload.isActive === "true" ||
      payload.isActive === true;
  }
  if (payload.allocationPct !== undefined) {
    updateData.allocationPct = payload.allocationPct ?? null;
  }
  if (payload.billable !== undefined) {
    updateData.billable =
      typeof payload.billable === "boolean"
        ? payload.billable
        : payload.billable === "Y" || payload.billable === "true";
  }
  if (payload.billingRate !== undefined) {
    updateData.billingRate = payload.billingRate ?? null;
  }
  if (payload.costRate !== undefined) {
    updateData.costRate = payload.costRate ?? null;
  }
  if (payload.notes !== undefined) {
    updateData.notes = payload.notes ?? null;
  }
  if (payload.responsibilities !== undefined) {
    updateData.responsibilities = payload.responsibilities ?? [];
  }
  if (payload.skillsApplied !== undefined) {
    updateData.skillsApplied = payload.skillsApplied ?? [];
  }
  if (payload.toolsUsed !== undefined) {
    updateData.toolsUsed = payload.toolsUsed ?? [];
  }
  if (payload.schedule !== undefined) {
    updateData.schedule = payload.schedule ?? null;
  }
  if (payload.contribution !== undefined) {
    updateData.contribution = payload.contribution ?? null;
  }
  if (payload.unassignedAt !== undefined) {
    updateData.unassignedAt = toDate(payload.unassignedAt);
  }

  const notFound = () =>
    Object.assign(new Error(`Project employee assignment with empProjectId ${empProjectId} not found`), {
      code: "P2025",
    });

  const checksTargets = updateData.projectId !== undefined || updateData.empId !== undefined;
  // Deactivating stamps the unassigned date and reactivating clears it, unless the client sent one.
  const tracksUnassigned = updateData.isActive !== undefined && payload.unassignedAt === undefined;
  // A missing assignment is reported before a missing project/employee.
  const [existing, targetsError] = await Promise.all([
    prisma.projectEmployee.findUnique({ where: { empProjectId: id } }),
    checksTargets
      ? assertAssignmentTargetsExist(updateData).then(
          () => null,
          (error) => error
        )
      : null,
  ]);
  if (!existing) {
    throw notFound();
  }
  if (targetsError) {
    throw targetsError;
  }
  await Promise.all([
    updateData.projectId !== existing.projectId ? assertProjectTeamOpen(existing.projectId) : null,
    checksTargets
      ? assertNotAlreadyAssigned(
          updateData.projectId ?? existing.projectId,
          updateData.empId ?? existing.empId,
          id
        )
      : null,
  ]);
  if (tracksUnassigned) {
    if (!updateData.isActive && existing.isActive) {
      updateData.unassignedAt = new Date();
    } else if (updateData.isActive && existing.unassignedAt) {
      updateData.unassignedAt = null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return mapAssignmentRecord(existing);
  }

  const record = await updateWithMongoFallback(
    "projectEmployee",
    "empProjectId",
    id,
    updateData,
    () => prisma.projectEmployee.findUnique({ where: { empProjectId: id } })
  ).catch(rethrowDuplicateAssignment);
  return mapAssignmentRecord(record);
}

export async function deleteProjectEmployee(empProjectId) {
  // Fetch assignment data before deleting for notification purposes
  const record = await prisma.projectEmployee.findUnique({
    where: { empProjectId: Number(empProjectId) },
  });

  if (!record) {
    throw new Error("Project employee assignment not found");
  }
  await assertProjectTeamOpen(record.projectId);

  const mapped = await mapAssignmentRecord(record);
  await prisma.projectEmployee.delete({
    where: { empProjectId: Number(empProjectId) },
  });
  return mapped;
}

export async function buildDashboardSnapshot() {
  const [totalEmployee, projects, activeAssignments, recentEmployees] = await Promise.all([
    prisma.employee.count(),
    prisma.project.findMany({
      orderBy: { startDate: "desc" },
      select: {
        projectId: true,
        projectName: true,
        startDate: true,
        status: true,
        archivedAt: true,
      },
    }),
    prisma.projectEmployee.findMany({
      where: { isActive: true },
      select: { projectId: true },
    }),
    prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        employeeId: true,
        employeeName: true,
        role: true,
        department: true,
        avatarUrl: true,
        emailId: true,
        hireDate: true,
        createdAt: true,
      },
    }),
  ]);

  const liveProjects = projects.filter((project) => !project.archivedAt);
  const openProjectIds = new Set(
    liveProjects.filter((project) => !isProjectClosed(project)).map((project) => project.projectId)
  );

  return {
    totalEmployee,
    totalProject: liveProjects.length,
    archivedProject: projects.length - liveProjects.length,
    activeProjectEmployees: activeAssignments.filter((assignment) =>
      openProjectIds.has(assignment.projectId)
    ).length,
    recentProjects: liveProjects.slice(0, 5).map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      startDate: formatDate(project.startDate),
      status: project.status ?? null,
    })),
    recentEmployee: recentEmployees.map((employee) => ({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      role: employee.role,
      department: employee.department,
      avatarUrl: employee.avatarUrl ?? null,
      emailId: employee.emailId ?? null,
      hireDate: formatDate(employee.hireDate),
      createdAt: formatDate(employee.createdAt),
    })),
  };
}

export async function buildScheduleData() {
  const [projects, employees, activeAssignments] = await Promise.all([
    prisma.project.findMany({
      select: {
        projectId: true,
        projectName: true,
        clientName: true,
        startDate: true,
        endDate: true,
        status: true,
        timeline: true,
        milestones: true,
        readinessChecklist: true,
        readinessScore: true,
        leadByEmpId: true,
        archivedAt: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.employee.findMany({
      select: {
        employeeId: true,
        employeeName: true,
        department: true,
        emailId: true,
        avatarUrl: true,
      },
    }),
    prisma.projectEmployee.findMany({
      where: { isActive: true },
      select: { projectId: true },
    }),
  ]);

  const activeProjects = projects.filter((project) => !project.archivedAt);
  const employeeMap = new Map(employees.map((emp) => [emp.employeeId, emp]));
  const teamSizeByProject = new Map();
  activeAssignments.forEach(({ projectId }) => {
    teamSizeByProject.set(projectId, (teamSizeByProject.get(projectId) ?? 0) + 1);
  });

  const milestones = [];
  const dueDates = [];
  const projectTimelines = [];

  activeProjects.forEach((project) => {
    const lead = project.leadByEmpId
      ? employeeMap.get(project.leadByEmpId)
      : null;

    // Extract milestones from timeline
    if (Array.isArray(project.timeline)) {
      project.timeline.forEach((entry) => {
        if (entry && entry.occurredAt) {
          milestones.push({
            id:
              entry.id || `milestone-${project.projectId}-${milestones.length}`,
            projectId: project.projectId,
            projectName: project.projectName,
            clientName: project.clientName || "",
            label: entry.label || "Milestone",
            description: entry.description || "",
            date: formatDate(entry.occurredAt),
            state: entry.state || "upcoming",
            actorName: entry.actorName || lead?.employeeName || "",
            type: "timeline",
          });
        }
        if (entry && entry.dueAt) {
          dueDates.push({
            id: `due-${project.projectId}-${entry.id}`,
            projectId: project.projectId,
            projectName: project.projectName,
            label: entry.label || "Due Date",
            description: entry.description || "",
            dueDate: formatDate(entry.dueAt),
            type: "timeline-due",
          });
        }
      });
    }

    // Extract milestones from milestones array
    if (Array.isArray(project.milestones)) {
      project.milestones.forEach((milestone) => {
        if (milestone && milestone.occurredAt) {
          milestones.push({
            id:
              milestone.id ||
              `milestone-${project.projectId}-${milestones.length}`,
            projectId: project.projectId,
            projectName: project.projectName,
            clientName: project.clientName || "",
            label: milestone.label || "Milestone",
            description: milestone.description || "",
            date: formatDate(milestone.occurredAt),
            state: milestone.state || "upcoming",
            actorName: milestone.actorName || lead?.employeeName || "",
            type: "milestone",
          });
        }
        if (milestone && milestone.dueAt) {
          dueDates.push({
            id: `due-${project.projectId}-${milestone.id}`,
            projectId: project.projectId,
            projectName: project.projectName,
            label: milestone.label || "Due Date",
            description: milestone.description || "",
            dueDate: formatDate(milestone.dueAt),
            type: "milestone-due",
          });
        }
      });
    }

    // Extract due dates from readiness checklist
    if (
      project.readinessChecklist &&
      Array.isArray(project.readinessChecklist.items)
    ) {
      project.readinessChecklist.items.forEach((item) => {
        if (item && item.dueDate) {
          dueDates.push({
            id: `readiness-${project.projectId}-${item.id}`,
            projectId: project.projectId,
            projectName: project.projectName,
            label: item.title || item.id || "Readiness Task",
            description: item.description || "",
            dueDate: formatDate(item.dueDate),
            status: item.status || "not_started",
            ownerName: item.ownerName || "",
            type: "readiness",
          });
        }
      });
    }

    // Add project timeline entry
    if (project.startDate) {
      projectTimelines.push({
        projectId: project.projectId,
        projectName: project.projectName,
        clientName: project.clientName || "",
        startDate: formatDate(project.startDate),
        endDate: project.endDate ? formatDate(project.endDate) : null,
        status: project.status || "draft",
        leadName: lead?.employeeName || "",
        leadDepartment: lead?.department || "",
        leadEmail: lead?.emailId || "",
        leadAvatarUrl: lead?.avatarUrl || null,
        readinessScore:
          typeof project.readinessScore === "number"
            ? project.readinessScore
            : normalizeReadinessChecklist(project.readinessChecklist).percent,
        teamSize: teamSizeByProject.get(project.projectId) ?? 0,
      });
    }
  });

  // Sort milestones by date
  milestones.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // Sort due dates by date
  dueDates.sort((a, b) => {
    const dateA = new Date(a.dueDate);
    const dateB = new Date(b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });

  // Get upcoming reminders (due dates within next 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const upcomingReminders = dueDates.filter((item) => {
    const dueDate = new Date(item.dueDate);
    return dueDate >= now && dueDate <= thirtyDaysFromNow;
  });

  return {
    milestones,
    dueDates,
    projectTimelines,
    upcomingReminders,
    totalProjects: projectTimelines.length,
    totalMilestones: milestones.length,
    totalDueDates: dueDates.length,
  };
}

export async function buildApiStatus() {
  const startTime = Date.now();

  // Import monitoring functions
  const {
    getPerformanceHistory,
    getRecentActivity,
    getOverallStats,
    getEndpointHealth,
    getUptime,
  } = await import("./monitoring.mjs");

  // Check database connectivity and get counts
  let dbStatus = "healthy";
  let dbResponseTime = 0;
  let employeeCount = 0;
  let projectCount = 0;
  let assignmentCount = 0;
  let departmentCount = 0;

  try {
    const dbStartTime = Date.now();
    const [employees, projects, assignments, departments] = await Promise.all([
      prisma.employee.count(),
      prisma.project.count(),
      prisma.projectEmployee.count(),
      prisma.departmentParent.count(),
    ]);
    dbResponseTime = Date.now() - dbStartTime;
    employeeCount = employees;
    projectCount = projects;
    assignmentCount = assignments;
    departmentCount = departments;
  } catch (error) {
    console.error("[API Status] Database check failed:", error);
    dbStatus = "unhealthy";
    dbResponseTime = -1;
  }

  // Get real monitoring data
  const performanceHistory = getPerformanceHistory(7);
  const recentActivity = getRecentActivity(20);
  const overallStats = getOverallStats();
  const endpointHealth = getEndpointHealth();
  const uptime = getUptime();

  // Calculate metrics from real data
  const totalEndpoints = 27; // From API documentation
  const activeEndpoints = dbStatus === "healthy" ? totalEndpoints : 0;

  // Use real stats if available, otherwise fallback to database-based estimates
  const successRate =
    overallStats.totalRequests > 0
      ? overallStats.successRate
      : dbStatus === "healthy"
      ? 99.5
      : 0;
  const avgResponseTime =
    overallStats.totalRequests > 0
      ? overallStats.avgResponseTime
      : dbResponseTime > 0
      ? Math.round(dbResponseTime)
      : 150;
  const totalRequests =
    overallStats.totalRequests > 0
      ? overallStats.totalRequests
      : performanceHistory.reduce((sum, day) => sum + day.requests, 0);
  const errorRate =
    overallStats.totalRequests > 0
      ? overallStats.errorRate
      : Math.round((100 - successRate) * 10) / 10;

  // System health metrics
  const systemHealth = {
    database: {
      status: dbStatus,
      responseTime: dbResponseTime,
      connected: dbStatus === "healthy",
    },
    api: {
      status: dbStatus === "healthy" ? "operational" : "degraded",
      uptime: `${uptime.percentage}%`,
      totalRequests,
      avgResponseTime,
      successRate: Math.round(successRate * 10) / 10,
    },
    data: {
      employees: employeeCount,
      projects: projectCount,
      assignments: assignmentCount,
      departments: departmentCount,
    },
  };

  // Determine overall status
  let overallStatus = "operational";
  if (dbStatus !== "healthy") {
    overallStatus = "down";
  } else if (successRate < 95) {
    overallStatus = "degraded";
  } else if (uptime.percentage < 99) {
    overallStatus = "degraded";
  }

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    systemHealth,
    endpointHealth,
    performanceHistory,
    recentActivity,
    metrics: {
      totalEndpoints,
      activeEndpoints,
      successRate: Math.round(successRate * 10) / 10,
      avgResponseTime,
      totalRequests,
      errorRate,
    },
  };
}

export async function getProjectStakeholderEmails(projectId) {
  const numericId = Number(projectId);
  if (!numericId) {
    return { to: [], cc: [], bcc: [] };
  }

  const [project, activeAssignments] = await Promise.all([
    prisma.project.findUnique({
      where: { projectId: numericId },
      select: {
        leadByEmpId: true,
        sponsorEmpId: true,
        contactPerson: true,
        emailId: true,
        resourcesPlan: true,
        cmsContentRefs: true,
      },
    }),
    prisma.projectEmployee.findMany({
      where: { projectId: numericId, isActive: true },
      select: { empId: true, isActive: true },
    }),
  ]);
  if (!project) {
    return { to: [], cc: [], bcc: [] };
  }

  return resolveStakeholderEmails(project, activeAssignments);
}

/**
 * Recipients for a project: contact email, lead/sponsor, active assignees,
 * resource-plan stakeholders and CMS-notified emails. Works from an already
 * loaded (possibly deleted) project and its assignments.
 */
export async function resolveStakeholderEmails(project, assignments = []) {
  const to = new Set();
  const addEmail = (email) => {
    const value = email?.toString?.() ?? "";
    if (value.includes("@")) {
      to.add(value);
    }
  };

  addEmail(project.emailId);

  const employeeIds = [
    project.leadByEmpId,
    project.sponsorEmpId,
    ...assignments
      .filter((assignment) => assignment.isActive === true)
      .map((assignment) => assignment.empId),
  ].filter((id) => id !== null && id !== undefined);

  if (employeeIds.length > 0) {
    const employees = await prisma.employee.findMany({
      where: { employeeId: { in: [...new Set(employeeIds)] } },
      select: { emailId: true },
    });
    employees.forEach((employee) => addEmail(employee.emailId));
  }

  const planStakeholders = Array.isArray(project.resourcesPlan?.stakeholders)
    ? project.resourcesPlan.stakeholders
    : [];
  planStakeholders.forEach((stakeholder) => addEmail(stakeholder?.email));

  const cmsRefs = Array.isArray(project.cmsContentRefs) ? project.cmsContentRefs : [];
  cmsRefs.forEach((ref) => {
    const emails = Array.isArray(ref?.metadata?.notifiedEmails)
      ? ref.metadata.notifiedEmails
      : [];
    emails.forEach(addEmail);
  });

  return { to: Array.from(to), cc: [], bcc: [] };
}

export async function fetchContentfulBrief({
  entryId,
  contentType,
  slug,
  preview = false,
}) {
  if (!entryId && !contentType) {
    throw new Error("Either entryId or contentType must be provided.");
  }

  let entry;
  if (entryId) {
    const data = await fetchContentful(`/entries/${encodeURIComponent(entryId)}`, {
      preview,
      query: { include: "2" },
    });
    entry = data;
  } else if (contentType && slug) {
    const data = await fetchContentful("/entries", {
      preview,
      query: {
        content_type: contentType,
        "fields.slug": slug,
        limit: "1",
        include: "2",
      },
    });
    entry = data?.items?.[0];
  } else if (contentType) {
    const data = await fetchContentful("/entries", {
      preview,
      query: {
        content_type: contentType,
        limit: "1",
        include: "2",
        order: "-sys.updatedAt",
      },
    });
    entry = data?.items?.[0];
  }

  if (!entry) {
    throw clientError(404, "Contentful entry not found.");
  }

  return buildContentfulBrief(entry);
}

export async function generateOverviewDraft(payload) {
  // Multi-provider free-tier chain: Gemini → Groq → OpenRouter :free → Hugging Face.
  const prompt = buildOverviewPrompt(payload ?? {});
  const completion = await completeChatWithFallback(prompt);

  if (!completion.ok) {
    throw new Error(
      completion.message ||
        "No AI providers available. Configure GOOGLE_GEMINI_API_KEY, GROQ_LLAMA_API_KEY, OPENROUTER_API_KEY, or HUGGINGFACE_API_KEY."
    );
  }

  const overview = parseOverviewJson(completion.text);
  return {
    source: completion.provider,
    model: completion.model,
    overview,
    raw: completion.text,
    prompt,
  };
}
