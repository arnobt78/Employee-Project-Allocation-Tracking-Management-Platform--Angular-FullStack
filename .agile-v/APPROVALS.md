# Approvals

Append-only human gate records.

| Timestamp | Gate | resume_token | Approver | Decision | Scope | Notes |
|---|---|---|---|---|---|---|
| 2026-09-13 | GATE-0015 | `c1-gate15-refresh-ux-2026-09-13` | User (chat) | APPROVED | Shell/nav FOUC + Phase A/B Zod/list-query | implement-deep → verify-deep → commit-ready |
| 2026-09-11 | GATE-0012 | `c1-gate12-deps-audit-2026-09-11` | User (chat) | APPROVED | TASK-0015–0018 deps/audit + Node 24 | Plan attach + implement executed |
| _none yet_ | GATE-0001 | `c1-gate1-bootstrap-2026-08-24` | — | PENDING | Wave plan Options A/B/C | See GATES.md / TASKS.md — superseded by row below |
| 2026-09-23 | GATE-0001 | `c1-gate1-bootstrap-2026-08-24` | User (chat) | APPROVED | Option A (security-first) as-built; session auth | Retroactive close — Waves 1+ delivered under user direction; formal row requested 2026-09-23 |
| 2026-10-10 | GATE-0018 | `c1-gate18-skeleton-parity-2026-10-10` | User (chat) | APPROVED | DEC-0030 single-layer skeletons; background email via `waitUntil` | implement-deep → verify-deep → security → commit-ready |
| 2026-10-10 | GATE-0019 | `c1-gate19-crud-speed-2026-10-10` | User (chat) | APPROVED | CRUD speed + pending UX + cache cascade + email visibility plan | Plan attached + implement; DEC-0034 deviation recorded |
| 2026-10-10 | GATE-0020 | `c1-gate20-session-cache-2026-10-10` | User (chat) | APPROVED | Session check caching + idle warm-up plan; instant logout request | Default cache TTL 30 s (plan said 60 s) after security review |
| 2026-10-10 | GATE-0022 | `c1-gate22-prod-soak-2026-10-10` | User (chat) | APPROVED | Test-domain email skip + CRUD API tests on Node 24 | CC promotion and 400/404 fixes added during verification |
