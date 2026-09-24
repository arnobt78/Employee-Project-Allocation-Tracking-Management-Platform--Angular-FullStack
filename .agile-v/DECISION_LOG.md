# Decision Log

Append-only. Do not rewrite prior entries.

---

## DEC-0001 — Bootstrap Agile V Cycle C1

| Field | Value |
|---|---|
| Timestamp | 2026-08-24 |
| Agent | Cursor Agile V orchestrator |
| Decision | Initialize `.agile-v/` as Cycle C1; treat existing app as as-built baseline; enter Stage 1 analysis and pause at Human Gate 1 |
| Rationale | No prior `.agile-v/` state; protocol requires bootstrap before implementation |
| Linked REQ | REQ-0100 |
| Alternatives | Resume nonexistent cycle (invalid); jump straight to coding (violates protocol) |

---

## DEC-0002 — Architecture preservation: Angular SPA + Vercel serverless

| Field | Value |
|---|---|
| Timestamp | 2026-08-24 |
| Agent | Cursor Agile V orchestrator |
| Decision | Preserve Angular 18 standalone SPA client + `api/employee-management` serverless handler + Prisma/MongoDB; do not introduce Next.js/SSR patterns from generic CLAUDE template |
| Rationale | Codebase is SPA (`ng serve` / Vercel Angular framework); SSR/RSC rules in templates do not apply as-written |
| Linked REQ | REQ-0109 |
| Alternatives | Migrate to SSR framework (out of scope unless human requests) |

---

## DEC-0003 — Recommend security-first C1 (Option A)

| Field | Value |
|---|---|
| Timestamp | 2026-08-24 |
| Agent | Cursor Agile V orchestrator |
| Decision | Recommend Wave 1 (docs honesty + auth boundaries) before refactors |
| Rationale | Unauthenticated API + ungarded routes are highest verified risks on a public Vercel URL |
| Linked REQ | REQ-0103, REQ-0104, REQ-0105 |
| Status | Proposal only — requires GATE-0001 |

---

## DEC-0004 — Deliver Wave 1 auth + hygiene under user direction

| Field | Value |
|---|---|
| Timestamp | 2026-08-25 |
| Agent | Cursor |
| Decision | Implement session auth, API auth, `.env.example`, SECURITY.md, AI fallback, Sentry tunnel, SEO/README without waiting for formal GATE-0001 row |
| Rationale | User explicitly directed implementation and verify-deep / commit-ready |
| Linked REQ | REQ-0101–0105, REQ-0107–0108 |

---

## DEC-0012 — Compatible dep patches only (GATE-0012)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Drive `npm audit` to 0 via nodemailer ≥9.1.1 + overrides (`js-yaml` ≥4.3.2, `qs` ≥6.16.0, `hono` ≥4.13.7) + Angular 20.3.x / Sentry 10.x patch bumps; **do not** migrate Angular 21+, Prisma 7+, Tailwind 4, ESLint 10, or `@lucide/angular` in this slice |
| Rationale | Guardrails §8; terminal shows 6 vulns all fixable in-major; majors would break peers |
| Linked REQ | REQ-0111, REQ-0112 |
| Status | APPROVED and executed (audit 0; lint/build/test PASS) |

---

## DEC-0013 — Track package-lock.json + exact Angular pins (GATE-0013)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Stop gitignoring `package-lock.json`; pin `@angular/*` / CLI / build-angular to exact versions; remove `http-proxy-middleware` ^3 override |
| Rationale | Vercel `npm install` hit ERESOLVE (mixed 20.3.29/20.3.31 peers without lockfile); HPM v3 override broke WDS proxy (`Missing target`) |
| Linked | GATE-0013, Vercel deploy |
| Status | APPROVED and executed |

---

## DEC-0014 — Raise initial budget + delete proven unused (GATE-0014)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Raise initial `maximumWarning` to 1.2MB; delete zero-ref files/deps/helpers only (cors-proxy, hover-tooltip, unused SVGs, font-awesome, dead API helpers) |
| Rationale | Honest demo SPA size; reduce attack surface (open cors-proxy) and maintenance noise without Angular major upgrade |
| Linked | GATE-0014 |
| Status | APPROVED and executed |

---

## DEC-0015 — Page shell redesign: shared list chrome + route-only project editor

| Field | Value |
|---|---|
| Date | 2026-09-13 |
| Decision | Introduce reusable list page shell (KPIs + Lucide toolbar + header CTA); URL filter `?f=`; merge Projects create/edit into `/new-project` and `/update-project/:id` only; keep Employees/Project Team inline create |
| Rationale | Consistent loading contract (chrome first, data-region skeletons); remove dual Full Editor + inline project forms; align live pages with route placeholders |
| Linked | Page shell redesign plan; GATE-0015 follow-on UX |
| Status | APPROVED and executed |

---

## DEC-0016 — GATE-0016 Option A: dashboard-first polish

| Field | Value |
|---|---|
| Date | 2026-09-15 |
| Decision | Polish one page at a time; deliver dashboard enrich (KPIs, charts, departments, mirror skeleton, brand FolderGit2, footer) before list/insights pages |
| Rationale | Smallest blast radius; shared shell gaps already improved; list refresh skeletons remain a follow-on slice |
| Linked | GATE-0016, TASK-0032–0034, REQ-0119–0120 |
| Status | APPROVED and executed (dashboard slice) |

