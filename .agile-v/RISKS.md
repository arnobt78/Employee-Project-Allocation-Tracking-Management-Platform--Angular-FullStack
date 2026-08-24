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

## Notes

- Severity ranking assumes the Vercel deployment may hold non-trivial data. If deployment is strictly personal demo, Critical may be downgraded — confirm with human (STATE unresolved Q1).
