# Changelog — Agile V project memory

## 2026-09-24 — Employees Cancel icon + action button gap

- Edit Cancel: Lucide `x` (14) + label on `eh-action-btn-outline`
- `.eh-btn-icon` icon↔label gap `gap-2` → `gap-1.5` (6px); SelectMenu unchanged
- verify-deep PASS WITH WARNINGS (scoped commit); lint/build PASS

## 2026-09-24 — GATE-0017 soak: login + Employees UI polish

- Login: grid `mx-auto`, drop form `sm:max-w-xl`, label `space-y-2`; SelectMenu `gap-2` + pane = trigger (≥16rem, viewport-capped, no 24rem max) — `3445214`
- Employees: skeleton mirrors live ID→avatar row; KPI stub spacing; `.eh-action-btn*` (Close/Add/Save/Cancel/Edit/Delete); view-mode field-label icons; list ID before avatar
- verify-deep PASS WITH WARNINGS (excluded out-of-scope project-employee / project-form); lint/build PASS

## 2026-09-14 — GATE-0016 planning (awaiting screenshots)

- Formalized per-page UI polish as GATE-0016 / REQ-0119–0120 / TASK-0032–0034 / CP-0016
- Halted at Human Gate; coding blocked until screenshots + Option A/B/C
- Repo: `main` @ `555e5d5` (login polish); minor uncommitted login typography tweak noted

## 2026-09-13 — Login polish + SelectMenu height stability

- Login: feature cards (tones + Lucide + stagger), demo credential copy, tighter field stacks
- SelectMenu: `emptyIcon`, single-line selected `label · subtitle`, shared `h-11` with `.eh-control`
- Avatar ring + size 20 matching empty icon; panel checkmark + Clear `x` with `gap-1`
- verify-deep PASS WITH WARNINGS; review-security PASS; lint/test(23)/build PASS

## 2026-09-13 — Page shell + list/dashboard redesign

- Shared `list-page-shell`, `kpi-stat-card`, `list-toolbar` (Lucide search); list-query `?f=` with length cap
- Employees / Projects / Project Team: KPIs, header Add, filters; Projects route-only create/edit
- Dashboard badge strip → KPI cards; chrome-first loading on insights/calendar/API
- verify-deep PASS WITH WARNINGS; review-security PASS WITH WARNINGS; lint/test(23)/build/audit PASS

## 2026-09-11 — GATE-0014 dead-code cleanup + bundle budget

- Raise production initial `maximumWarning` to 1.2MB (clears Vercel budget noise)
- Delete unused hover-tooltip, cors-proxy, unused SVGs, unused api sentry constants
- Remove `font-awesome` and direct `@sentry/browser`; strip dead API helpers
- verify-deep PASS; security review PASS (open-proxy surface removed)

## 2026-09-11 — GATE-0013 UI polish + lockfile (Vercel ERESOLVE)

- SelectMenu overlay width matches trigger; option icons; `.eh-control` / `.eh-select-trigger` / `.eh-btn-icon`
- Button icon↔label `gap-1`; Full Editor uses `<button routerLink>`
- Pin Angular/CLI exact versions; stop gitignoring `package-lock.json` (fixes Vercel npm ERESOLVE)
- Remove `http-proxy-middleware` ^3 override so WDS keeps HPM v2
- verify-deep PASS WITH WARNINGS; security review PASS; lint/audit/build PASS

## 2026-09-11 — GATE-0012 npm audit 0 + Node 24

- Bumped nodemailer to ^9.1.1; Angular 20.3.31 / CLI 20.3.37; Sentry 10.74.x
- Scoped overrides: js-yaml ^4.3.2, qs ^6.16.0, hono ^4.13.7
- Confirmed engines.node 24.x + .nvmrc; `npm audit` 0; lint/build/test PASS
- Security review PASS WITH WARNINGS (lockfile gitignored; Vercel Node dashboard Human-Action)

## 2026-08-25 — Rich cards, AlertDialog, avatars, dist/

- CDK `AlertDialog` (body portal) for deletes + edit-save confirm with busy until list refresh
- Default-collapsed employee/project/assignment cards + reusable close control
- Avatars on lists/dashboard/selects; PE/dashboard API meta (status, dates, avatar)
- Title Case UI chrome; SelectMenu polish; Angular build output `dist/` for Vercel auto-detect
- verify-deep PASS WITH WARNINGS; lint/build/test PASS

## 2026-08-25 — Fix Vercel invalid route source

- Replaced invalid hashed-asset `headers.source` regex in `vercel.json` with path-to-regexp-safe `/:path*.js|css|woff2` patterns (unblocks deploy)

## 2026-08-25 — Session endpoint public-flag fix

- Removed `Session` from `PUBLIC_ACTIONS`; gated by `requireAuth` (401 without cookie)

## 2026-08-25 — Auth, AI, Sentry, SEO/docs

- Session auth (HttpOnly cookie, guards, API middleware), seed demo user
- AI free-tier multi-provider fallback (`ai-providers.mjs`)
- Sentry Angular SDK + `/api/monitoring` tunnel + quiet source-map upload
- SEO metadata, sitemap/robots/browserconfig; educational README + SECURITY.md
- Loading skeletons / MasterService cache; `.env.example`
- verify-deep PASS WITH WARNINGS; lint/build/test PASS

## 2026-08-24 — C1 bootstrap

- Created `.agile-v/` workspace (STATE, REQUIREMENTS, TASKS, RISKS, GATES, DECISION_LOG, VALIDATION_SUMMARY, CHECKLIST, PLAYBOOK, CHECKPOINTS, APPROVALS, CHANGELOG)
- Filled `CLAUDE.md` from codebase facts
- No application source changes
