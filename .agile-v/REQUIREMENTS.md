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
| REQ-0111 | `engines.node` MUST remain `24.x` with `.nvmrc` `24`; Vercel dashboard Node must not force EOL Node 20 after Oct 1. | DONE (repo); dashboard Human-Action | Guardrails §1.5 / §8 |
| REQ-0112 | `npm audit` MUST report **0** vulnerabilities on Node 24 after compatible upgrades/overrides; lint + production build MUST pass. | DONE | Verified 2026-09-11 |

---

## UX — refresh / loading polish (GATE-0015)

| ID | Statement | Status | Notes |
|---|---|---|---|
| REQ-0113 | Hard refresh and cold navigation MUST NOT show a white/blank background flash; document + shell background MUST match app theme before/while CSS and session resolve. | DONE | Inline `#020817` + theme-color; `bg-background` under shell |
| REQ-0114 | Authenticated route refresh MUST keep a stable private layout shell (header/nav footprint) with local loading indicators; MUST NOT flash guest/auth chrome then private chrome. | DONE | Early private shell + auth-gated nav; guest drops to auth layout |
| REQ-0115 | Data regions MUST use local skeletons (or equivalent) while fetching; avoid full-page loading overlays and text-only “Loading…” where list-skeleton already exists. | DONE | api-doc / api-status / pages use local skeletons |
| REQ-0116 | Login ↔ app background transition SHOULD use the same base surface token so crossing routes does not jump color. | DONE | floating-background aligned to `#020817` |
| REQ-0117 | Login credentials MUST be validated with shared Zod schemas on client and server. | DONE | `auth.schema.ts` / `.mjs` |
| REQ-0118 | List pages SHOULD sync search/page to URL query params with client pagination. | DONE | `list-query.ts` on employee / projects / project-employee |

---

## UX — per-page UI polish (GATE-0016, screenshot-driven)

| ID | Statement | Status | Notes |
|---|---|---|---|
| REQ-0119 | Private and guest pages MAY receive incremental visual polish (spacing, typography, controls, cards) driven by human screenshots; changes MUST preserve existing architecture (`MasterService`, shared UI tokens, shell/list patterns) and MUST NOT expand height of shared controls beyond documented tokens (e.g. `.eh-control` / `.eh-select-trigger` `h-11`). | PROPOSED | Awaiting screenshot batch; scope frozen per approval |
| REQ-0120 | Each polish slice MUST keep layout shell stable (no full-page loader regressions) and MUST pass lint + relevant tests + production build before commit-ready. | PROPOSED | Same validation bar as GATE-0015 |

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
