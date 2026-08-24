# Requirements — Cycle C1

**Source of truth for intent.** Implementation must not start until GATE-0001 approves scope.

Legend: `BASELINE` = verified as-built behavior · `GAP` = docs/code mismatch or missing · `PROPOSED` = remediation/improvement for C1

---

## Baseline product capabilities (as-built)

| ID | Statement | Status | Evidence |
|---|---|---|---|
| REQ-0001 | Users can sign in via client-side demo credentials and reach the private layout. | BASELINE | `login.component.ts` compares to `environment.demoLogin`; no session store / route guard |
| REQ-0002 | App exposes private routes: dashboard, employees, projects, project form, assignments, business insights, calendar/timeline, API doc, API status. | BASELINE | `app.routes.ts` |
| REQ-0003 | Employee CRUD is available via Angular UI + serverless API. | BASELINE | `employee.component.ts`, `MasterService`, `repository.mjs` employee exports |
| REQ-0004 | Project CRUD, approval transitions, and reviewer comments are available. | BASELINE | `project*.ts`, `handler.mjs` / `repository.mjs` |
| REQ-0005 | Project–employee assignments support create/update/delete with allocation fields. | BASELINE | `project-employee.component.ts`, repository `*ProjectEmployee` |
| REQ-0006 | Dashboard aggregates people/project/assignment insights from API. | BASELINE | `buildDashboardSnapshot`, dashboard page |
| REQ-0007 | Calendar, timeline, and Gantt views visualize project schedule data. | BASELINE | `calendar-view`, `timeline-view`, `gantt-view`, `buildScheduleData` |
| REQ-0008 | Business insights page presents analytics over loaded domain data. | BASELINE | `business-insights.component.ts` (~1000 LOC) |
| REQ-0009 | API documentation and API status/monitoring endpoints/pages exist. | BASELINE | `api-doc`, `api-status`, `monitoring.mjs`, `buildApiStatus` |
| REQ-0010 | Email notifications for key employee/project/assignment events via Resend and/or SMTP. | BASELINE | `notifications.mjs`, handler notify* helpers |
| REQ-0011 | Optional Contentful brief fetch and AI overview draft generation (Gemini/Groq) via API. | BASELINE | `fetchContentfulBrief`, `generateOverviewDraft` in `repository.mjs`; feature toggles in `environment.ts` |
| REQ-0012 | Data persists in MongoDB through Prisma (with native Mongo fallback noted in git history). | BASELINE | `prisma/schema.prisma`, `api/_lib/prisma-client.mjs`, `repository.mjs` |

---

## Documentation / governance gaps

| ID | Statement | Status | Notes |
|---|---|---|---|
| REQ-0100 | Project memory (CLAUDE.md, .agile-v) must accurately describe stack, cycle, and gate. | PROPOSED / in progress | Bootstrapped this session |
| REQ-0101 | Public docs (README structure, SECURITY.md link, playbook §0) must match the repository. | GAP | README lists missing `api/_lib` modules & SECURITY.md; playbook §0 targets another project |
| REQ-0102 | Provide `.env.example` with placeholders only (no secrets). | GAP | `.env` exists (gitignored); no `.env.example` |

---

## Security & access control (proposed C1)

| ID | Statement | Status | Risk |
|---|---|---|---|
| REQ-0103 | Private UI routes MUST NOT be reachable without an authenticated session (or explicit demo-mode gate). | PROPOSED | RISK-0001 |
| REQ-0104 | Serverless API mutating and sensitive read endpoints MUST require authentication/authorization appropriate to deployment risk. | PROPOSED | RISK-0002 — currently no auth checks found in handler |
| REQ-0105 | Demo credentials MUST NOT be committed as production defaults; production must override via env and document threat model. | PROPOSED | RISK-0003 — hardcoded `admin`/`112233` in `environment.ts` |
| REQ-0106 | Employee password fields and notification tokens MUST follow a documented sensitivity policy (hashing / non-storage / redaction). | PROPOSED | RISK-0004 — `Employee.password` in schema; unclear hashing |

---

## Quality & maintainability (proposed C1)

| ID | Statement | Status | Notes |
|---|---|---|---|
| REQ-0107 | Remove dead backup artifacts from the repo (`handler.mjs.bak*`) or exclude them intentionally with rationale. | PROPOSED | ~276KB dead copies |
| REQ-0108 | Automated validation: production build + meaningful unit/integration coverage for critical CRUD paths. | PROPOSED | Specs are mostly `should create`; no lint script in package.json |
| REQ-0109 | Prefer extending `MasterService` + repository exports over parallel API clients; keep Angular standalone + signals conventions. | BASELINE constraint | Architecture preservation |
| REQ-0110 | Large UI modules (`project-form` ~1.9k LOC, `business-insights` ~1k LOC, handler/repository ~3.4k each) SHOULD be split only with approved vertical slices. | PROPOSED (deferrable) | Avoid big-bang rewrite |

---

## Explicit non-goals (unless human expands scope)

- Replacing Angular SPA with Next.js/SSR
- Rewriting entire handler/repository in one PR
- Implementing Redis/Sentry/PostHog from the integration guide
- Claiming realtime WebSocket sync (not present)

---

## Traceability notes

- Tasks: `TASKS.md`
- Risks: `RISKS.md`
- Decisions: `DECISION_LOG.md`
- Gates: `GATES.md`
