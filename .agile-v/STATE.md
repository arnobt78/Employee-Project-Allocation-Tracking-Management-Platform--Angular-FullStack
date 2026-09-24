# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0017 soak; Project Team Add/Edit smooth scroll shipped  
**Gate:** GATE-0017 implement **COMPLETE** (prod soak continues); GATE-0001 **CLOSED**  
**Status:** Project Team now mirrors Employees Add/Edit viewport scroll (`scheduleScrollTo` + `scroll-mt-24`). Prior PE UX polish remains. Deep-link/detail routes deferred. CP-0019 open.  
**Updated:** 2026-09-24  
**resume_token:** `c1-gate17-prod-ui-soak-2026-09-23`

---

## Resume Point

**Last completed (code):** Project Team Add/Edit smooth scroll — `#createPanel` / `assignment-card-{id}` + `scroll-mt-24`; `scheduleScrollTo` on `startCreate` / `onEdit`. Lint + build PASS; verify-deep PASS.

**Next exact action:** Continue GATE-0017 soak (e.g. Projects page polish) per human plan. Do **not** implement `?expand=` or new employee/assignment detail routes unless approved.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume GATE-0017 soak (resume_token c1-gate17-prod-ui-soak-2026-09-23).
Project Team UX + Add/Edit scroll shipped; deep-link/detail deferred. Await next polish plan.
```

---

## Deferred

- `?expand=<id>` list deep-links (pagination edge cases; leave lists static)
- Employee / Project Team dedicated detail routes (optional later; Projects already has detail)
- Projects page broader polish (next soak candidate)
- Insights/calendar polish
- Department card → `/employee` deep-link
- Production / remote DB wipe (explicitly gated)
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
