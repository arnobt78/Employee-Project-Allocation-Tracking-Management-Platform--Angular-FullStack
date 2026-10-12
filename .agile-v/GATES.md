# Gates — Cycle C1

| ID | Gate | Type | Stage | Status | Criteria |
|---|---|---|---|---|---|
| GATE-0001 | Bootstrap plan approval | Human-Decision | After Stage 1 analysis | **APPROVED / COMPLETE** | Option A as-built (session auth); retroactive close 2026-09-23 |
| GATE-0002 | Release / deploy approval | Human-Decision | After Stage 4 verification | NOT_STARTED | Requires VALIDATION_SUMMARY + eval evidence; no deploy without approval |
| GATE-0012 | Deps/audit + Node 24 verify plan | Human-Decision | Before TASK-0015–0018 coding | **APPROVED / COMPLETE** | User approved plan; audit 0 + lint/build/test PASS 2026-09-11 |
| GATE-0013 | UI SelectMenu/tokens + lockfile deploy fix | Human-Decision | User-directed polish + Vercel ERESOLVE | **APPROVED / COMPLETE** | verify-deep PASS WITH WARNINGS; security PASS; commit-ready 2026-09-11 |
| GATE-0014 | Dead-code cleanup + initial bundle budget | Human-Decision | User-directed cleanup | **APPROVED / COMPLETE** | verify-deep PASS; security PASS; commit-ready 2026-09-11 |
| GATE-0015 | Refresh / loading UX polish (no FOUC / flicker) + shell nav + Zod/list-query | Human-Decision | User-directed implement | **APPROVED / COMPLETE** | verify-deep PASS WITH WARNINGS; security PASS WITH WARNINGS; commit-ready 2026-09-13 |
| GATE-0016 | Per-page UI polish (screenshot-driven) | Human-Action | Stage 4 | **COMPLETE** | Code through `416a7c5`; soak findings drove GATE-0017 |
| GATE-0017 | Boot paint + list/form skeleton mirrors + SelectMenu width + Project Team 6 KPIs | Human-Action | Stage 4 prod soak | **AWAITING PROD VERIFY** | List density+chevron follow-up shipped; CP-0019 continues |
| GATE-0018 | Project detail (`project-form`) UX polish + single-layer mirrored skeletons (Project detail, API Doc, API Status; Insights/Calendar if confirmed) | Human-Decision | Stage 4 | **COMPLETE (skeleton parity)** | verify-deep PASS WITH WARNINGS; security PASS WITH WARNINGS (fixed); commit-ready 2026-10-10. Detail-polish guide (CP-0020) still open |
| GATE-0019 | CRUD speed, inline pending UX, cache cascade, email delivery visibility | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat; verifier + security PASS WITH WARNINGS (fixed); commit-ready 2026-10-10 |
| GATE-0020 | Session check caching, idle list warm-up, instant logout | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat; verifier PASS WITH WARNINGS (fixed); security PASS WITH WARNINGS (RISK-0022 accepted); commit-ready 2026-10-10 |
| GATE-0021 | Server auth automated test suite | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat; verifier PASS WITH WARNINGS (fixed); security PASS; commit-ready 2026-10-10 |
| GATE-0022 | Test-domain email skip + CRUD API tests (Node 24) | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat; verifier PASS WITH WARNINGS (fixed); security PASS; commit-ready 2026-10-10 |
| GATE-0023 | API input validation (edit existence, bad JSON, integer ids), no CC promotion, API docs errors | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat; verifier PASS WITH WARNINGS (fixed); security PASS; commit-ready 2026-10-10 |
| GATE-0024 | Project detail UI consistency with shared components (CP-0020 guide received) | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat 2026-10-11; verifier PASS WITH WARNINGS (all fixed); Contentful 404/400/502 mapping; commit-ready 2026-10-11 |
| GATE-0025 | Avatars, Title Case labels, unassigned date, page consistency (Timeline, Insights, API Status, API Doc) | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat 2026-10-11; verifier FAIL → fixed (purged emerald badge) + all warnings fixed; browser sweep PASS; commit-ready 2026-10-11 |
| GATE-0026 | Archive vs Delete, clean reseed, lead sync, Projects tiles, Timeline readiness/team, consistent project counts | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat 2026-10-12; verifier warnings fixed (archived lead change, stale delete count, lead race, counter rewind, `db push` note); browser sweep PASS; commit-ready 2026-10-12 |
| GATE-0027 | Confirmation on every project-detail mutation, overview shape fix, full regression sweep | Human-Decision | Stage 4 | **COMPLETE** | Plan approved in chat 2026-10-12; verifier PASS WITH WARNINGS (late archive response, spec gaps → fixed); security PASS; browser sweep PASS; commit-ready 2026-10-12 |

## GATE-0001 decision record

- Approved option: **Option A** (security-first C1) — delivered under subsequent user-directed gates
- Auth model choice: HttpOnly `eh_session` + bcrypt `AppUser` + `authGuard` / API middleware (as built)
- Deferred tasks: Insights/calendar polish; dept deep-link; prod DB wipe; major upgrades (see STATE Deferred)
- Approver: User (chat) — requested formal paper-trail close 2026-09-23
- Date: 2026-09-23

Recorded in `APPROVALS.md`; `CHECKPOINTS.md` CP-0001 **RESOLVED**.
