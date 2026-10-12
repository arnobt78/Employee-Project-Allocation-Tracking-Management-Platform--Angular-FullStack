/**
 * Deterministic demo dataset: 5 employees, 4 active projects plus 1 archived,
 * 7 assignments. Every lead has an assignment and nobody is over 100% allocated.
 * Ids are plain integers (stored as Int32) and documents get driver ObjectIds.
 */

type ReadinessStatus = "not_started" | "in_progress" | "blocked" | "done";

const READINESS_WEIGHTS = {
  scopeDefined: 25,
  budgetApproved: 20,
  legalReviewed: 20,
  assetsPrepared: 15,
  kickoffScheduled: 20,
} as const;

const READINESS_TITLES: Record<keyof typeof READINESS_WEIGHTS, [string, string, string]> = {
  scopeDefined: ["Scope Confirmed", "Requirements baseline captured and shared with stakeholders.", "Scope"],
  budgetApproved: ["Budget Approved", "Finance sign-off received for the projected spend.", "Budget"],
  legalReviewed: ["Contracts Reviewed", "Master services agreement and NDAs cleared with legal.", "Legal"],
  assetsPrepared: ["Assets Prepared", "Brand assets, data rooms, and collateral ready to share.", "Assets"],
  kickoffScheduled: ["Kickoff Scheduled", "Kickoff meeting on calendar with internal and client teams.", "Timeline"],
};

const STATUS_CREDIT: Record<ReadinessStatus, number> = {
  not_started: 0,
  in_progress: 0.5,
  blocked: 0,
  done: 1,
};

export const DEPARTMENT_PARENTS = [
  {
    departmentId: 1,
    departmentName: "Engineering",
    departmentLogo: "engineering.svg",
    description: "Product engineering and platform delivery.",
    leadContact: "Ava Thompson",
    leadEmail: "ava.thompson@example.com",
    leadPhone: "+15550101001",
  },
  {
    departmentId: 2,
    departmentName: "Operations",
    departmentLogo: "operations.svg",
    description: "Customer support, logistics and service delivery.",
    leadContact: "Noah Kim",
    leadEmail: "noah.kim@example.com",
    leadPhone: "+15550101004",
  },
  {
    departmentId: 3,
    departmentName: "Human Resources",
    departmentLogo: "hr.svg",
    description: "People operations, recruiting and culture.",
    leadContact: "Mia Garcia",
    leadEmail: "mia.garcia@example.com",
    leadPhone: "+15550101005",
  },
];

export const DEPARTMENT_CHILDREN = [
  { childDeptId: 101, departmentName: "Frontend", parentDeptId: 1, description: "Web and mobile interfaces." },
  { childDeptId: 102, departmentName: "Backend", parentDeptId: 1, description: "APIs, data and integrations." },
  { childDeptId: 103, departmentName: "QA", parentDeptId: 1, description: "Test automation and release quality." },
  { childDeptId: 201, departmentName: "Logistics", parentDeptId: 2, description: "Vendor and delivery coordination." },
  { childDeptId: 202, departmentName: "Customer Support", parentDeptId: 2, description: "Client success and help desk." },
  { childDeptId: 301, departmentName: "Recruitment", parentDeptId: 3, description: "Hiring and onboarding." },
  { childDeptId: 302, departmentName: "Employee Success", parentDeptId: 3, description: "Growth, wellbeing and culture." },
];

interface EmployeeSeed {
  employeeId: number;
  employeeName: string;
  emailId: string;
  contactNo: string;
  deptId: number;
  role: string;
  title: string;
  gender: string;
  location: string;
  timezone: string;
  employmentType: string;
  managerId: number;
  hireDate: string;
  skills: string[];
  certifications: string[];
  interests: string[];
  languages: string[];
  bio: string;
}

