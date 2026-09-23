# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0017 soak follow-ups (login + Employees) coded; **Human-Action** prod UI soak continues  
**Gate:** GATE-0017 implement **COMPLETE** (awaiting further prod human verify); GATE-0001 **CLOSED**  
**Status:** Soak follow-ups continue: label spacing, create/edit auto-scroll, sticky shell header, Employee save spinner. CP-0019 still open. Use `git status` for ahead/behind.  
**Updated:** 2026-09-24  
**resume_token:** `c1-gate17-prod-ui-soak-2026-09-23`

---

## Resume Point

**Last completed (code):** Employees UX batch — `aboveControl` label gap (create/edit only); smooth scroll on Add/Edit; sticky nav on `app-shell-header` host + `overflow-x-clip`; create/edit save spinner.

**Next exact action:** Human continues **production** soak. Share new screenshots / notes. Agent triages — **no coding until feedback + approval**.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume GATE-0017 prod soak (resume_token c1-gate17-prod-ui-soak-2026-09-23).
Employees UX (labels, scroll, sticky nav, save spinner) shipped; await further prod UI findings.
```

---

## Deferred

- Insights/calendar polish
- Department card → `/employee` deep-link
- Production / remote DB wipe (explicitly gated)
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
- Unrelated local typography diffs on project-form (not part of Employees polish)
