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

---

## DEC-0025 — Project Team UX polish mirrors Employees

| Field | Value |
|---|---|
| Date | 2026-09-24 |
| Decision | Align Project Team with Employees patterns: assignment skeleton, view field-label icons, save spinner, `eh-action-btn*`, state-colored Active toggle, flush date picker; keep accordion (no detail routes). |
| Rationale | User soak screenshots; Employees already established the shared action/label/skeleton conventions. |
| Linked | GATE-0017, CP-0019, DEC-0024 |
| Status | DONE |

---

## DEC-0026 — Projects list UX polish; keep heavy detail route

| Field | Value |
|---|---|
| Date | 2026-09-25 |
| Decision | Enrich Projects list with readiness bar, title-cased status, `eh-action-btn*`, and accordion expand for secondary facts; keep `/update-project/:id` as the heavy detail surface (no `?expand=`). |
| Rationale | Match Employees/PE soak patterns while preserving the existing project-form detail route. |
| Linked | GATE-0017, CP-0019, DEC-0024, TASK-0048 |
| Status | DONE |

---

## DEC-0027 — Sequence: prod list soak findings → then project detail polish

| Field | Value |
|---|---|
| Date | 2026-09-26 |
| Decision | Human will share production experience of Projects **list** polish (`eec34a3`), then guide project **detail** (`project-form`) fix/polish. Open GATE-0018 / CP-0020; no coding until findings + guide approved. |
| Rationale | Avoid speculative detail work; keep GATE-0017 list soak and detail polish as sequential human-guided slices. |
| Linked | GATE-0017, GATE-0018, CP-0019, CP-0020, REQ-0129–0131, TASK-0049–0052 |
| Status | PARTIAL — list findings implemented (DEC-0028); detail still awaiting guide |

---

## DEC-0028 — Projects list two-row density + border chevron

| Field | Value |
|---|---|
| Date | 2026-09-27 |
| Decision | Collapse Projects list cards to two rows (title+readiness; meta+Details/Delete); replace More/footer with centered border `chevron-down` that rotates on expand; mirror in project skeleton. |
| Rationale | Prod soak screenshots; reduce card height while keeping expand secondary facts and detail route. |
| Linked | GATE-0017, CP-0019, REQ-0129, TASK-0049 |
| Status | DONE |

---

## DEC-0029 — Lead name via API join; Health stored + seeded + form

| Field | Value |
|---|---|
| Date | 2026-09-27 |
| Decision | Do not add Prisma `employeeName` on Project; resolve lead name at map time from `leadByEmpId`. Keep `health` as stored string (`on_track`/`at_risk`/`off_track`); seed values + overview form control; not computed from readiness. |
| Rationale | List expand showed "—" due to missing join and null health seed, not missing schema. |
| Linked | GATE-0017, CP-0019, REQ-0129 |
| Status | DONE |

---

## DEC-0030 — Single-layer skeleton contract (proposed)

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Extend the Dashboard/list pattern to every remaining private page: one page-specific mirror skeleton component, rendered by **both** the route placeholder and the page's cold-load branch, inside the same wrapper (`text-white/85` → header → `.eh-content-stack`). Header action stubs come from `PRIVATE_PAGE_META` so both phases render the same stubs. No new loader architecture. |
| Rationale | Investigation shows the "double layer" is a mismatch between two loading phases, not two loaders at once: placeholder uses generic `simple`/`insights`/`project-form` shapes while pages render different wrappers (`space-y-6` / `space-y-10`), different header actions, and generic list rows. |
| Linked | GATE-0018, CP-0021, REQ-0132–0135, TASK-0053–0059 |
| Status | DONE — approved + shipped 2026-10-10 |

---

## DEC-0031 — Send mutation emails in the background via `waitUntil`

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Mutations respond as soon as data is persisted; Resend → SMTP delivery runs via `@vercel/functions` `waitUntil` (`notifyInBackground` in `handler.mjs`). Failures are logged only. |
| Rationale | Awaited email added ~5 s to every create/update/delete (UpdateEmployee ~6 s → ~1.9 s after). `waitUntil` keeps the Vercel function alive until delivery settles; locally the long-lived dev server finishes the promise. |
| Linked | GATE-0018, TASK-0060, RISK-0017 |
| Status | DONE |

---

## DEC-0032 — Stale-chunk reload + wildcard redirect

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | `withNavigationErrorHandler` reloads once to the target URL on chunk-load errors (10 s cooldown in `sessionStorage`); unknown paths redirect to `dashboard`. |
| Rationale | Tabs open across a deploy request removed lazy chunks; unknown URLs previously threw NG04002. |
| Linked | TASK-0060 |
| Status | DONE |

---

## DEC-0033 — Mutation results win over in-flight reads; clear caches on login

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Project mutation responses bump the form request token and the service keeps the newest detail snapshot by issue time; approval/comment actions no longer refetch. Successful login clears all client caches. |
| Rationale | verify-deep: slow `GetProject` could overwrite a just-saved project. Security review: session expiry + re-login in the same tab could show the previous user's cached data. |
| Linked | TASK-0060 |
| Status | DONE |

---

## DEC-0034 — Native atomic counter instead of Prisma `counter.upsert`

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | `incrementCounter` uses one native MongoDB `findOneAndUpdate` (pipeline `$set`, `upsert`, `returnDocument: "after"`) via a cached `MongoClient`. Deviates from the plan, which proposed `prisma.counter.upsert`. |
| Rationale | Prisma `upsert` always fails on the legacy counter documents ("required to return data, but found no record(s)") and fell back to a slow multi-step path (~3 s). The native call is one round trip (~0.23 s) and atomic. |
| Linked | GATE-0019, TASK-0064, REQ-0138 |
| Status | DONE |