const EMPLOYEE_SEEDS: EmployeeSeed[] = [
  {
    employeeId: 1001,
    employeeName: "Ava Thompson",
    emailId: "ava.thompson@example.com",
    contactNo: "+15550101001",
    deptId: 101,
    role: "Frontend Engineer",
    title: "Engineering Manager",
    gender: "Female",
    location: "Toronto, Canada",
    timezone: "America/Toronto",
    employmentType: "Full-time",
    managerId: 1005,
    hireDate: "2021-03-15",
    skills: ["Angular", "TypeScript", "Accessibility", "Design Systems"],
    certifications: ["AWS Certified Developer"],
    interests: ["UX research", "Mentoring"],
    languages: ["English", "French"],
    bio: "Leads frontend delivery and the shared design system.",
  },
  {
    employeeId: 1002,
    employeeName: "Liam Patel",
    emailId: "liam.patel@example.com",
    contactNo: "+15550101002",
    deptId: 102,
    role: "Backend Engineer",
    title: "Staff Backend Engineer",
    gender: "Male",
    location: "Austin, USA",
    timezone: "America/Chicago",
    employmentType: "Full-time",
    managerId: 1001,
    hireDate: "2020-08-03",
    skills: ["Node.js", "MongoDB", "Prisma", "Event-driven design"],
    certifications: ["MongoDB Associate Developer"],
    interests: ["Distributed systems", "Cycling"],
    languages: ["English", "Hindi"],
    bio: "Owns the data platform and the public API.",
  },
  {
    employeeId: 1003,
    employeeName: "Sofia Martinez",
    emailId: "sofia.martinez@example.com",
    contactNo: "+15550101003",
    deptId: 103,
    role: "QA Engineer",
    title: "QA Lead",
    gender: "Female",
    location: "Madrid, Spain",
    timezone: "Europe/Madrid",
    employmentType: "Full-time",
    managerId: 1001,
    hireDate: "2022-01-10",
    skills: ["Playwright", "Test strategy", "Jasmine", "Performance testing"],
    certifications: ["ISTQB Advanced Test Manager"],
    interests: ["Automation", "Photography"],
    languages: ["Spanish", "English"],
    bio: "Runs release quality and test automation.",
  },
  {
    employeeId: 1004,
    employeeName: "Noah Kim",
    emailId: "noah.kim@example.com",
    contactNo: "+15550101004",
    deptId: 202,
    role: "Support Operations",
    title: "Support Operations Manager",
    gender: "Male",
    location: "Seoul, South Korea",
    timezone: "Asia/Seoul",
    employmentType: "Contract",
    managerId: 1005,
    hireDate: "2023-05-22",
    skills: ["Service design", "Zendesk", "SLA management"],
    certifications: ["ITIL 4 Foundation"],
    interests: ["Customer experience", "Running"],
    languages: ["Korean", "English"],
    bio: "Keeps client support and escalations on track.",
  },
  {
    employeeId: 1005,
    employeeName: "Mia Garcia",
    emailId: "mia.garcia@example.com",
    contactNo: "+15550101005",
    deptId: 302,
    role: "People Partner",
    title: "Head of People",
    gender: "Female",
    location: "Lisbon, Portugal",
    timezone: "Europe/Lisbon",
    employmentType: "Part-time",
    managerId: 1001,
    hireDate: "2019-11-04",
    skills: ["Change management", "Coaching", "Workforce planning"],
    certifications: ["SHRM-CP"],
    interests: ["Organisational design", "Yoga"],
    languages: ["Portuguese", "English", "Spanish"],
    bio: "Sponsors delivery programmes and leads people operations.",
  },
];

const departmentName = (childDeptId: number) =>
  DEPARTMENT_CHILDREN.find((dept) => dept.childDeptId === childDeptId)?.departmentName ?? "";

const employeeName = (employeeId: number) =>
  EMPLOYEE_SEEDS.find((emp) => emp.employeeId === employeeId)?.employeeName ?? "";

export const EMPLOYEES = EMPLOYEE_SEEDS.map((emp) => ({
  ...emp,
  department: departmentName(emp.deptId),
  hireDate: new Date(emp.hireDate),
  avatarUrl: null,
  about: `${emp.employeeName} works as ${emp.title} in ${departmentName(emp.deptId)}.`,
  notes: "Demo profile.",
  tags: [departmentName(emp.deptId).toLowerCase(), emp.employmentType.toLowerCase()],
  socialLinks: { linkedin: `https://www.linkedin.com/in/${emp.emailId.split("@")[0]}` },
  workPreferences: { remote: true, hoursPerWeek: emp.employmentType === "Part-time" ? 24 : 40 },
  availability: { status: "available", capacityPct: 100 },
  preferences: { notifications: "email" },
  performanceSnapshot: { rating: 4, lastReview: "2026-06-30" },
  documents: [],
  customFields: {},
  isActive: true,
  lastActiveAt: new Date("2026-10-09T09:00:00.000Z"),
}));

