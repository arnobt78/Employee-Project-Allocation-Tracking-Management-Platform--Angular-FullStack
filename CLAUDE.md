# CLAUDE.md

## Project Overview

Project Name: EmpowerHub — Employee & Project Management (employee-management)  
Description: Angular 20 SPA + Vercel serverless API + Prisma/MongoDB for employees, projects, assignments, dashboards, calendar/Gantt, insights, API docs/status, email notifications, optional Contentful + AI drafting, Sentry tunnel.

Current Status: GATE-0028 committed locally, not pushed (seed emails on `example.com`, 90-day `NotificationLog` TTL via `npm run db:push` / `db:indexes`) on top of GATE-0027, also local (confirmation dialog on every project-detail mutation, empty-overview crash fixed) on top of GATE-0026, also local (separate Archive/Restore vs Delete Permanently with Active/Archived tabs, orphan-free native deletes, typed demo seed + guarded `db:reset:demo`, lead auto-assignment + Lead badge, Projects Lead/Contact tiles, Timeline readiness/team size, one "N Active · M Archived" count) on top of GATE-0025 (avatars, Title Case pills, page consistency, pushed); next: push + prod soak 
Current Agile V Cycle: C1 
Current Gate: GATE-0028 COMPLETE; PROD SOAK PENDING

---

## Tech Stack

Frontend: Angular 20 (standalone), TypeScript 5.8, Tailwind 3.4, RxJS 7.8, Lucide, Zod, `@sentry/angular`  
Backend: Node serverless on Vercel (`api/employee-management` + `api/monitoring.js` Sentry tunnel); Zod login body validation  
Database: MongoDB via Prisma 6.19  
Authentication: HttpOnly session cookie (`eh_session`), bcrypt `AppUser`, `authGuard` / `guestGuard`, API auth middleware  
Infrastructure: Vercel (`vercel.json`), local `tools/dev-api-server.mjs` + proxy  
Deployment: Vercel (live demo URL in README)  
Testing: Jasmine/Karma unit specs; API auth tests via `npm run test:api` (`node:test`, `tests/api/`, fake DB); ESLint via `npm run lint`

---

## Architecture

Follow the existing project architecture.

- UI: `src/app/pages/*` (routes), `src/app/components/*` (calendar/gantt/timeline/ui)
- API client: single `MasterService` (+ `AuthService`); mutations via `MutationTracker` (`lib/mutation-tracker.ts`) + `ehAction` button
- API server: `[...segments].js` → `handler.mjs` → `repository.mjs` + `auth.mjs` (per-instance session cache `_lib/session-cache.mjs`) / `notifications.mjs` / `monitoring.mjs` / `ai-providers.mjs`
- Sentry: client tunnel `POST /api/monitoring`; helpers in `api/_lib/sentry/` and `src/app/lib/sentry/`
- Models: `src/app/model/interface/master.ts`, `model/class/Employee.ts`
- Schema: `prisma/schema.prisma` (includes `AppUser`, `Session`, `NotificationLog`)

Do not introduce new architectural patterns unless explicitly approved.

Preserve folder structure, naming, reusable components, utilities, types, and services. Prefer extending existing implementations.

---

## Rendering Rules

This app is a **client-rendered Angular SPA**, not Next.js App Router.

- Do not apply React Server Components / `loading.tsx` rules literally
- Prefer fast perceived UI: keep layout shell stable; use local loading signals on data regions
- Lazy-load heavy views only when approved and consistent with current routing style

---

## State Management

Single source of truth: API + MongoDB.

- Prefer `MasterService` Observables; avoid duplicate HTTP clients
- After successful CRUD: refresh affected lists/KPIs; do not leave stale views
- No TanStack Query in this codebase — do not introduce unless approved

---

## Coding Rules

Always: TypeScript strictness as configured, reusable readable maintainable code.

Avoid: duplicated API calls, dead code, commented-out blocks, unnecessary abstractions, unrelated refactors, committing secrets.

Env: server secrets unprefixed; public client flags may use `NG_APP_*`. Never put AI/CMS/email/DB/`SENTRY_AUTH_TOKEN` under `NG_APP_*`. See `.env.example`.

---

## Validation

Before considering work complete:

- `npm run lint`
- `npm run build`
- `npm test` (as applicable)
- `npm run test:api` (when `api/` changes)
- Record results in `.agile-v/VALIDATION_SUMMARY.md`

---

## Project Memory

Resume from: `.agile-v/STATE.md`  
Requirements: `.agile-v/REQUIREMENTS.md`  
Tasks: `.agile-v/TASKS.md`

---

## Documentation

Update only affected files. Do not duplicate long content across CLAUDE.md, AGENTS.md, and `.agile-v/`.

Protocol: `docs/AGILE_V_PROTOCOL.md`  
Public docs: `README.md`, `SECURITY.md`, `docs/*`

---

## Session Workflow

Before coding: analyze → plan → wait for approval.  
After approval: implement → validate → update project memory → write resume point.

## Resume

Always continue from `.agile-v/STATE.md` unless instructed otherwise.