---

## DEC-0035 — Persist email delivery outcomes in `NotificationLog`; surface failures in the UI

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Every background send records `sent` / `skipped` / `failed` (event, entity, provider, recipient count, redacted error) in a `NotificationLog` collection. The client checks `GetNotificationFailures` 6/15/30 s after a successful mutation (one coalesced schedule per burst) and shows one toast per new failure batch; API Status lists recent deliveries. Resend times out after 10 s and SMTP after 8 s connect / 15 s socket. |
| Rationale | DEC-0031 moved email off the request path, which hid failures (RISK-0017). Polling a small indexed query avoids new infrastructure (no websockets/queues). Errors are redacted because provider messages can echo recipient addresses. |
| Linked | GATE-0019, TASK-0065–0066, REQ-0140, RISK-0017 |
| Status | DONE |

---

## DEC-0036 — Per-instance session cache in front of the opaque session token

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Keep HttpOnly opaque-token sessions. Each server instance caches validated sessions (key = SHA-256 of token, 1000 entries, TTL `SESSION_CACHE_TTL_SECONDS` default 30 s capped by session expiry); misses use one `$lookup` aggregate. Logout revokes locally with a 60 s tombstone so a lookup racing the delete cannot re-cache the session; tombstones are dropped when no row was deleted. |
| Rationale | Prisma `include` cost two round trips (~460 ms) on every request. JWTs would lose server-side revocation. Trade-off: on other warm instances a revoked session stays valid up to the TTL (RISK-0022). |
| Linked | GATE-0020, TASK-0068–0069, REQ-0141 |
| Status | DONE |

---

## DEC-0037 — Local-first logout with background keepalive revoke

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | Log Out clears client session/caches and navigates at once. The revoke is a `fetch` with `keepalive` (bypasses HttpClient; 8 s timeout, 2 retries, error toast on failure). Login waits for a pending revoke so its cookie-clearing response cannot wipe the new cookie. An auth epoch makes the interceptor ignore 401s from requests issued under an ended session; in-flight list reads are dropped (not refetched) after a full cache clear. |
| Rationale | Waiting on the server showed "Logging Out…" for a round trip. `keepalive` keeps the revoke alive across an immediate reload/close (verified). |
| Linked | GATE-0020, TASK-0071, REQ-0143, RISK-0023 |
| Status | DONE |

---

## DEC-0038 — Server tests with `node:test` and module mocks

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | API tests use built-in `node:test` (`--experimental-test-module-mocks`) under top-level `tests/api/` (outside `api/`, so Vercel never deploys them). Only `prisma-client.mjs`, `mongo-client.mjs` and `timing.mjs` are mocked; auth, session cache, handler and the Vercel entry run for real. The fake checks the session aggregate's `$lookup`/`$project` shape and mimics Prisma's "undefined filter deletes all rows". |
| Rationale | No new dependencies; tests run in ~1 s without a database. `mock.module` `namedExports` may be deprecated in later Node majors (RISK-0024). |
| Linked | GATE-0021, TASK-0072–0074, REQ-0144 |
| Status | DONE |

---

## DEC-0039 — Skip test-domain recipients; expose client errors

| Field | Value |
|---|---|
| Date | 2026-10-10 |
| Decision | `sendNotification` drops recipients on reserved domains (`example.com/.net/.org`, `.test`, `.example`, `.invalid`, `.localhost`) before calling Resend/SMTP. If no To remains, nothing is sent and the delivery is logged as `skipped` (CC/BCC are not promoted; amended in GATE-0023). Input errors use `clientError(status, message)` (`expose: true`), including malformed JSON and non-integer ids; the handler returns only those as 4xx, everything else stays 500. |
| Rationale | Seed data uses `example.com`, which Resend rejects (422) and made the deliveries panel show false failures. Emails are worded for the To recipient, so CC'd leads should not receive them alone. Exposing only flagged errors keeps internal messages out of 4xx responses and client mistakes out of Sentry. |
| Linked | GATE-0022, GATE-0023, TASK-0075–0082, REQ-0145–0147 |
| Status | DONE |

---

## DEC-0040 — Archive is reversible, delete is permanent; native deletes; typed demo seed

| Field | Value |
|---|---|
| Date | 2026-10-12 |
| Decision | Archive/Restore only set or clear `archivedAt`/`archivedBy`; archived projects keep their assignments but are hidden from schedules, capacity and aggregates and are read-only (409 on team or lead changes). Delete Permanently removes assignments then the project through the native MongoDB driver, sweeps again and throws if any assignment still references it. Demo data lives in `prisma/seed-data.ts`; `tools/reset-demo-data.mjs` is the only wipe path and needs `ALLOW_DB_WIPE=1` (+ `EH_ALLOW_REMOTE_WIPE=1` for non-local hosts). The legacy JSON bootstrap is removed. A unique `(projectId, empId)` index backs the automatic lead assignment. |
| Rationale | The "Archive" button was deleting. Prisma's MongoDB `deleteMany` skipped assignments with non-ObjectId `_id`s, leaving orphans; the bootstrap re-imported old data into an empty database. Native deletes avoid both the `_id` issue and the replica-set requirement of `$transaction` (RISK-0020 closed). |
| Linked | GATE-0026, TASK-0095–0101, REQ-0155–0160 |
| Status | DONE |