interface ProjectSeed {
  projectId: number;
  projectName: string;
  clientName: string;
  clientIndustry: string;
  startDate: string;
  endDate: string;
  leadByEmpId: number;
  sponsorEmpId: number;
  contact: { name: string; email: string; phone: string; title: string };
  status: string;
  approvalStatus: "draft" | "in_review" | "approved";
  health: "on_track" | "at_risk" | "off_track";
  progress: number;
  summary: string;
  objectives: string[];
  readiness: Record<keyof typeof READINESS_WEIGHTS, ReadinessStatus>;
  budgetTotal: number;
  budgetSpent: number;
  tags: string[];
  archivedAt?: string;
}

const PROJECT_SEEDS: ProjectSeed[] = [
  {
    projectId: 5001,
    projectName: "Aurora Web Revamp",
    clientName: "Northern Lights Retail",
    clientIndustry: "Retail",
    startDate: "2026-08-03",
    endDate: "2027-01-29",
    leadByEmpId: 1001,
    sponsorEmpId: 1005,
    contact: { name: "Evelyn Carter", email: "evelyn.carter@northernlights.example", phone: "+15550202001", title: "Director of Digital" },
    status: "active",
    approvalStatus: "approved",
    health: "on_track",
    progress: 45,
    summary: "Rebuild the storefront with a faster, accessible, mobile-first experience.",
    objectives: ["Cut page load time by 40%", "Reach WCAG 2.2 AA", "Lift mobile conversion by 25%"],
    readiness: { scopeDefined: "done", budgetApproved: "done", legalReviewed: "done", assetsPrepared: "done", kickoffScheduled: "in_progress" },
    budgetTotal: 180000,
    budgetSpent: 72000,
    tags: ["web", "retail"],
  },
  {
    projectId: 5002,
    projectName: "Helios Data Platform",
    clientName: "Solstice Energy",
    clientIndustry: "Energy",
    startDate: "2026-10-05",
    endDate: "2027-03-31",
    leadByEmpId: 1002,
    sponsorEmpId: 1001,
    contact: { name: "Marcus Reed", email: "marcus.reed@solstice.example", phone: "+15550202002", title: "Head of Analytics" },
    status: "in_review",
    approvalStatus: "in_review",
    health: "at_risk",
    progress: 15,
    summary: "Consolidate metering data into one governed analytics platform.",
    objectives: ["Ingest 12 meter feeds", "Daily dashboards by 7am", "Retire two legacy warehouses"],
    readiness: { scopeDefined: "done", budgetApproved: "in_progress", legalReviewed: "in_progress", assetsPrepared: "done", kickoffScheduled: "not_started" },
    budgetTotal: 240000,
    budgetSpent: 18000,
    tags: ["data", "energy"],
  },
  {
    projectId: 5003,
    projectName: "Mercury Mobile App",
    clientName: "Swift Logistics",
    clientIndustry: "Logistics",
    startDate: "2026-11-02",
    endDate: "2027-05-28",
    leadByEmpId: 1003,
    sponsorEmpId: 1001,
    contact: { name: "Priya Nair", email: "priya.nair@swiftlogistics.example", phone: "+15550202003", title: "Product Owner" },
    status: "planning",
    approvalStatus: "draft",
    health: "on_track",
    progress: 5,
    summary: "Give drivers a mobile app for routes, proof of delivery and live status.",
    objectives: ["Offline-first route view", "Photo proof of delivery", "Live ETA for customers"],
    readiness: { scopeDefined: "in_progress", budgetApproved: "not_started", legalReviewed: "not_started", assetsPrepared: "in_progress", kickoffScheduled: "not_started" },
    budgetTotal: 150000,
    budgetSpent: 0,
    tags: ["mobile", "logistics"],
  },
  {
    projectId: 5004,
    projectName: "Atlas Support Portal",
    clientName: "Harbor Health",
    clientIndustry: "Healthcare",
    startDate: "2026-06-01",
    endDate: "2026-12-18",
    leadByEmpId: 1004,
    sponsorEmpId: 1005,
    contact: { name: "Daniel Okafor", email: "daniel.okafor@harborhealth.example", phone: "+15550202004", title: "Patient Services Lead" },
    status: "on_hold",
    approvalStatus: "approved",
    health: "off_track",
    progress: 60,
    summary: "Self-service portal for patient support requests and status tracking.",
    objectives: ["Deflect 30% of calls", "HIPAA-compliant messaging", "Single sign-on for staff"],
    readiness: { scopeDefined: "done", budgetApproved: "done", legalReviewed: "blocked", assetsPrepared: "done", kickoffScheduled: "done" },
    budgetTotal: 120000,
    budgetSpent: 81000,
    tags: ["portal", "healthcare"],
  },
  {
    projectId: 5005,
    projectName: "Beacon Brand Refresh",
    clientName: "Lumen Studio",
    clientIndustry: "Media",
    startDate: "2026-01-12",
    endDate: "2026-06-26",
    leadByEmpId: 1005,
    sponsorEmpId: 1001,
    contact: { name: "Hannah Weiss", email: "hannah.weiss@lumenstudio.example", phone: "+15550202005", title: "Creative Director" },
    status: "completed",
    approvalStatus: "approved",
    health: "on_track",
    progress: 100,
    summary: "Refresh the brand guidelines and roll them out across internal teams.",
    objectives: ["New brand book", "Template library", "Team training sessions"],
    readiness: { scopeDefined: "done", budgetApproved: "done", legalReviewed: "done", assetsPrepared: "done", kickoffScheduled: "done" },
    budgetTotal: 60000,
    budgetSpent: 58000,
    tags: ["brand", "media"],
    archivedAt: "2026-07-10T10:00:00.000Z",
  },
];

