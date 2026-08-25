# Changelog — Agile V project memory

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
