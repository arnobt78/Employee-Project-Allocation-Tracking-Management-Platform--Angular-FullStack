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
| RISK-0015 | Mirror skeletons drift from live layout as pages evolve, reintroducing a visible second layer | Medium | Likely over time | REQ-0132–0133 | One shared mirror component per page used by placeholder + page; spec asserts placeholder kind ↔ page skeleton test id | Mitigated |
| RISK-0016 | API Status `setInterval` never cleared — polling continues after leaving the page and stacks on each revisit | Medium | Confirmed (code inspection) | REQ-0135 | Clear timer via `DestroyRef` on destroy | Mitigated |
| RISK-0017 | Background email failures (Resend + SMTP both down) are only logged, not surfaced to the user | Low | Possible | REQ-0140 | `NotificationLog` + failure toast + API Status deliveries panel (DEC-0035) | Mitigated |
| RISK-0018 | `NotificationLog` grows without bound (no TTL/retention) | Low | Likely over time | REQ-0140 | Indexed by `createdAt`; add a TTL index or periodic prune if volume grows | Open |
| RISK-0019 | Failure toast relies on client/server clocks within 10 s; larger skew can miss a failure toast (API Status panel still shows it) | Low | Possible | REQ-0140 | `CLOCK_SKEW_MS` tolerance; panel as fallback | Accepted |
| RISK-0020 | Project/employee deletes use Prisma `$transaction`, which requires a MongoDB replica set | Medium | Possible on DB change | REQ-0138 | Current DB is a replica set; keep it a replica set when migrating | Accepted (watch) |
| RISK-0021 | Assignment API responses include `employeeEmail` (pre-existing exposure to signed-in users) | Low | Confirmed | — | Auth-only API; revisit if roles are added | Accepted |

## Notes

- Severity ranking assumes the Vercel deployment may hold non-trivial data. If deployment is strictly personal demo, Critical may be downgraded — confirm with human (STATE unresolved Q1).