function readinessChecklist(seed: ProjectSeed) {
  const updatedAt = `${seed.startDate}T09:00:00.000Z`;
  const items = (Object.keys(READINESS_WEIGHTS) as (keyof typeof READINESS_WEIGHTS)[]).map((id) => {
    const [title, description, category] = READINESS_TITLES[id];
    return {
      id,
      title,
      description,
      category,
      weight: READINESS_WEIGHTS[id],
      status: seed.readiness[id],
      ownerId: seed.leadByEmpId,
      ownerName: employeeName(seed.leadByEmpId),
      dueDate: seed.startDate,
      notes: seed.readiness[id] === "blocked" ? "Waiting on client legal review." : "",
      statusUpdatedAt: updatedAt,
      lastUpdatedBy: seed.leadByEmpId,
    };
  });
  const completedWeight = items.reduce((sum, item) => sum + item.weight * STATUS_CREDIT[item.status], 0);
  return {
    items,
    totalWeight: 100,
    completedWeight,
    percent: Math.round(completedWeight),
    updatedAt,
    updatedBy: seed.leadByEmpId,
  };
}

function statusHistory(seed: ProjectSeed) {
  const drafted = {
    id: `history-${seed.projectId}-1`,
    status: "draft",
    changedAt: `${seed.startDate}T09:00:00.000Z`,
    changedBy: seed.leadByEmpId,
    changedByName: employeeName(seed.leadByEmpId),
    comment: "Project drafted",
  };
  if (seed.approvalStatus === "draft") {
    return [drafted];
  }
  const review = {
    id: `history-${seed.projectId}-2`,
    status: "in_review",
    previousStatus: "draft",
    changedAt: `${seed.startDate}T15:00:00.000Z`,
    changedBy: seed.leadByEmpId,
    changedByName: employeeName(seed.leadByEmpId),
    comment: "Submitted for review",
  };
  if (seed.approvalStatus === "in_review") {
    return [drafted, review];
  }
  return [
    drafted,
    review,
    {
      id: `history-${seed.projectId}-3`,
      status: "approved",
      previousStatus: "in_review",
      changedAt: `${seed.startDate}T17:00:00.000Z`,
      changedBy: seed.sponsorEmpId,
      changedByName: employeeName(seed.sponsorEmpId),
      comment: "Approved by sponsor",
    },
    ...(seed.archivedAt
      ? [
          {
            id: `history-${seed.projectId}-4`,
            status: "approved",
            previousStatus: "approved",
            changedAt: seed.archivedAt,
            changedBy: null,
            changedByName: "admin",
            comment: "Project archived",
          },
        ]
      : []),
  ];
}

