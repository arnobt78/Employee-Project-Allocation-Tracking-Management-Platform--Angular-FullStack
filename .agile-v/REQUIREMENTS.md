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
| REQ-0119 | Private and guest pages MAY receive incremental visual polish (spacing, typography, controls, cards) driven by human screenshots; changes MUST preserve existing architecture (`MasterService`, shared UI tokens, shell/list patterns) and MUST NOT expand height of shared controls beyond documented tokens (e.g. `.eh-control` / `.eh-select-trigger` `h-11`). | DONE | GATE-0016 + GATE-0017 |
| REQ-0120 | Each polish slice MUST keep layout shell stable (no full-page loader regressions) and MUST pass lint + relevant tests + production build before commit-ready. | DONE | GATE-0017 verify + commit-ready |
| REQ-0121 | List toolbars SHOULD use shared `app-select-menu` filters with per-option icons; multi-filter + Clear; section gaps match list-page-shell rhythm. | DONE | GATE-0016 list wave |
| REQ-0122 | Local domain seed MUST read repo `dataset/`; wipe+reseed scripts MUST require `ALLOW_DB_WIPE=1` and MUST NOT target production by default. | DONE | GATE-0016 Wave D |
| REQ-0123 | On cold load (no peek), list pages MUST show a list-shaped content skeleton under a stable header (no live KPI values as `—`); soft nav with warm peek MUST skip that skeleton. | DONE | GATE-0016 cold-load `44bd5e3` |
| REQ-0124 | List page shell header→content spacing MUST match dashboard/placeholder via shared `.eh-content-stack` / `.eh-section-stack` (flex `gap-6` / `sm:gap-8`; not `space-y` on custom-element hosts). | DONE | GATE-0016 stack gap `416a7c5` |

## UX — GATE-0017 boot paint + skeleton mirrors

| ID | Requirement | Status | Notes |
|---|---|---|---|
| REQ-0125 | Document/html MUST paint dark ambient radials before Angular mounts (hard refresh must not show blank flat black). | DONE | `index.html` critical CSS |
| REQ-0126 | List and project-form loading skeletons MUST mirror live chrome (KPI/filter counts, row variants, readiness checklist rows). | DONE | Meta + `project-form-skeleton` checklist=5; employee row ID→avatar order |
| REQ-0127 | SelectMenu overlay pane width MUST match at least the trigger and ≥16rem, capped only by viewport (no fixed 24rem max). | DONE | TS measure + CSS var; soak follow-up dropped 24rem cap |
| REQ-0128 | Project Team list page MUST show six KPI cards (parity with Employees/Projects), including unique assignees. | DONE | People KPI |

## UX — GATE-0018 project detail polish (intake)

| ID | Requirement | Status | Notes |
|---|---|---|---|
| REQ-0129 | Human MUST share production soak findings for shipped Projects **list** UX (`eec34a3`) before further list changes; findings drive targeted fixes only. | DONE | Density + border chevron 2026-09-27 |
| REQ-0130 | Project **detail** surface (`/new-project`, `/update-project/:id` → `project-form`) MAY receive incremental polish per human guide; MUST preserve section accordion, `MasterService`, existing tokens/`eh-action-btn*`, and MUST NOT invent new detail architecture unless approved. | OPEN | Scope TBD from guide |
| REQ-0131 | Each GATE-0018 polish slice MUST pass lint + production build (and verify-deep) before commit-ready; shell MUST stay stable (no full-page loader regressions). | DONE (skeleton slice) | lint/test/build + verify-deep 2026-10-10 |

## UX — GATE-0018 single-layer mirrored skeletons (intake 2026-10-10)

