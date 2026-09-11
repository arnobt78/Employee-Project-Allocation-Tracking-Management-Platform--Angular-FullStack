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

## Recommended approval options

**Option A — Security-first C1:** Approve Wave 1 (TASK-0001…0006) now; Wave 2 after Gate re-check.  
**Option B — Docs + hygiene first:** Approve TASK-0001…0003, 0007…0009 only; defer auth API work.  
**Option C — Full Wave 1+2:** Approve all P0+P1 tasks; defer Wave 3.

Default recommendation: **Option A**.