export const PROJECTS = PROJECT_SEEDS.map((seed) => {
  const checklist = readinessChecklist(seed);
  const reviewed = seed.approvalStatus !== "draft";
  const approved = seed.approvalStatus === "approved";
  return {
    projectId: seed.projectId,
    projectName: seed.projectName,
    clientName: seed.clientName,
    clientIndustry: seed.clientIndustry,
    startDate: new Date(`${seed.startDate}T00:00:00.000Z`),
    endDate: new Date(`${seed.endDate}T00:00:00.000Z`),
    leadByEmpId: seed.leadByEmpId,
    sponsorEmpId: seed.sponsorEmpId,
    contactPerson: seed.contact.name,
    contactNo: seed.contact.phone,
    emailId: seed.contact.email,
    contactTitle: seed.contact.title,
    contactNotes: `Prefers email; weekly sync with ${employeeName(seed.leadByEmpId)}.`,
    overview: {
      summary: seed.summary,
      objectives: seed.objectives,
      successCriteria: seed.objectives.map((objective) => `${objective} by ${seed.endDate}`),
      stakeholderNotes: `${seed.contact.name} (${seed.contact.title}) signs off deliverables.`,
      aiDraftSource: "manual",
    },
    scope: {
      inScope: seed.objectives,
      outOfScope: ["Ongoing support after handover"],
      assumptions: ["Client provides timely feedback"],
    },
    successMetrics: seed.objectives,
    status: seed.status,
    statusReason: seed.status === "on_hold" ? "Waiting on client legal review." : "",
    statusHistory: statusHistory(seed),
    timeline: [
      {
        id: `timeline-${seed.projectId}-1`,
        label: "Project created",
        description: "Project drafted and team proposed.",
        state: "completed",
        occurredAt: `${seed.startDate}T09:00:00.000Z`,
        status: "draft",
        actorId: seed.leadByEmpId,
        actorName: employeeName(seed.leadByEmpId),
      },
      {
        id: `timeline-${seed.projectId}-2`,
        label: "Delivery milestone",
        description: "Planned handover to the client.",
        state: seed.progress === 100 ? "completed" : "upcoming",
        occurredAt: `${seed.endDate}T09:00:00.000Z`,
        dueAt: `${seed.endDate}T09:00:00.000Z`,
        actorId: seed.leadByEmpId,
        actorName: employeeName(seed.leadByEmpId),
      },
    ],
    milestones: [
      { id: `milestone-${seed.projectId}-1`, label: "Kickoff", state: "completed", occurredAt: `${seed.startDate}T09:00:00.000Z` },
      { id: `milestone-${seed.projectId}-2`, label: "Handover", state: seed.progress === 100 ? "completed" : "upcoming", occurredAt: `${seed.endDate}T09:00:00.000Z` },
    ],
    categories: [seed.clientIndustry],
    tags: seed.tags,
    focusAreas: seed.objectives.slice(0, 2),
    blockers: seed.status === "on_hold" ? ["Client legal review"] : [],
    risks: [
      { title: "Scope creep", severity: "medium", mitigation: "Weekly change control" },
    ],
    riskRegister: { owner: employeeName(seed.leadByEmpId), reviewedAt: seed.startDate },
    budget: {
      total: seed.budgetTotal,
      allocated: seed.budgetTotal,
      spent: seed.budgetSpent,
      currency: "USD",
      lastUpdated: `${seed.startDate}T09:00:00.000Z`,
    },
    financials: { billingModel: "fixed", invoicedToDate: seed.budgetSpent },
    resourcesPlan: {
      stakeholders: [
        { name: seed.contact.name, email: seed.contact.email, role: "Client Contact", department: seed.clientName },
        { name: employeeName(seed.leadByEmpId), role: "Project Lead", department: "Delivery" },
      ],
      budgetAllocation: seed.budgetTotal,
    },
    readinessChecklist: checklist,
    readinessScore: checklist.percent,
    approvalStatus: seed.approvalStatus,
    approvalRequestedAt: reviewed ? new Date(`${seed.startDate}T15:00:00.000Z`) : null,
    approvalRequestedBy: reviewed ? seed.leadByEmpId : null,
    approvalResolvedAt: approved ? new Date(`${seed.startDate}T17:00:00.000Z`) : null,
    approvalResolvedBy: approved ? seed.sponsorEmpId : null,
    approvalReason: approved ? "Business case and budget confirmed." : "",
    approvalNotes: {},
    reviewerComments: reviewed
      ? [
          {
            id: `comment-${seed.projectId}-1`,
            section: "overview",
            comment: "Objectives are clear; confirm the success metrics with the client.",
            reviewerId: seed.sponsorEmpId,
            reviewerName: employeeName(seed.sponsorEmpId),
            createdAt: `${seed.startDate}T16:00:00.000Z`,
            severity: "info",
            resolved: approved,
          },
        ]
      : [],
    progress: seed.progress,
    health: seed.health,
    documents: [
      {
        id: `doc-${seed.projectId}-1`,
        name: "Statement of Work",
        url: `https://docs.example.com/${seed.projectId}/sow.pdf`,
        type: "pdf",
        uploadedAt: `${seed.startDate}T09:00:00.000Z`,
        uploadedBy: seed.leadByEmpId,
      },
    ],
    externalLinks: [{ label: "Client site", url: `https://${seed.contact.email.split("@")[1]}` }],
    aiGeneratedInsights: {},
    cmsContentRefs: [],
    lastSyncedAt: null,
    stageGate: { current: seed.status, nextReview: seed.endDate },
    governance: { sponsor: employeeName(seed.sponsorEmpId), cadence: "weekly" },
    communicationPlan: { channel: "email", cadence: "weekly", owner: employeeName(seed.leadByEmpId) },
    archivedAt: seed.archivedAt ? new Date(seed.archivedAt) : null,
    archivedBy: seed.archivedAt ? "admin" : null,
  };
});

