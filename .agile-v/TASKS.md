# Tasks — Cycle C1 (prioritized plan)

**Status:** Proposed — awaiting GATE-0001 approval  
**Rule:** No implementation until approved. Waves are sequential; tasks within a wave may parallelize if independent.

---

## Wave 0 — Analysis & memory (THIS SESSION)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0000 | Bootstrap `.agile-v/`, reconcile CLAUDE.md, produce plan | REQ-0100 | DONE |

---

## Wave 1 — Safety & honesty (P0)

| ID | Task | REQ | Affected areas | Depends |
|---|---|---|---|---|
| TASK-0001 | Add `.env.example` (placeholders only); document required vars; ensure secrets stay gitignored | REQ-0102 | root, README env section | DONE |
| TASK-0002 | Create `SECURITY.md` matching README link OR remove link; document demo-auth threat model | REQ-0101, REQ-0105 | root, docs | DONE |
| TASK-0003 | Align README project-structure claims with actual `api/_lib` (only `prisma-client.mjs`) | REQ-0101 | README.md | DONE |
| TASK-0004 | Decide + implement minimal session/guard for private routes (or document intentional open demo with warning) | REQ-0103 | `login`, `layout`, `app.routes`, optional auth service | DONE (session auth) |
| TASK-0005 | Add API auth boundary for mutating endpoints (and sensitive reads) consistent with chosen auth model | REQ-0104 | `handler.mjs`, possibly middleware helper in `api/_lib` | DONE |
| TASK-0006 | Stop shipping hardcoded demo password as production default; wire env overrides already described in README | REQ-0105 | `environment.ts`, `generate-env-prod.*` | PARTIAL (demo autofill remains public; seeded bcrypt user; documented threat model) |

---

## Wave 2 — Quality baseline (P1)

| ID | Task | REQ | Affected areas |
|---|---|---|---|
| TASK-0007 | Delete or quarantine `handler.mjs.bak*` with DEC entry | REQ-0107 | `api/employee-management/` | DONE |
| TASK-0008 | Fix playbook §0 overrides for this Angular/Vercel repo (or mark file as portable template only) | REQ-0101 | `docs/PROJECT_ENGINEERING_PLAYBOOK.md` | OPEN |
| TASK-0009 | Install deps; run `ng build`; record results in VALIDATION_SUMMARY | REQ-0108 | CI-local | DONE |
| TASK-0010 | Upgrade critical specs beyond smoke (`MasterService` CRUD URL contracts, login success/fail) | REQ-0108 | `*.spec.ts` | OPEN |
| TASK-0011 | Add lint script (ESLint) if approved — README claims it today but package.json lacks it | REQ-0108 | package.json, eslint config | DONE |

---

## Wave 3 — Maintainability (P2, optional / deferrable)

| ID | Task | REQ | Notes |
|---|---|---|---|
| TASK-0012 | Extract notification builders from `handler.mjs` into dedicated module | REQ-0110 | Vertical slice; no behavior change |
| TASK-0013 | Split `project-form.component.ts` into form sections / services | REQ-0110 | High risk of regressions; needs own gate |
| TASK-0014 | Clarify employee password handling (hash, omit from API responses) | REQ-0106 | Security review |

---

## Wave — Node 24 + audit 0 (2026-09-11)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0015 | Confirm Node 24 pins (`engines`, `.nvmrc`); note Vercel dashboard Node Human-Action | REQ-0111 | DONE |
| TASK-0016 | Patch direct deps within compatible majors (nodemailer ≥9.1.1; Angular 20.3.x latest; Sentry 10.x patch) | REQ-0112 | DONE |
| TASK-0017 | Scoped `overrides` for transitive `js-yaml`, `qs`, `hono` to patched versions | REQ-0112 | DONE |
| TASK-0018 | Clean reinstall; `npm audit` = 0; `npm run lint` + `npm run build` (+ test if green) | REQ-0112 | DONE |
| TASK-0019 | Evaluate Redis/Sentry/PostHog guide vs product need | — | Sentry implemented; Redis/PostHog deferred |

---

## Wave — Refresh / loading UX polish (GATE-0015 — COMPLETE)

