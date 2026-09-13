# Risks — Cycle C1

| ID | Risk | Severity | Likelihood | Related REQ | Mitigation (proposed) | Status |
|---|---|---|---|---|---|---|
| RISK-0001 | Private routes accessible without login (no guard/session) | High | Confirmed | REQ-0103 | Add functional guard + session flag/token; redirect to login | Mitigated |
| RISK-0002 | Serverless API appears unauthenticated — anyone with URL can mutate MongoDB data | Critical | Confirmed (code inspection) | REQ-0104 | Require auth on mutating/sensitive endpoints; rate-limit if feasible | Mitigated |
| RISK-0003 | Demo credentials hardcoded in client bundle | High | Confirmed | REQ-0105 | Env-only secrets; disable demo auth in production builds | Accepted (demo portfolio; documented) |
| RISK-0004 | Employee `password` field stored; hashing/redaction unclear | High | Suspected | REQ-0106 | Audit create/update/list responses; hash or remove field | Open |
| RISK-0005 | Verbose request logging in Vercel handler may leak paths/PII in logs | Medium | Confirmed | — | Reduce production log verbosity | Open |
| RISK-0006 | Monolithic handler/repository increases regression risk on any API change | Medium | Confirmed | REQ-0110 | Incremental extraction; avoid big-bang | Accepted (watch) |
| RISK-0007 | README / SECURITY.md / playbook drift misleads agents and operators | Medium | Confirmed | REQ-0101 | Doc reconciliation Wave 1–2 | Open |
| RISK-0008 | Thin unit tests (`should create` only) allow silent regressions | Medium | Confirmed | REQ-0108 | Expand critical path tests | Open |
| RISK-0009 | Backup `handler.mjs.bak*` may confuse agents or be accidentally edited | Low | Confirmed | REQ-0107 | Delete with DEC | Mitigated |
| RISK-0010 | `.env` present locally; accidental commit or AI ingestion of secrets | High | Possible | REQ-0102 | Keep gitignored; add `.env.example`; never read `.env` into agent context | Mitigated (policy) |
| RISK-0011 | Fresh install audit dirty (6 vulns) — js-yaml, nodemailer, qs, hono transitive | High | Confirmed 2026-09-11 | REQ-0112 | Patch + scoped overrides; avoid `audit fix --force` majors | Mitigated (audit 0) |
| RISK-0012 | Blind major bumps (Angular 21+, Prisma 7+, Tailwind 4, ESLint 10, lucide → `@lucide/angular`) break peers / UI | High | Confirmed by outdated map | REQ-0112 | Stay on Angular 20 LTS + Prisma 6 + Tailwind 3 | Mitigated (plan lock) |
| RISK-0013 | Vercel dashboard Node still on 20 despite `engines` 24.x | Medium | Possible | REQ-0111 | Confirm Project Settings → Node 24 (package.json overrides when set) | Open |
| RISK-0014 | Private shell shown before session fails could briefly flash chrome then redirect to login | Medium | Possible after TASK-0022 | REQ-0114 | Instant shell accepted: nav+placeholder paint early; child routes + API still guarded | Accepted (UX) |

## Notes

- Severity ranking assumes the Vercel deployment may hold non-trivial data. If deployment is strictly personal demo, Critical may be downgraded — confirm with human (STATE unresolved Q1).
