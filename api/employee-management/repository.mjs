import { prisma } from "../_lib/prisma-client.mjs";
import { getStore } from "./store.mjs";
import { MongoClient } from "mongodb";
import { completeChatWithFallback } from "./ai-providers.mjs";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const DEFAULT_COUNTER_SEEDS = {
  employee: 1000,
  project: 5000,
  projectEmployee: 7000,
};

let bootstrapPromise;

const READINESS_DEFINITIONS = [
  {
    id: "scopeDefined",
    title: "Scope confirmed",
    description: "Requirements baseline captured and shared with stakeholders.",
    category: "Scope",
    weight: 25,
  },
  {
    id: "budgetApproved",
    title: "Budget approved",
    description: "Finance sign-off received for the projected spend.",
    category: "Budget",
    weight: 20,
  },
  {
    id: "legalReviewed",
    title: "Contracts reviewed",
    description: "Master services agreement and NDAs cleared with legal.",
    category: "Legal",
    weight: 20,
  },
  {
    id: "assetsPrepared",
    title: "Assets prepared",
    description: "Brand assets, data rooms, and collateral ready to share.",
    category: "Assets",
    weight: 15,
  },
  {
    id: "kickoffScheduled",
    title: "Kickoff scheduled",
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

async function getCounterValue(key) {
  return prisma.counter.findUnique({
    where: { key },
    select: { value: true },
  });
}

async function ensureCounterSeed(key, seedValue) {
  const target = seedValue ?? DEFAULT_COUNTER_SEEDS[key] ?? 1;
  return prisma.counter.upsert({
    where: { key },
    create: { key, value: target },
    update: {},
    select: { value: true },
  });
}

async function getNextSequenceValue(key, startAt) {
  const seed = startAt ?? DEFAULT_COUNTER_SEEDS[key] ?? 1;
  const existing = await getCounterValue(key);
  if (!existing) {
    await prisma.counter.create({
      data: {
        key,
        value: seed - 1,
      },
    });
  }

  // Try Prisma update first
  let updateResult = null;
  try {
    updateResult = await prisma.counter.update({
      where: { key },
      data: {
        value: { increment: 1 },
      },
      select: { value: true },
    });
  } catch (error) {
      }

  // If Prisma update failed or returned null, use MongoDB native driver
  if (!updateResult || !updateResult.value) {
    const databaseUrl =
      process.env.NG_APP_PRISMA_URL ||
      process.env.NG_APP_MONGODB_URI ||
      process.env.DATABASE_URL ||
      process.env.MONGODB_URI;
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }
    
    const client = new MongoClient(databaseUrl);
    try {
      await client.connect();
      
      // Extract database name from connection string
      const dbName = databaseUrl.split("/").pop()?.split("?")[0] || "employee_management_db";
      const db = client.db(dbName);
      const collection = db.collection("Counter");
      
      // Use MongoDB $inc to increment the counter
      const mongoResult = await collection.findOneAndUpdate(
        { key },
        { $inc: { value: 1 } },
        { 
          returnDocument: 'after',
          upsert: false // Don't create if doesn't exist (should exist from create above)
        }
      );
      
      if (!mongoResult || !mongoResult.value) {
        throw new Error(`Failed to increment counter for key ${key}`);
      }
      
      // Fetch the updated value using Prisma
      const counter = await prisma.counter.findUnique({
        where: { key },
        select: { value: true },
      });
      
      if (!counter) {
        throw new Error(`Counter not found after MongoDB increment for key ${key}`);
      }
      
      return counter.value;
    } finally {
      await client.close();
    }
  }

  return updateResult.value;
}

async function ensureBootstrapData() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const [parentCount, employeeCount, projectCount, projectEmployeeCount] =
        await Promise.all([
          prisma.departmentParent.count(),
          prisma.employee.count(),
          prisma.project.count(),
          prisma.projectEmployee.count(),
        ]);

      if (
        parentCount > 0 ||
        employeeCount > 0 ||
        projectCount > 0 ||
        projectEmployeeCount > 0
      ) {
        return;
      }

      const store = await getStore();

      const parentDepartments = store.departments?.parents ?? [];
      const childDepartments = store.departments?.children ?? [];
      const employees = store.employees ?? [];
      const projects = store.projects ?? [];
      const projectEmployees = store.projectEmployees ?? [];
      const nextIds = store.nextIds ?? {};

      if (parentDepartments.length > 0) {
        await prisma.departmentParent.createMany({
          data: parentDepartments.map((parent) => ({
            departmentId: parent.departmentId,
            departmentName: parent.departmentName,
            departmentLogo: parent.departmentLogo ?? null,
            description: parent.description ?? null,
            leadContact: parent.leadContact ?? null,
            leadEmail: parent.leadEmail ?? null,
            leadPhone: parent.leadPhone ?? null,
          })),
        });
      }

      if (childDepartments.length > 0) {
        await prisma.departmentChild.createMany({
          data: childDepartments.map((child) => ({
            childDeptId: child.childDeptId,
            departmentName: child.departmentName,
            parentDeptId: child.parentDeptId,
            description: child.description ?? null,
          })),
        });
      }

      if (employees.length > 0) {
        await prisma.employee.createMany({
          data: employees.map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            contactNo: employee.contactNo ?? null,
            emailId: employee.emailId ?? null,
            deptId: employee.deptId ?? null,
            department: employee.department ?? null,
            password: employee.password ?? null,
            gender: employee.gender ?? null,
            role: employee.role ?? null,
            title: employee.title ?? null,
            avatarUrl: employee.avatarUrl ?? null,
            location: employee.location ?? null,
            timezone: employee.timezone ?? null,
            employmentType: employee.employmentType ?? null,
            managerId: employee.managerId ?? null,
            hireDate: toDate(employee.hireDate) ?? toDate(employee.createdAt),
            bio: employee.bio ?? null,
            about: employee.about ?? null,
            notes: employee.notes ?? null,
            tags: employee.tags ?? [],
            skills: employee.skills ?? [],
            certifications: employee.certifications ?? [],
            interests: employee.interests ?? [],
            languages: employee.languages ?? [],
            socialLinks: employee.socialLinks ?? null,
            workPreferences: employee.workPreferences ?? null,
            availability: employee.availability ?? null,
            preferences: employee.preferences ?? null,
            performanceSnapshot: employee.performanceSnapshot ?? null,
            documents: employee.documents ?? null,
            customFields: employee.customFields ?? null,
            createdAt: toDate(employee.createdAt) ?? new Date(),
            updatedAt: new Date(),
            isActive: employee.isActive !== false,
            lastActiveAt: toDate(employee.lastActiveAt),
          })),
        });
      }

      if (projects.length > 0) {
        await prisma.project.createMany({
          data: projects.map((project) => ({
            projectId: project.projectId,
            projectName: project.projectName,
            clientName: project.clientName ?? null,
            clientIndustry: project.clientIndustry ?? null,
            startDate: toDate(project.startDate),
            endDate: toDate(project.endDate),
            leadByEmpId: project.leadByEmpId
              ? Number(project.leadByEmpId)
              : null,
            sponsorEmpId: project.sponsorEmpId
              ? Number(project.sponsorEmpId)
              : null,
            contactPerson: project.contactPerson ?? null,
            contactNo: project.contactNo ?? null,
            emailId: project.emailId ?? null,
            contactTitle: project.contactTitle ?? null,
            contactNotes: project.contactNotes ?? null,
            overview: project.overview ?? null,
            scope: project.scope ?? null,
            successMetrics: project.successMetrics ?? null,
            status: project.status ?? "active",
            statusReason: project.statusReason ?? null,
            statusHistory: project.statusHistory ?? null,
            timeline: project.timeline ?? null,
            milestones: project.milestones ?? null,
            categories: project.categories ?? [],
            tags: project.tags ?? [],
            focusAreas: project.focusAreas ?? [],
            blockers: project.blockers ?? null,
            risks: project.risks ?? null,
            riskRegister: project.riskRegister ?? null,
            budget: project.budget ?? null,
            financials: project.financials ?? null,
            resourcesPlan: project.resourcesPlan ?? null,
            readinessChecklist: project.readinessChecklist ?? null,
            readinessScore: project.readinessScore ?? null,
            approvalStatus: project.approvalStatus ?? "draft",
            approvalRequestedAt: toDate(project.approvalRequestedAt),
            approvalRequestedBy: project.approvalRequestedBy
              ? Number(project.approvalRequestedBy)
              : null,
            approvalResolvedAt: toDate(project.approvalResolvedAt),
            approvalResolvedBy: project.approvalResolvedBy
              ? Number(project.approvalResolvedBy)
              : null,
            approvalReason: project.approvalReason ?? null,
            approvalNotes: project.approvalNotes ?? null,
            reviewerComments: project.reviewerComments ?? null,
            progress: project.progress ?? null,
            health: project.health ?? null,
            documents: project.documents ?? null,
            externalLinks: project.externalLinks ?? null,
            aiGeneratedInsights: project.aiGeneratedInsights ?? null,
            cmsContentRefs: project.cmsContentRefs ?? null,
            lastSyncedAt: toDate(project.lastSyncedAt),
            stageGate: project.stageGate ?? null,
            governance: project.governance ?? null,
            communicationPlan: project.communicationPlan ?? null,
            createdAt: toDate(project.createdAt) ?? new Date(),
            updatedAt: new Date(),
            archivedAt: toDate(project.archivedAt),
          })),
        });
      }

      if (projectEmployees.length > 0) {
        await prisma.projectEmployee.createMany({
          data: projectEmployees.map((assignment) => ({
            empProjectId: assignment.empProjectId,
            projectId: assignment.projectId
              ? Number(assignment.projectId)
              : null,
            empId: assignment.empId ? Number(assignment.empId) : null,
            assignedDate: toDate(assignment.assignedDate),
            role: assignment.role ?? null,
            isActive:
              assignment.isActive === "Y" ||
              assignment.isActive === "true" ||
              assignment.isActive === true,
            allocationPct: assignment.allocationPct ?? null,
            billable:
              typeof assignment.billable === "boolean"
                ? assignment.billable
                : assignment.billable === "Y" || assignment.billable === "true",
            billingRate: assignment.billingRate ?? null,
            costRate: assignment.costRate ?? null,
            notes: assignment.notes ?? null,
            responsibilities: assignment.responsibilities ?? [],
            skillsApplied: assignment.skillsApplied ?? [],
            toolsUsed: assignment.toolsUsed ?? [],
            schedule: assignment.schedule ?? null,
            contribution: assignment.contribution ?? null,
            createdAt: toDate(assignment.createdAt) ?? new Date(),
            updatedAt: new Date(),
            unassignedAt: toDate(assignment.unassignedAt),
          })),
        });
      }

      await Promise.all(
        Object.entries(nextIds).map(([key, value]) => {
          const numericValue = Number(value);
          if (Number.isNaN(numericValue)) {
            return Promise.resolve();
          }
          return prisma.counter.upsert({
            where: { key },
            update: { value: numericValue - 1 },
            create: { key, value: numericValue - 1 },
          });
        })
      );

      await Promise.all(
        Object.keys(DEFAULT_COUNTER_SEEDS).map((key) =>
          ensureCounterSeed(key, DEFAULT_COUNTER_SEEDS[key] - 1)
        )
      );
    })().catch((error) => {
      console.error(
        "[employee-management][repository] Failed to bootstrap MongoDB data:",
        error
      );
      throw error;
    });
  }

  return bootstrapPromise;
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
      throw new Error(`Record not found with ${whereField} ${whereValue}`);
    }
  }
  
  // If Prisma update failed or returned null, use MongoDB native driver
  if (!updateSucceeded) {
    const databaseUrl =
      process.env.NG_APP_PRISMA_URL ||
      process.env.NG_APP_MONGODB_URI ||
      process.env.DATABASE_URL ||
      process.env.MONGODB_URI;
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }
    
    const client = new MongoClient(databaseUrl);
    try {
      await client.connect();
      
      // Extract database name from connection string
      const dbName = databaseUrl.split("/").pop()?.split("?")[0] || "employee_management_db";
      const db = client.db(dbName);
      const collection = db.collection(mongoCollectionName);
      
      // Perform the update using native driver
      const updateResult = await collection.updateOne(
        { [whereField]: whereValue },
        { $set: updateData }
      );
      
      if (updateResult.matchedCount === 0) {
        throw new Error(`No record found with ${whereField} ${whereValue}`);
      }
      
      // Fetch the updated record using Prisma
      record = await fetchAfterUpdate();
      
      if (!record) {
        throw new Error(`Record not found after MongoDB native update for ${whereField} ${whereValue}`);
      }
    } finally {
      await client.close();
    }
  }
  
  return record;
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
  await ensureBootstrapData();
  return prisma.departmentParent.findMany({
    orderBy: { departmentId: "asc" },
  });
}

