# GATE-0016 — Per-page UI polish (screenshot-driven)

**Cycle:** C1  
**resume_token:** `c1-gate16-ui-polish-2026-09-14`  
**Status:** PENDING — screenshots not yet received; **no coding until approved**  
**Created:** 2026-09-14

---

## Intent

Human will share UI polish feedback with screenshots in a follow-up prompt. Scope is incremental visual consistency across pages (spacing, typography, controls, cards), not architecture rewrites.

## Traceability

| ID | Statement |
|---|---|
| REQ-0119 | Screenshot-driven polish; preserve architecture + shared control height tokens |
| REQ-0120 | Shell stability + lint/tests/build before commit-ready |
| TASK-0032 | Intake screenshots → map issues |
| TASK-0033 | Implement approved slices only |
| TASK-0034 | verify-deep + commit-ready |

## Constraints (locked)

- Extend existing shared UI (`list-page-shell`, `kpi-stat-card`, `list-toolbar`, `SelectMenu`, `.eh-control` / `.eh-select-trigger` `h-11`)
- Do not introduce parallel architecture or full-page loaders
- Do not grow SelectMenu / control height on selection
- Login already polished in `555e5d5`; only touch login if screenshots demand it or to fold the pending cosmetic diff
- No secrets / env / auth model changes in this gate unless a screenshot proves a security UX bug

## Approval options

| Option | Scope |
|---|---|
| **A** (recommended) | Only pages/components shown in the next screenshot batch |
| **B** | Entire batch in one implement → verify → commit-ready cycle |
| **C** | Hold — planning only |

## Workflow after screenshots

1. Catalog each screenshot issue (page, element, defect, proposed fix)
2. Produce refined scoped plan + Evidence Summary
3. Wait for Option A/B/C approval (record in APPROVALS.md)
4. Implement → verify-deep → commit-ready (no push unless asked)

## Out of scope unless expanded

- GATE-0001 formal close
- REQ-0106 employee password policy
- Major framework migrations
- Big-bang `project-form` / insights splits (REQ-0110)
