# GATE-0015 — Refresh / loading UX (no FOUC, no flicker)

**Status:** Awaiting Human-Decision (CP-0015)  
**Cycle:** C1  
**Do not implement until Option A or B is approved in chat.**

## Resume / reconcile

- Last formal gate: GATE-0014 (`a616ed2`)
- HEAD: `7ac816b` (UI text/gap commits after cleanup); working tree clean
- Checkpoint: `c1-gate15-refresh-ux-2026-09-13` PENDING
- Screenshots: not attached yet — refine acceptance when provided

## Problem (evidence)

1. Pre-CSS FOUC: `src/index.html` body has no inline background before CSS loads
2. Translucent `.app-shell` gradients with no solid base (`app.component.html`)
3. Auth refresh flash: `app.component.ts` forces `layout: 'auth'` until NavigationEnd while `ensureSession()` runs
4. Uneven loaders: api-doc / api-status text “Loading…”; employee/project already local skeletons

## Requirements

- REQ-0113 — no white/blank bg flash on hard refresh
- REQ-0114 — stable private shell during session resolve
- REQ-0115 — local skeletons; no global full-page loader
- REQ-0116 — login base surface aligns with shell `--background`

## Tasks (after approval)

| Option | Tasks |
|--------|--------|
| **A** | TASK-0020…0022 (FOUC + shell) |
| **B** (recommended) | TASK-0020…0024 (full wave) |
| **C** | Defer until screenshots |

## Implementation sketch

- TASK-0020: inline critical `html,body` bg + `color-scheme` in `index.html`; reinforce in `styles.css`
- TASK-0021: solid `bg-background` under `.app-shell`
- TASK-0022: private URLs keep private shell during session; update specs; safe redirect on fail
- TASK-0023: api-doc / api-status → `app-list-skeleton`; tighten dashboard if needed
- TASK-0024: align login floating bg with `--background`

## Out of scope

Angular 22, lazy-route rewrite, global NavigationStart spinner, broader visual redesign

## Done when

Hard refresh `/dashboard` (logged in): continuous dark shell, stable private chrome, local skeletons.  
Hard refresh `/login`: no white flash. Lint + build pass.
