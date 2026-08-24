# Project Playbook Pointers

Local Agile V operating notes for **EmpowerHub / employee-management**. Detailed engineering standards live in `docs/`; do not duplicate them here.

## Stack facts

- Frontend: Angular 18 standalone components, Tailwind, shadcn-ng style UI, RxJS
- Backend: Vercel serverless `api/employee-management/[...segments].js` → `handler.mjs` → `repository.mjs`
- DB: MongoDB via Prisma (`prisma/schema.prisma`)
- Local: `npm start` runs `tools/dev-api-server.mjs` + `ng serve` with `proxy.conf.json`

## Authority order

1. `.agile-v/STATE.md` + `REQUIREMENTS.md` + `GATES.md`
2. `CLAUDE.md` / `AGENTS.md`
3. Code (source of truth when docs conflict)
4. `docs/AGILE_V_PROTOCOL.md`
5. Other `docs/*` (note: playbook §0 currently mismatched — see RISK-0007)

## Architecture constraints

- Prefer extend `MasterService` and repository exports — no parallel API clients
- SPA: ignore Next.js RSC/SSR template rules unless migrating
- Mutations: confirm Mongo persistence; refresh affected UI lists/KPIs after success
- Do not invent WebSocket realtime

## Do not

- Read or commit `.env`
- Deploy without GATE-0002
- Self-verify major security work without Red Team / independent review
