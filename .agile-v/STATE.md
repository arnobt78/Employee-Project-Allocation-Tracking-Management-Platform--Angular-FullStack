# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0018 skeleton parity shipped; prod soak next  
**Gate:** GATE-0018 skeleton parity **COMPLETE**; detail-polish guide (CP-0020) **PENDING**; GATE-0017 soak CP-0019 **PENDING**; GATE-0001 **CLOSED**  
**Status:** Committed locally (not pushed). lint PASS, unit 63/63, production build PASS (initial 989 kB), A–Z browser sweep PASS.  
**Updated:** 2026-10-10  
**resume_token:** `c1-gate18-prod-soak-2026-10-10`

---

## Resume Point

**Completed (GATE-0018, TASK-0053–0060):**

- One mirror skeleton per private page, shared by `route-content-placeholder` and the page's cold-load branch (Project detail, API Doc, API Status, Insights, Calendar); `text-stub` primitive for text-height stubs.
- Calendar split into `calendar-month.ts` helpers + `calendar-month-shell`; `CalendarViewComponent.events` is a signal input (re-renders on fresh data).
- API Doc cached + peek; API Status timer cleared on destroy, amber refresh-failed notice cleared only on success.
- API mutations respond before email delivery (`notifyInBackground` → `@vercel/functions` `waitUntil`; DEC-0031). UpdateEmployee ~6 s → ~1.9 s locally.
- Stale lazy chunk → one reload to target URL (`lib/chunk-reload.ts`, DEC-0032); unknown routes → `/dashboard`.
- Project mutation responses win over in-flight `GetProject` (component token + service issue-time guard); approval/comment no longer double-fetch; login clears caches (DEC-0033).

**Remaining / known (low, pre-existing):**

- Calendar event chips are `div` + `routerLink` (not keyboard-focusable); "+N more" collapse `setTimeout` not cancelled.
- `bg-white/2` / `min-h-auto` classes generate no CSS.
- Deleting a project/employee does not invalidate the client assignment cache; employee edits don't refresh lead names in project list/schedule until TTL.
- Guest `Session` 401 appears in browser console on the login page (intentional: Session sits behind `requireAuth`).

**Blockers:** none. Push/deploy needs human approval (GATE-0002).

**Next exact action:** Human pushes + prod soak (mutation latency, email delivery in Vercel logs, skeleton parity on cold entry). Then CP-0020 project-detail polish guide.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume resume_token c1-gate18-prod-soak-2026-10-10.
GATE-0018 skeleton parity committed locally. Await push/prod soak feedback, then CP-0020 detail-polish guide.
```

---

## Deferred

- `?expand=<id>` list deep-links (pagination edge cases; leave lists static)
- Employee / Project Team dedicated detail routes (optional later; Projects already has detail)
- Department card → `/employee` deep-link
- Production / remote DB wipe (explicitly gated)
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