| ID | Requirement | Status | Notes |
|---|---|---|---|
| REQ-0132 | On cold entry to any private route, the route placeholder (`route-content-placeholder`) and the page's own loading state MUST render identical chrome — same wrapper, same header action stubs, same `.eh-content-stack` spacing, same mirror skeleton component — so the handoff reads as **one** loading layer (Dashboard/Employees/Projects/Project Team pattern). | PROPOSED | DONE 2026-10-10 — all private pages; placeholder specs assert parity |
| REQ-0133 | Loading skeletons for Project detail, API Doc, API Status (and Insights/Calendar if confirmed) MUST mirror the live layout regions (cards, tabs, metric tiles, sections), not generic list rows. | DONE | API Doc/Status/Project detail/Insights/Calendar mirror skeletons |
| REQ-0134 | Static API documentation SHOULD use the existing `MasterService` cache + peek pattern so warm soft navigation skips the skeleton (REQ-0123 parity). API Status stays live but MUST only show a skeleton on cold first paint. | DONE | API Doc cached + peek; API Status seeds from last snapshot |
| REQ-0135 | API Status auto-refresh timer MUST be cleared when the page is destroyed (no background polling or stacked intervals after navigating away). | DONE | `interval` + `takeUntilDestroyed` |

## CRUD speed, pending UX, email visibility (GATE-0019, 2026-10-10)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| REQ-0136 | Deleting a project or employee MUST invalidate dependent client caches (assignments, KPIs) so no stale rows appear after navigation; a list response issued before a mutation MUST NOT be delivered as fresh. | DONE | `INVALIDATES` cascade + generation refetch; browser: 0 stale assignment rows after project delete |
| REQ-0137 | Each CRUD action MUST show an inline pending state on its own button (spinner + dynamic label, e.g. "Deleting…") until success or failure; other rows/actions stay usable; duplicate submits are ignored. | DONE | `MutationTracker` / `ehAction`; focus kept via `aria-disabled` |
| REQ-0138 | Mutations MUST respond as soon as data persists, without serial lookups that can run in parallel. | DONE | Counter ~3 s → ~0.23 s; CreateProject ~4.2 s → ~1.4 s (remote DB) |
| REQ-0139 | Calendar "+N more" MUST work with mouse, keyboard and touch without flicker or double toggles. | DONE | Mouse-only hover; Escape refocuses toggle |
| REQ-0141 | Authenticated API requests SHOULD NOT pay a database round trip for the session check when the session was validated recently; logout MUST revoke immediately on the handling instance (other instances within `SESSION_CACHE_TTL_SECONDS`, default 30 s). | DONE | Warm ~1 ms, cold ~233 ms; logout + immediate reload → 401 (4/4) |
| REQ-0142 | Main nav lists SHOULD be prefetched after first paint when idle so their pages open from cache. | DONE | Project Team opened with 0 API calls |
| REQ-0144 | Server auth (session cache, session lookup, login, logout, rate limit, cookie flags) MUST have automated tests that run without a real database (`npm run test:api`); malformed cookies MUST be treated as signed out. | DONE | 47/47 `node:test`; malformed cookie → 401 |
| REQ-0145 | Notification email MUST NOT be sent to reserved test domains (RFC 2606/6761); such deliveries are logged as skipped. When no deliverable To address remains, nothing is sent (CC/BCC are never promoted). | DONE | Live probe: 0 failed deliveries; 8 unit tests |
| REQ-0146 | Employee, project and assignment CRUD MUST have automated API tests without a real database; invalid input (missing fields, non-integer ids, unknown project/employee on create or edit) MUST return 400/404, never 500 or an orphan assignment. | DONE | 20 CRUD tests; live 400/404 confirmed |
| REQ-0147 | A malformed JSON request body MUST return 400 "Invalid JSON body" and MUST NOT be reported as a server error; the API documentation MUST list the CRUD 400/404 responses. | DONE | Live 400; docs test |
| REQ-0148 | The project detail page MUST use the same shared UI primitives as Employees/Projects/Project Team: `app-field-label` (Lucide icon + required `*`), one input height matching `app-select-menu`, `eh-action-btn` variants with icons, `ehAction` inline pending labels, `app-alert-dialog` confirmations with busy spinner, and toasts for every success/failure. | DONE | GATE-0024; browser sweep on `/update-project/5030`; 19 project-form specs |
| REQ-0149 | The project detail header MUST align the readiness bar with the subtitle without extra gaps; the mode badge is removed; checklist card titles use `text-sm sm:text-base`; Overview read cards (Client, Kick-Off, Health) sit in one responsive 3-column row with equal-height wrapping. | DONE | Readiness row bottom = subtitle bottom; 3 × 70 px tiles at `md` |
| REQ-0151 | Every employee or client name on project detail and Project Team MUST show the same Robohash avatar (seeded by email, else name) via `employeeAvatar` + `app-user-avatar`; calendar timeline leads and reminder owners too. | DONE | GATE-0025; project-form + timeline specs |
| REQ-0152 | Status, readiness, approval, delivery and KPI labels MUST be Title Case ("In Review", "On Hold") from one formatter (`titleCaseLabel`) and one status map (`projectStatusMeta`) rendered as `.eh-badge` pills with a Lucide icon. | DONE | GATE-0025; lib specs |
| REQ-0153 | Deactivating an assignment MUST stamp `unassignedAt` and reactivating MUST clear it (unless the client sends a date); Project Team MUST show the date, "Still Assigned" or "Not Recorded" — never a bare dash. | DONE | GATE-0025; API test + unit spec |
| REQ-0154 | Calendar Timeline, Business Insights, API Status and API Doc MUST use the shared KPI cards, badges, `ehAction` buttons, field labels, section cards and toasts, with icons on stat cards, badges and headers, and skeletons that mirror the live layout. | DONE | GATE-0025; browser sweep |
| REQ-0155 | Deleting a project MUST remove every assignment that references it and MUST fail (not succeed silently) if any assignment remains; the response reports how many were deleted. | DONE | GATE-0026; API tests (incl. non-ObjectId `_id`) |
| REQ-0156 | Archive and Delete MUST be separate actions with separate confirmations. Archive/Restore MUST delete nothing; archived projects and their assignments MUST be excluded from schedules, capacity and aggregates, shown in an Archived tab with Restore, and read-only (team and lead changes rejected with 409). | DONE | GATE-0026; API + unit specs; browser sweep |
| REQ-0157 | Demo data MUST come from one typed seed module; a reset MUST require `ALLOW_DB_WIPE=1` (and `EH_ALLOW_REMOTE_WIPE=1` for a non-local host), MUST NOT print credentials, and MUST keep only the `admin` user. No code path may re-import legacy JSON data. | DONE | GATE-0026; DB reseeded |
| REQ-0158 | A project's lead MUST have an active assignment on that project (created automatically on create/lead change), and Project Team MUST mark that row with a "Lead" badge. | DONE | GATE-0026; API test |
| REQ-0159 | The Projects list MUST show Lead (avatar, name, lead's email) and Client Contact (avatar, email, phone) tiles; Timeline MUST show the lead with a "Lead" caption, readiness % and team size. | DONE | GATE-0026; timeline spec; browser sweep |
| REQ-0160 | Every page showing a project count MUST use one helper: KPI "Projects" = active count, label "N Active · M Archived". | DONE | GATE-0026; `project-archive.spec.ts` |
| REQ-0161 | Every state-changing action on project detail MUST open a confirmation dialog before calling the API; the dialog MUST show a busy label, block dismissal while busy, close on success, stay open on error, close on route change, and re-check its preconditions before running. | DONE | GATE-0027; unit specs; browser sweep |
| REQ-0162 | Project responses MUST always include `overview.summary`, `overview.objectives` and `overview.successCriteria`, even when nothing was saved. | DONE | GATE-0027; API test |
| REQ-0150 | A Contentful lookup MUST map upstream 404 → 404 and 400/422 → 400 with fixed messages; any other upstream failure MUST return 502 with a generic message and MUST NOT expose the upstream body (space id, request id). | DONE | 9 Contentful API tests |
| REQ-0143 | Log out MUST return to the login page instantly; server revoke runs in the background, survives page unload, and its failure is surfaced. | DONE | ~70 ms to login; offline → "Sign-out not confirmed" toast |
| REQ-0140 | Background email failures MUST be recorded and surfaced (toast after mutation + API Status deliveries panel) without delaying the mutation; stored errors MUST NOT contain email addresses. | DONE | `NotificationLog`; redaction smoke test |

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
