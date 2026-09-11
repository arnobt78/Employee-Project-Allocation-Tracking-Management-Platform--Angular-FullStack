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

---

## DEC-0012 — Compatible dep patches only (GATE-0012)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Drive `npm audit` to 0 via nodemailer ≥9.1.1 + overrides (`js-yaml` ≥4.3.2, `qs` ≥6.16.0, `hono` ≥4.13.7) + Angular 20.3.x / Sentry 10.x patch bumps; **do not** migrate Angular 21+, Prisma 7+, Tailwind 4, ESLint 10, or `@lucide/angular` in this slice |
| Rationale | Guardrails §8; terminal shows 6 vulns all fixable in-major; majors would break peers |
| Linked REQ | REQ-0111, REQ-0112 |
| Status | APPROVED and executed (audit 0; lint/build/test PASS) |

---

## DEC-0013 — Track package-lock.json + exact Angular pins (GATE-0013)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Stop gitignoring `package-lock.json`; pin `@angular/*` / CLI / build-angular to exact versions; remove `http-proxy-middleware` ^3 override |
| Rationale | Vercel `npm install` hit ERESOLVE (mixed 20.3.29/20.3.31 peers without lockfile); HPM v3 override broke WDS proxy (`Missing target`) |
| Linked | GATE-0013, Vercel deploy |
| Status | APPROVED and executed |

---

## DEC-0014 — Raise initial budget + delete proven unused (GATE-0014)

| Field | Value |
|---|---|
| Date | 2026-09-11 |
| Decision | Raise initial `maximumWarning` to 1.2MB; delete zero-ref files/deps/helpers only (cors-proxy, hover-tooltip, unused SVGs, font-awesome, dead API helpers) |
| Rationale | Honest demo SPA size; reduce attack surface (open cors-proxy) and maintenance noise without Angular major upgrade |
| Linked | GATE-0014 |
| Status | APPROVED and executed |