export async function listChildDepartmentsByParent(parentDeptId) {
  await ensureBootstrapData();
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
  await ensureBootstrapData();
  const employees = await prisma.employee.findMany({
    orderBy: { employeeId: "asc" },
  });
  return employees.map(mapEmployee);
}

export async function createEmployee(payload) {
  await ensureBootstrapData();

  // Validate required fields
  if (!payload.employeeName) {
    throw new Error("employeeName is required to create an employee");
  }

  const employeeId = await getNextSequenceValue("employee");
  const departmentName = await resolveDepartmentNameByChildId(
    payload.deptId,
    payload.department
  );

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
  await ensureBootstrapData();

  // Verify the record exists before attempting to update
  const existingRecord = await prisma.employee.findUnique({
    where: { employeeId: Number(employeeId) },
  });

  if (!existingRecord) {
    throw new Error(`Employee with employeeId ${employeeId} not found`);
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
  if (payload.deptId !== undefined || payload.department !== undefined) {
    const departmentName = await resolveDepartmentNameByChildId(
      payload.deptId,
      payload.department
    );
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
  await ensureBootstrapData();

  // Fetch employee data before deleting for notification purposes
  const employee = await prisma.employee.findUnique({
    where: { employeeId: Number(employeeId) },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  // Delete related project employees first
  await prisma.projectEmployee.deleteMany({
    where: { empId: Number(employeeId) },
  });

  // Delete the employee
  await prisma.employee.delete({
    where: { employeeId: Number(employeeId) },
  });

  // Return the deleted employee data for notification
  return mapEmployee(employee);
}

function mapProject(project) {
  if (!project) {
    return project;
  }

  const readiness = normalizeReadinessChecklist(project.readinessChecklist);
  const statusHistory = normalizeStatusHistory(project.statusHistory);
  const timeline = normalizeTimelineEntries(project.timeline);
  const reviewerComments = normalizeReviewerComments(project.reviewerComments);
  const approvalStatus = normalizeApprovalStatus(project.approvalStatus);

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    clientName: project.clientName ?? "",
    clientIndustry: project.clientIndustry ?? "",
    startDate: formatDate(project.startDate),
    endDate: formatDate(project.endDate),
    leadByEmpId:
      typeof project.leadByEmpId === "number"
        ? project.leadByEmpId
        : project.leadByEmpId
        ? Number(project.leadByEmpId)
        : null,
    sponsorEmpId: project.sponsorEmpId ?? undefined,
    contactPerson: project.contactPerson ?? "",
    contactNo: project.contactNo ?? "",
    emailId: project.emailId ?? "",
    contactTitle: project.contactTitle ?? "",
    contactNotes: project.contactNotes ?? "",
    overview: project.overview ?? {},
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
  };
}

export async function listProjects() {
  await ensureBootstrapData();
  const projects = await prisma.project.findMany({
    orderBy: { projectId: "asc" },
  });
  return projects.map(mapProject);
}

export async function getProject(projectId) {
  await ensureBootstrapData();
  const project = await prisma.project.findUnique({
    where: { projectId: Number(projectId) },
  });
  return mapProject(project);
}

export async function getProjectResourceInsights(projectId) {
  await ensureBootstrapData();
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
        select: { projectId: true, projectName: true },
      }),
    ]);

  const projectLookup = new Map(projects.map((item) => [item.projectId, item]));
  const employeeLookup = new Map(
    employees.map((employee) => [employee.employeeId, employee])
  );
  const summaryMap = buildAssignmentSummary(activeAssignments, projectLookup);

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
    activeAssignmentCount: activeAssignments.length,
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
  await ensureBootstrapData();

  // Validate required fields
  if (!payload.projectName) {
    throw new Error("projectName is required to create a project");
  }

  const projectId = await getNextSequenceValue("project");
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
      leadByEmpId: payload.leadByEmpId ? Number(payload.leadByEmpId) : null,
      sponsorEmpId: payload.sponsorEmpId ? Number(payload.sponsorEmpId) : null,
      contactPerson: payload.contactPerson ?? null,
      contactNo: payload.contactNo ?? null,
      emailId: payload.emailId ?? null,
      contactTitle: payload.contactTitle ?? null,
      contactNotes: payload.contactNotes ?? null,
      overview: payload.overview ?? null,
      scope: payload.scope ?? null,
      successMetrics: payload.successMetrics ?? [],
      status: payload.status ?? "draft",
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

  // Verify the record was created (should never be null after successful create)
  if (!record) {
    throw new Error("Failed to create project record");
  }

  return mapProject(record);
}