| ID | Task | REQ | Status | Affected areas |
|---|---|---|---|---|
| TASK-0020 | Critical CSS / inline `html,body` background + `color-scheme` matching `--background`; align `theme-color` | REQ-0113 | DONE | `src/index.html`, `src/styles.css` |
| TASK-0021 | Solid `bg-background` under `.app-shell` gradients | REQ-0113 | DONE | `app.component.html` / css |
| TASK-0022 | Private-URL refresh: keep private shell during `ensureSession`; auth-gated nav; update specs | REQ-0114 | DONE | `app.component.ts`, shell header, specs |
| TASK-0023 | Localize remaining text loaders (api-doc / api-status) to `app-list-skeleton`; tighten dashboard if still full-swap | REQ-0115 | DONE | api-doc, api-status, dashboard templates |
| TASK-0024 | Align login floating background base with shell `--background` | REQ-0116 | DONE | floating-background / login |
| TASK-0025 | Zod login validation client + server | REQ-0117 | DONE | auth.schema + login + handler |
| TASK-0026 | List URL `?q=`/`?page=` + client pagination | REQ-0118 | DONE | list-query + employee/projects/assignments |

---

## Wave — Page shell + list/dashboard redesign (2026-09-13 — COMPLETE)

| ID | Task | Status | Affected areas |
|---|---|---|---|
| TASK-0027 | Shared `list-page-shell` / `kpi-stat-card` / `list-toolbar` + placeholder alignment | DONE | `components/ui/*`, `route-content-placeholder`, `private-page-meta` |
| TASK-0028 | Employees / Projects / Project Team KPI + filter redesign (`?f=`) | DONE | employee, project, project-employee, list-query |
| TASK-0029 | Dashboard badge strip → KPI cards | DONE | dashboard |
| TASK-0030 | Projects route-only create/edit (remove inline dual editor) | DONE | project list + existing project-form routes |
| TASK-0031 | Chrome-first loading on insights/calendar/API pages | DONE | business-insights, calendar-timeline, api-doc, api-status |

---

## Wave — Per-page UI polish (GATE-0016 — COMPLETE)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0032 | Intake screenshot batch; map issues → pages/components | REQ-0119 | DONE | Dashboard + list screenshots |
| TASK-0033 | Implement approved polish slices only (preserve shell/tokens/`h-11`) | REQ-0119 | DONE | List pages wave coded |
| TASK-0034 | verify-deep + commit-ready for approved slice(s) | REQ-0120 | DONE | List wave committed |
| TASK-0035 | List toolbar v2: SelectMenu multi-filter + Clear + soft skeleton | REQ-0121 | DONE | Shared foundation |
| TASK-0036 | Fix seed path to `dataset/`; local wipe+reseed; enrich sample JSON | REQ-0122 | DONE | Wipe localhost-only; dataset tracked |
| TASK-0037 | List cold-load skeleton; remove KPI emdash flash; shell gap parity | REQ-0123–0124 | DONE | Verified + committed |

---

## Recommended approval options (GATE-0016)

**Option A — Single-page slice:** Approve polish for only the pages shown in the next screenshot batch. **(active — dashboard done)**  
**Option B — Batch wave:** Approve all pages called out in that batch in one implement → verify → commit-ready cycle.  
**Option C — Hold:** Keep planning only; no coding until further screenshots/instructions.

Default recommendation: **Option A** (one page at a time).

---

## Recommended approval options

**Option A — Refresh FOUC + shell stability only:** Approve TASK-0020…0022 (REQ-0113–0114).  
**Option B — Full WAVE GATE-0015:** Approve TASK-0020…0024 (REQ-0113–0116).  
**Option C — Defer:** Keep GATE-0014 resume; wait for screenshots before coding.

Default recommendation: **Option B** once screenshots confirm acceptance criteria (or Option A if screenshots only show blank refresh flash).

---

## Legacy recommended approval options (C1 bootstrap)

**Option A — Security-first C1:** Approve Wave 1 (TASK-0001…0006) now; Wave 2 after Gate re-check.  
**Option B — Docs + hygiene first:** Approve TASK-0001…0003, 0007…0009 only; defer auth API work.  
**Option C — Full Wave 1+2:** Approve all P0+P1 tasks; defer Wave 3.

(Historical; Wave 1 largely delivered under user direction.)
