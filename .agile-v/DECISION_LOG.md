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
| Alternatives | Pause until GATE-0001 APPROVALS entry (rejected by user direction) |
