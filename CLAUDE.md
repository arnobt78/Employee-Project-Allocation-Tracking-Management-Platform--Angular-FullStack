# CLAUDE.md

## Project Overview

Project Name: EmpowerHub — Employee & Project Management (employee-management)  
Description: Angular 20 SPA + Vercel serverless API + Prisma/MongoDB for employees, projects, assignments, dashboards, calendar/Gantt, insights, API docs/status, email notifications, optional Contentful + AI drafting, Sentry tunnel.

Current Status: GATE-0017 complete locally; Projects list UX polish shipped (readiness + expand); deep-link/detail deferred; soak continues; GATE-0001 closed 
Current Agile V Cycle: C1 
Current Gate: GATE-0017 AWAITING PROD VERIFY (GATE-0001 CLOSED)

---

## Tech Stack

Frontend: Angular 20 (standalone), TypeScript 5.8, Tailwind 3.4, RxJS 7.8, Lucide, Zod, `@sentry/angular`  
Backend: Node serverless on Vercel (`api/employee-management` + `api/monitoring.js` Sentry tunnel); Zod login body validation  
Database: MongoDB via Prisma 6.19  
Authentication: HttpOnly session cookie (`eh_session`), bcrypt `AppUser`, `authGuard` / `guestGuard`, API auth middleware  
Infrastructure: Vercel (`vercel.json`), local `tools/dev-api-server.mjs` + proxy  
Deployment: Vercel (live demo URL in README)  
Testing: Jasmine/Karma unit specs; ESLint via `npm run lint`

---

## Architecture

Follow the existing project architecture.

- UI: `src/app/pages/*` (routes), `src/app/components/*` (calendar/gantt/timeline/ui)
- API client: single `MasterService` (+ `AuthService`)
- API server: `[...segments].js` → `handler.mjs` → `repository.mjs` + `auth.mjs` / `notifications.mjs` / `monitoring.mjs` / `ai-providers.mjs`
- Sentry: client tunnel `POST /api/monitoring`; helpers in `api/_lib/sentry/` and `src/app/lib/sentry/`
- Models: `src/app/model/interface/master.ts`, `model/class/Employee.ts`
- Schema: `prisma/schema.prisma` (includes `AppUser`, `Session`)

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
