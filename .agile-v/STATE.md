# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0020 session caching + idle warm-up + instant logout shipped; prod soak next  
**Gate:** GATE-0020 **COMPLETE**; GATE-0019 **COMPLETE**; GATE-0018 skeleton parity **COMPLETE**; detail-polish guide (CP-0020) **PENDING**; GATE-0017 soak CP-0019 **PENDING**; GATE-0001 **CLOSED**  
**Status:** Committed locally (not pushed). lint PASS, unit 105/105, production build PASS (initial 922.92 kB), A–Z browser sweep PASS.  
**Updated:** 2026-10-10  
**resume_token:** `c1-gate20-prod-soak-2026-10-10`

---

## Resume Point

**Completed (GATE-0020, TASK-0068–0071):**

- Session check cached per instance (`api/_lib/session-cache.mjs`, DEC-0036): auth ~460 ms → ~1 ms warm / ~233 ms cold; login primes the cache; logout tombstone closes the revoke race. `SESSION_CACHE_TTL_SECONDS` default 30.
- Shared native Mongo client `api/_lib/mongo-client.mjs` (auth + repository).
- `LayoutComponent` idle-prefetches Employees/Projects/Project Team lists (`MasterService.warmLists`).
- Instant logout (DEC-0037): local sign-out + navigate (~70 ms); keepalive revoke with retry/toast; login waits for pending revoke; interceptor ignores 401s from an ended session (auth epoch); in-flight list reads dropped on cache clear.

**Completed (GATE-0019, TASK-0061–0067):**

- Inline pending per action button (`lib/mutation-tracker.ts` `MutationTracker` + `PendingSet`, `components/ui/action-button.component.ts` `ehAction`) on Employees, Projects, Project Team, Project detail. Dynamic labels ("Deleting…", "Approving…"); duplicate submits ignored; pending buttons keep focus (`aria-disabled`).
- `MasterService` list cache cascades invalidations (project/employee delete → assignments) and refetches responses issued before an invalidation.
- Server: native atomic counter (DEC-0034), parallel lookups, `$transaction` deletes, dev-only timing logs (`api/_lib/timing.mjs`).
- Email outcomes stored in `NotificationLog` (DEC-0035) with redacted errors; `NotificationMonitorService` toasts failures after mutations; API Status shows "Recent Email Deliveries". New API routes `GetNotificationLog`, `GetNotificationFailures`.
- Calendar "+N more": mouse-only hover expand, keyboard toggle, Escape refocus, collapse timer cancelled.

**Remaining / known (low):**

- Cross-instance revocation window up to 30 s (RISK-0022, accepted).
- No automated tests for `api/` code (session cache covered by a manual Node smoke script).
- `NotificationLog` has no retention/TTL (RISK-0018).
- Prisma `$transaction` deletes need a MongoDB replica set (RISK-0020).
- Calendar event chips are `div` + `routerLink` (not keyboard-focusable).
- `bg-white/2` / `min-h-auto` classes generate no CSS.
- Employee edits don't refresh lead names in project list/schedule until TTL.
- Guest `Session` 401 on the login page console (intentional).

**Blockers:** none. Push/deploy needs human approval (GATE-0002). `prisma db push` already applied to the configured DB (`NotificationLog`).

**Next exact action:** Human pushes + prod soak (auth/CRUD latency on Vercel, instant logout, pending labels, deliveries panel, failure toast). Optionally set `SESSION_CACHE_TTL_SECONDS` in Vercel env. Then CP-0020 project-detail polish guide.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume resume_token c1-gate20-prod-soak-2026-10-10.
GATE-0020 committed locally. Await push/prod soak feedback, then CP-0020 detail-polish guide.
```

---

## Deferred

- `?expand=<id>` list deep-links (pagination edge cases; leave lists static)
- Employee / Project Team dedicated detail routes (optional later; Projects already has detail)
- Department card → `/employee` deep-link
- Production / remote DB wipe (explicitly gated)
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
