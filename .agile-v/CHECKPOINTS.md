# Checkpoints

| ID | Type | Gate | resume_token | Status | Created | Notes |
|---|---|---|---|---|---|---|
| CP-0001 | Human-Decision | GATE-0001 | `c1-gate1-bootstrap-2026-08-24` | **PENDING** | 2026-08-24 | Await approval of Option A/B/C and answers to STATE unresolved questions |

## Resume rules

Resume implementation only when:

1. `APPROVALS.md` contains an entry for GATE-0001 with matching `resume_token`, **or**
2. Human explicitly approves in chat and agent records that approval into `APPROVALS.md` before coding.
