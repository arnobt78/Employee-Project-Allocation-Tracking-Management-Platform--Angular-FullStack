# Checkpoints

| ID | Type | Gate | resume_token | Status | Created | Notes |
|---|---|---|---|---|---|---|
| CP-0001 | Human-Decision | GATE-0001 | `c1-gate1-bootstrap-2026-08-24` | **RESOLVED** | 2026-08-24 | Retroactive APPROVED 2026-09-23 — Option A as-built; see APPROVALS.md |
| CP-0012 | Human-Decision | GATE-0012 | `c1-gate12-deps-audit-2026-09-11` | **RESOLVED** | 2026-09-11 | Plan approved in chat; implement + verify-deep + commit-ready complete |
| CP-0013 | Human-Decision | GATE-0013 | `c1-gate13-ui-lockfile-2026-09-11` | **RESOLVED** | 2026-09-11 | UI polish + lockfile; verify-deep + security + commit-ready complete |
| CP-0014 | Human-Decision | GATE-0014 | `c1-gate14-cleanup-budget-2026-09-11` | **RESOLVED** | 2026-09-11 | Dead-code + budget; verify-deep + security + commit-ready complete |
| CP-0015 | Human-Decision | GATE-0015 | `c1-gate15-refresh-ux-2026-09-13` | **RESOLVED** | 2026-09-13 | Shell/nav FOUC + Phase A/B Zod/list-query; verify-deep + security + commit-ready |
| CP-0016 | Human-Decision | GATE-0016 | `c1-gate16-ui-polish-2026-09-14` | **RESOLVED** | 2026-09-14 | Screenshot waves + cold-load + stack gap shipped through `416a7c5` |
| CP-0017 | Human-Action | GATE-0016 | `c1-gate16-prod-ui-soak-2026-09-22` | **RESOLVED** | 2026-09-22 | Soak findings (blank boot, list mirrors, SelectMenu, form skeleton) implemented as GATE-0017 |
| CP-0018 | Human-Decision | GATE-0017 | `c1-gate17-complete-2026-09-23` | **RESOLVED** | 2026-09-23 | Boot CSS, skeleton params, SelectMenu clamp, form checklist=5, Project Team People KPI |
| CP-0019 | Human-Action | GATE-0017 | `c1-gate17-prod-ui-soak-2026-09-23` | **PENDING** | 2026-09-23 | Soak ongoing; list density+chevron shipped; further prod feedback welcome |
| CP-0020 | Human-Action | GATE-0018 | `c1-gate18-project-detail-intake-2026-09-26` | **RESOLVED** | 2026-09-26 | Guide received 2026-10-11 (screenshots + 8 points) → GATE-0024 |
| CP-0022 | Human-Decision | GATE-0024 | `c1-gate24-detail-ui-2026-10-11` | **RESOLVED** | 2026-10-11 | Plan approved; implemented + verified + committed |
| CP-0024 | Human-Action | GATE-0025 | `c1-gate25-prod-soak-2026-10-11` | **PENDING** | 2026-10-12 | User testing prod; bugs / UI mismatches to be reported and planned before coding |
| CP-0025 | Human-Action | GATE-0026, GATE-0027 | `c1-gate27-prod-soak-2026-10-12` | **PENDING** | 2026-10-12 | Committed locally; push + prod soak of archive/restore, delete, lead sync, counts, detail confirmations |
| CP-0026 | Human-Decision | GATE-0027 | `c1-gate27-detail-confirms-2026-10-12` | **RESOLVED** | 2026-10-12 | Plan approved; implemented + verified + committed |
| CP-0023 | Human-Decision | GATE-0025 | `c1-gate25-ui-polish-2026-10-11` | **RESOLVED** | 2026-10-11 | Plan approved; implemented + verified + committed |
| CP-0021 | Human-Decision | GATE-0018 | `c1-gate18-skeleton-parity-2026-10-10` | **RESOLVED** | 2026-10-10 | Plan approved; implemented + verified + committed |

## Resume rules

Resume implementation only when:

1. `APPROVALS.md` contains an entry for GATE-0001 with matching `resume_token`, **or**
2. Human explicitly approves in chat and agent records that approval into `APPROVALS.md` before coding.
