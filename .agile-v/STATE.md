# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0017 soak follow-ups (login + Employees) coded; **Human-Action** prod UI soak continues  
**Gate:** GATE-0017 implement **COMPLETE** (awaiting further prod human verify); GATE-0001 **CLOSED**  
**Status:** Soak findings for login (`3445214`) + Employees list/actions/labels/skeleton committed this session. CP-0019 still open for remaining prod feedback. Use `git status` for ahead/behind.  
**Updated:** 2026-09-24  
**resume_token:** `c1-gate17-prod-ui-soak-2026-09-23`

---

## Resume Point

**Last completed (code):** GATE-0017 soak follow-up — login centering/SelectMenu trigger-width/`space-y-2` (`3445214`); Employees skeleton ID→avatar mirror, `eh-action-btn*` height tokens, view-mode `app-field-label` icons, list ID before avatar.

**Next exact action:** Human continues **production** soak (hard refresh, soft nav, remaining pages). Share new screenshots / notes. Agent triages — **no coding until feedback + approval**. Leave unrelated dirty `project-employee` / `project-form` typography local unless approved.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume GATE-0017 prod soak (resume_token c1-gate17-prod-ui-soak-2026-09-23).
Login + Employees polish shipped; await further prod UI findings before next implement.
```

---

## Deferred

- Insights/calendar polish
- Department card → `/employee` deep-link
- Production / remote DB wipe (explicitly gated)
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
- Unrelated local typography diffs on project-employee / project-form (not part of Employees polish)