export const ASSIGNMENTS = [
  { empProjectId: 7001, projectId: 5001, empId: 1001, role: "Project Lead", allocationPct: 40, assignedDate: "2026-08-03" },
  { empProjectId: 7002, projectId: 5001, empId: 1003, role: "QA Engineer", allocationPct: 30, assignedDate: "2026-08-10" },
  { empProjectId: 7003, projectId: 5002, empId: 1002, role: "Project Lead", allocationPct: 50, assignedDate: "2026-10-05" },
  {
    empProjectId: 7004,
    projectId: 5004,
    empId: 1002,
    role: "Backend Engineer",
    allocationPct: 20,
    assignedDate: "2026-06-01",
    unassignedAt: "2026-09-15",
  },
  { empProjectId: 7005, projectId: 5003, empId: 1003, role: "Project Lead", allocationPct: 40, assignedDate: "2026-11-02" },
  { empProjectId: 7006, projectId: 5004, empId: 1004, role: "Project Lead", allocationPct: 60, assignedDate: "2026-06-01" },
  { empProjectId: 7007, projectId: 5005, empId: 1005, role: "Project Lead", allocationPct: 50, assignedDate: "2026-01-12" },
].map(({ unassignedAt, assignedDate, ...row }) => ({
  ...row,
  assignedDate: new Date(`${assignedDate}T00:00:00.000Z`),
  isActive: !unassignedAt,
  unassignedAt: unassignedAt ? new Date(`${unassignedAt}T00:00:00.000Z`) : null,
  billable: true,
  billingRate: 120,
  costRate: 70,
  notes: unassignedAt ? "Rolled off after the API integration shipped." : "",
  responsibilities: [row.role === "Project Lead" ? "Delivery and client communication" : `${row.role} deliverables`],
  skillsApplied: [],
  toolsUsed: [],
  schedule: { hoursPerWeek: Math.round((row.allocationPct / 100) * 40) },
  contribution: {},
}));

export const COUNTERS = {
  employee: Math.max(...EMPLOYEES.map((emp) => emp.employeeId)),
  project: Math.max(...PROJECTS.map((project) => project.projectId)),
  projectEmployee: Math.max(...ASSIGNMENTS.map((row) => row.empProjectId)),
};