export async function updateProject(projectId, payload) {
  await ensureBootstrapData();

  // Verify the record exists before attempting to update
  const existingRecord = await prisma.project.findUnique({
    where: { projectId: Number(projectId) },
  });

  if (!existingRecord) {
    throw new Error(`Project with projectId ${projectId} not found`);
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
  if (payload.statusHistory !== undefined) {
    updateData.statusHistory = normalizeStatusHistory(payload.statusHistory);
  }
  if (payload.timeline !== undefined) {
    updateData.timeline = normalizeTimelineEntries(payload.timeline);
  }
  if (payload.reviewerComments !== undefined) {
    updateData.reviewerComments = normalizeReviewerComments(
      payload.reviewerComments
    );
  }
  if (payload.approvalStatus !== undefined) {
    updateData.approvalStatus = normalizeApprovalStatus(payload.approvalStatus);
  }

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
  if (payload.status !== undefined) {
    updateData.status = payload.status ?? "draft";
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
  if (payload.approvalRequestedAt !== undefined) {
    updateData.approvalRequestedAt = toDate(payload.approvalRequestedAt);
  }
  if (payload.approvalRequestedBy !== undefined) {
    updateData.approvalRequestedBy = payload.approvalRequestedBy
      ? Number(payload.approvalRequestedBy)
      : null;
  }
  if (payload.approvalResolvedAt !== undefined) {
    updateData.approvalResolvedAt = toDate(payload.approvalResolvedAt);
  }
  if (payload.approvalResolvedBy !== undefined) {
    updateData.approvalResolvedBy = payload.approvalResolvedBy
      ? Number(payload.approvalResolvedBy)
      : null;
  }
  if (payload.approvalReason !== undefined) {
    updateData.approvalReason = payload.approvalReason ?? null;
  }
  if (payload.approvalNotes !== undefined) {
    updateData.approvalNotes = payload.approvalNotes ?? {};
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
    return mapProject(existingRecord);
  }

  // Use MongoDB native driver fallback for update
  const record = await updateWithMongoFallback(
    "project",
    "projectId",
    Number(projectId),
    updateData,
    async () => {
      return await prisma.project.findUnique({
        where: { projectId: Number(projectId) },
      });
    }
  );

  if (!record) {
    throw new Error(`Failed to update project with projectId ${projectId}`);
  }

  return mapProject(record);
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
    label: `${APPROVAL_LABELS[status] ?? status} status`,
    description: comment && comment.trim().length ? comment.trim() : undefined,
    state: "completed",
    occurredAt: new Date().toISOString(),
    status,
    actorId: actorId ?? null,
    actorName: actorName ?? undefined,
  };
}

export async function transitionProjectApproval(projectId, action, payload) {
  await ensureBootstrapData();
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
    return mapProject(project);
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
    status: nextStatus,
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

  return mapProject(updated);
}

export async function addProjectReviewerComment(projectId, payload) {
  await ensureBootstrapData();
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

  return mapProject(updated);
}

export async function resolveProjectReviewerComment(
  projectId,
  commentId,
  payload
) {
  await ensureBootstrapData();
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

  return mapProject(updated);
}

export async function deleteProject(projectId) {
  await ensureBootstrapData();

  // Fetch project data before deleting for notification purposes
  const project = await prisma.project.findUnique({
    where: { projectId: Number(projectId) },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Map project to get formatted data
  const mappedProject = mapProject(project);

  // Delete related project employees first
  await prisma.projectEmployee.deleteMany({
    where: { projectId: Number(projectId) },
  });

  // Delete the project
  await prisma.project.delete({
    where: { projectId: Number(projectId) },
  });

  // Return the deleted project data for notification
  return mappedProject;
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

export async function listProjectEmployees() {
  await ensureBootstrapData();

  const [projectEmployees, projects, employees] = await Promise.all([
    prisma.projectEmployee.findMany({
      orderBy: { empProjectId: "asc" },
    }),
    prisma.project.findMany({
      select: { projectId: true, projectName: true },
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

  return projectEmployees.map((item) =>
    mapProjectEmployee(item, projectLookup, employeeLookup)
  );
}

export async function createProjectEmployee(payload) {
  await ensureBootstrapData();

  // Validate required fields
  if (!payload.projectId) {
    throw new Error(
      "projectId is required to create a project employee assignment"
    );
  }
  if (!payload.empId) {
    throw new Error(
      "empId is required to create a project employee assignment"
    );
  }

  const empProjectId = await getNextSequenceValue("projectEmployee");

  const record = await prisma.projectEmployee.create({
    data: {
      empProjectId,
      projectId: Number(payload.projectId),
      empId: Number(payload.empId),
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
  });

  // Verify the record was created (should never be null after successful create)
  if (!record) {
    throw new Error("Failed to create project employee assignment record");
  }

  const [projectLookup, employeeLookup] = await Promise.all([
    prisma.project.findMany({
      select: { projectId: true, projectName: true },
    }),
    prisma.employee.findMany({
      select: { employeeId: true, employeeName: true, emailId: true, avatarUrl: true },
    }),
  ]);

  const mapped = mapProjectEmployee(
    record,
    new Map(projectLookup.map((item) => [item.projectId, item])),
    new Map(employeeLookup.map((item) => [item.employeeId, item]))
  );

  // Add employee email for notification purposes
  const employee = employeeLookup.find((e) => e.employeeId === record.empId);
  if (employee) {
    mapped.employeeEmail = employee.emailId;
  }

  return mapped;
}

export async function updateProjectEmployee(empProjectId, payload) {
  await ensureBootstrapData();

      // Verify the record exists before attempting to update
  const existingRecord = await prisma.projectEmployee.findUnique({
    where: { empProjectId: Number(empProjectId) },
  });

  if (!existingRecord) {
    throw new Error(`Project employee assignment with empProjectId ${empProjectId} not found`);
  }

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

    // If no fields to update, return the existing record
  if (Object.keys(updateData).length === 0) {
        // Fetch lookups and return mapped existing record
    const [projectLookup, employeeLookup] = await Promise.all([
      prisma.project.findMany({
        select: { projectId: true, projectName: true },
      }),
      prisma.employee.findMany({
        select: { employeeId: true, employeeName: true, emailId: true, avatarUrl: true },
      }),
    ]);

    const mapped = mapProjectEmployee(
      existingRecord,
      new Map(projectLookup.map((item) => [item.projectId, item])),
      new Map(employeeLookup.map((item) => [item.employeeId, item]))
    );

    // Add employee email for notification purposes
    const employee = employeeLookup.find((e) => e.employeeId === existingRecord.empId);
    if (employee) {
      mapped.employeeEmail = employee.emailId;
    }

    return mapped;
  }

  let record;
  try {
        
    // Try Prisma update first
    let updateSucceeded = false;
    try {
      const updateResult = await prisma.projectEmployee.update({
        where: { empProjectId: Number(empProjectId) },
        data: updateData,
      });
      if (updateResult) {
        record = updateResult;
        updateSucceeded = true;
              } else {
              }
    } catch (updateError) {
            if (updateError.code === 'P2025') {
        throw new Error(`Record with empProjectId ${empProjectId} not found`);
      }
    }
    
    // If Prisma update failed or returned null, use MongoDB native driver
    if (!updateSucceeded) {
            
      const databaseUrl =
        process.env.NG_APP_PRISMA_URL ||
        process.env.NG_APP_MONGODB_URI ||
        process.env.DATABASE_URL ||
        process.env.MONGODB_URI;
      
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not found in environment variables");
      }
      
      const client = new MongoClient(databaseUrl);
      try {
        await client.connect();
                
        // Extract database name from connection string
        const dbName = databaseUrl.split("/").pop()?.split("?")[0] || "employee_management_db";
        const db = client.db(dbName);
        const collection = db.collection("ProjectEmployee");
        
        // Perform the update using native driver
        const updateResult = await collection.updateOne(
          { empProjectId: Number(empProjectId) },
          { $set: updateData }
        );
        
                
        if (updateResult.matchedCount === 0) {
          throw new Error(`No record found with empProjectId ${empProjectId}`);
        }
        
        if (updateResult.modifiedCount === 0) {
                  }
        
        // Fetch the updated record using Prisma
        record = await prisma.projectEmployee.findUnique({
          where: { empProjectId: Number(empProjectId) },
        });
        
        if (!record) {
          throw new Error(`Record not found after MongoDB native update for empProjectId ${empProjectId}`);
        }
        
              } finally {
        await client.close();
      }
    }
    
      } catch (error) {
    console.error(`[updateProjectEmployee] Prisma update error for empProjectId ${empProjectId}:`, error);
    console.error(`[updateProjectEmployee] Error code:`, error.code);
    console.error(`[updateProjectEmployee] Error message:`, error.message);
    console.error(`[updateProjectEmployee] Error meta:`, error.meta);
    console.error(`[updateProjectEmployee] Error stack:`, error.stack);
    console.error(`[updateProjectEmployee] Update data:`, JSON.stringify(updateData, null, 2));
    
    // If it's a "record not found" error, try to fetch to confirm
    if (error.code === 'P2025') {
      const checkRecord = await prisma.projectEmployee.findUnique({
        where: { empProjectId: Number(empProjectId) },
      });
      console.error(`[updateProjectEmployee] Record check after P2025 error:`, checkRecord ? 'EXISTS' : 'NOT FOUND');
    }
    
    throw new Error(`Failed to update project employee assignment: ${error.message || error}`);
  }

  // Final safety check
  if (!record) {
    throw new Error(`Failed to update project employee assignment with empProjectId ${empProjectId}: No record available after update`);
  }

  const [projectLookup, employeeLookup] = await Promise.all([
    prisma.project.findMany({
      select: { projectId: true, projectName: true },
    }),
    prisma.employee.findMany({
      select: { employeeId: true, employeeName: true, emailId: true, avatarUrl: true },
    }),
  ]);

  const mapped = mapProjectEmployee(
    record,
    new Map(projectLookup.map((item) => [item.projectId, item])),
    new Map(employeeLookup.map((item) => [item.employeeId, item]))
  );

  // Add employee email for notification purposes
  const employee = employeeLookup.find((e) => e.employeeId === record.empId);
  if (employee) {
    mapped.employeeEmail = employee.emailId;
  }

  return mapped;
}

export async function deleteProjectEmployee(empProjectId) {
  await ensureBootstrapData();

  // Fetch assignment data before deleting for notification purposes
  const record = await prisma.projectEmployee.findUnique({
    where: { empProjectId: Number(empProjectId) },
  });

  if (!record) {
    throw new Error("Project employee assignment not found");
  }

  // Get project and employee details for notification
  const [projectLookup, employeeLookup] = await Promise.all([
    prisma.project.findMany({
      select: { projectId: true, projectName: true },
    }),
    prisma.employee.findMany({
      select: { employeeId: true, employeeName: true, emailId: true, avatarUrl: true },
    }),
  ]);

  const mapped = mapProjectEmployee(
    record,
    new Map(projectLookup.map((item) => [item.projectId, item])),
    new Map(employeeLookup.map((item) => [item.employeeId, item]))
  );

  // Add employee email for notification purposes
  const employee = employeeLookup.find((e) => e.employeeId === record.empId);
  if (employee) {
    mapped.employeeEmail = employee.emailId;
  }

  // Now delete the record
  await prisma.projectEmployee.delete({
    where: { empProjectId: Number(empProjectId) },
  });

  // Return the deleted assignment data for notification
  return mapped;
}

export async function buildDashboardSnapshot() {
  await ensureBootstrapData();

  const [
    totalEmployee,
    totalProject,
    activeAssignments,
    recentProjects,
    recentEmployees,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.project.count(),
    prisma.projectEmployee.count({
      where: { isActive: true },
    }),
    prisma.project.findMany({
      orderBy: { startDate: "desc" },
      take: 5,
      select: {
        projectId: true,
        projectName: true,
        startDate: true,
        status: true,
      },
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

  return {
    totalEmployee,
    totalProject,
    activeProjectEmployees: activeAssignments,
    recentProjects: recentProjects.map((project) => ({
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
  await ensureBootstrapData();

  const projects = await prisma.project.findMany({
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
      leadByEmpId: true,
      archivedAt: true,
    },
    orderBy: { startDate: "asc" },
  });

  const activeProjects = projects.filter((project) => !project.archivedAt);

  const employees = await prisma.employee.findMany({
    select: {
      employeeId: true,
      employeeName: true,
      department: true,
    },
  });

  const employeeMap = new Map(employees.map((emp) => [emp.employeeId, emp]));

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
  await ensureBootstrapData();
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
  await ensureBootstrapData();
  const numericId = Number(projectId);
  if (!numericId) {
    return { to: [], cc: [], bcc: [] };
  }

  const project = await prisma.project.findUnique({
    where: { projectId: numericId },
    select: {
      leadByEmpId: true,
      sponsorEmpId: true,
      contactPerson: true,
      emailId: true,
      resourcesPlan: true,
      cmsContentRefs: true,
    },
  });

  if (!project) {
    return { to: [], cc: [], bcc: [] };
  }

  const to = new Set();
  const cc = new Set();

  // Add project contact email
  if (project.emailId && project.emailId.includes("@")) {
    to.add(project.emailId);
  }

  // Add lead and sponsor emails
  const employeeIds = [project.leadByEmpId, project.sponsorEmpId].filter(
    (id) => id !== null && id !== undefined
  );
  if (employeeIds.length > 0) {
    const employees = await prisma.employee.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { emailId: true },
    });
    employees.forEach((emp) => {
      if (emp.emailId && emp.emailId.includes("@")) {
        to.add(emp.emailId);
      }
    });
  }

  // Add active project employee emails
  const activeAssignments = await prisma.projectEmployee.findMany({
    where: { projectId: numericId, isActive: true },
    select: { empId: true },
  });
  if (activeAssignments.length > 0) {
    const assignedEmployeeIds = activeAssignments.map((a) => a.empId);
    const assignedEmployees = await prisma.employee.findMany({
      where: { employeeId: { in: assignedEmployeeIds } },
      select: { emailId: true },
    });
    assignedEmployees.forEach((emp) => {
      if (emp.emailId && emp.emailId.includes("@")) {
        to.add(emp.emailId);
      }
    });
  }

  // Add stakeholders from resourcesPlan
  const planStakeholders = Array.isArray(project.resourcesPlan?.stakeholders)
    ? project.resourcesPlan.stakeholders
    : [];
  planStakeholders.forEach((stakeholder) => {
    const email = stakeholder?.email?.toString();
    if (email && email.includes("@")) {
      to.add(email);
    }
  });

  // Add notified emails from cmsContentRefs metadata
  const cmsRefs = Array.isArray(project.cmsContentRefs)
    ? project.cmsContentRefs
    : [];
  cmsRefs.forEach((ref) => {
    const emails = Array.isArray(ref?.metadata?.notifiedEmails)
      ? ref.metadata.notifiedEmails
      : [];
    emails
      .map((email) => email?.toString?.() ?? "")
      .filter((email) => email.includes("@"))
      .forEach((email) => to.add(email));
  });

  return {
    to: Array.from(to),
    cc: Array.from(cc),
    bcc: [],
  };
}

export async function fetchContentfulBrief({
  entryId,
  contentType,
  slug,
  preview = false,
}) {
  await ensureBootstrapData();
  if (!entryId && !contentType) {
    throw new Error("Either entryId or contentType must be provided.");
  }

  let entry;
  if (entryId) {
    const data = await fetchContentful(`/entries/${entryId}`, {
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
    throw new Error("Contentful entry not found.");
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