---

## DEC-0017 — GATE-0016 list pages + local-only reseed

| Field | Value |
|---|---|
| Date | 2026-09-16 |
| Decision | Polish Employees/Projects/Project Team together; standardize list filters on `app-select-menu`; wipe+reseed only local `DATABASE_URL` with `ALLOW_DB_WIPE=1`; enrich existing schema fields in `dataset/` (prefer zero new models) |
| Rationale | User approved plan; schema already rich; seed path was broken; production wipe out of scope |
| Linked | GATE-0016, TASK-0035–0036, REQ-0121–0122 |
| Status | APPROVED — implemented; dataset synthetic-only; wipe localhost-gated |

---

## DEC-0018 — List cold-load skeleton (no KPI emdash)

| Field | Value |
|---|---|
| Date | 2026-09-22 |
| Decision | On cold load, list pages mirror dashboard: stable header + list-shaped content skeleton until peek/data warm; never show live KPI cards with `—`. Align list-page-shell spacing with dashboard/placeholder. |
| Rationale | Production hard-refresh screenshots showed KPI dash flash and gap mismatch; Cmd+Shift+R and Reload share one cold path (peeks cleared). |
| Linked | GATE-0016, TASK-0037, REQ-0123–0124 |
| Status | DONE — `44bd5e3` + stack follow-up `416a7c5` |

---

## DEC-0019 — GATE-0016 prod UI soak before next polish

| Field | Value |
|---|---|
| Date | 2026-09-22 |
| Decision | Pause GATE-0016 coding. Human tests production (hard refresh, soft nav, list trio + dashboard) and shares UI findings. Next implement only after feedback + Option A/B/C approval (CP-0017). |
| Rationale | Code is on `origin/main`; remaining risk is prod-perceived UX, not unfinished planned tasks. |
| Linked | GATE-0016, TASK-0038, CP-0017 |
| Status | ACTIVE — superseded by GATE-0017 after soak feedback |

---

## DEC-0020 — GATE-0017 boot paint + skeleton mirrors + Team KPI parity

| Field | Value |
|---|---|
| Date | 2026-09-23 |
| Decision | Implement soak findings as GATE-0017: pre-boot radials; parametrized list/form skeletons; SelectMenu 16–24rem; Project Team sixth KPI (People); unify `ListPageRowVariant`; align SelectMenu CSS max-width to measured pane var. |
| Rationale | User approved plan after GATE-0016 prod soak screenshots (blank boot, truncated filters, update-project Untitled flash, list skeleton mismatch, 5 vs 6 KPIs). |
| Linked | GATE-0017, TASK-0039–0043, REQ-0125–0128, CP-0018 |
| Status | DONE — local verify-deep + security PASS; commit-ready |

---

## DEC-0021 — GATE-0017 prod UI soak before next polish

| Field | Value |
|---|---|
| Date | 2026-09-23 |
| Decision | Pause coding. Human tests production and shares UI/behavior findings. Next implement only after feedback + approval (CP-0019). |
| Rationale | GATE-0017 verified locally; remaining risk is prod-perceived UX. |
| Linked | GATE-0017, CP-0019 |
| Status | ACTIVE |

---

## DEC-0022 — Close GATE-0001 formal paper trail

| Field | Value |
|---|---|
| Date | 2026-09-23 |
| Decision | Retroactively record GATE-0001 APPROVED as Option A (security-first) as-built; resolve CP-0001. |
| Rationale | User asked to close formal paper trail; Waves 1+ and later gates already shipped under chat approval (DEC-0004 onward). |
| Linked | GATE-0001, CP-0001, APPROVALS.md |
| Status | DONE |

---

## DEC-0023 — GATE-0017 soak slices: login then Employees (one page at a time)

| Field | Value |
|---|---|
| Date | 2026-09-24 |
| Decision | Implement approved soak findings page-by-page (login, then Employees). SelectMenu pane tracks trigger width (drop 24rem max). Shared `.eh-action-btn*` for list/card action height. Exclude unrelated project-employee / project-form typography from Employees commit. |
| Rationale | User screenshots + approved plans; keep CP-0019 open for further prod feedback. |
| Linked | GATE-0017, CP-0019, TASK-0044–0045, REQ-0119–0120, REQ-0126–0127 |
| Status | DONE — login `3445214`; Employees polish this commit |

---

## DEC-0024 — Defer list deep-links and employee/assignment detail routes

| Field | Value |
|---|---|
| Date | 2026-09-24 |
| Decision | Leave Employees / Project Team as accordion lists; do not ship `?expand=<id>` deep-links or new detail routes now. Keep polishing GATE-0017 soak (secondary text-scale shipped). Revisit detail routes later only if shareable URLs are needed. |
| Rationale | Pagination/filter edge cases make expand deep-links awkward; Projects already has a heavy detail page; accordion fits scan/edit for people and assignments. |
| Linked | GATE-0017, CP-0019 |
| Status | DEFERRED |
