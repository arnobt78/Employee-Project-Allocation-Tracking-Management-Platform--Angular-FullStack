# Tasks — Cycle C1 (prioritized plan)

**Status:** Active — Waves 1+ delivered under user direction (GATE-0001 retroactively closed 2026-09-23)  
**Rule:** Implementation proceeds under approved gates / user chat approval. Waves are sequential; tasks within a wave may parallelize if independent.

---

## Wave 0 — Analysis & memory (THIS SESSION)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0000 | Bootstrap `.agile-v/`, reconcile CLAUDE.md, produce plan | REQ-0100 | DONE |

---

## Wave 1 — Safety & honesty (P0)

| ID | Task | REQ | Affected areas | Depends |
|---|---|---|---|---|
| TASK-0001 | Add `.env.example` (placeholders only); document required vars; ensure secrets stay gitignored | REQ-0102 | root, README env section | DONE |
| TASK-0002 | Create `SECURITY.md` matching README link OR remove link; document demo-auth threat model | REQ-0101, REQ-0105 | root, docs | DONE |
| TASK-0003 | Align README project-structure claims with actual `api/_lib` (only `prisma-client.mjs`) | REQ-0101 | README.md | DONE |
| TASK-0004 | Decide + implement minimal session/guard for private routes (or document intentional open demo with warning) | REQ-0103 | `login`, `layout`, `app.routes`, optional auth service | DONE (session auth) |
| TASK-0005 | Add API auth boundary for mutating endpoints (and sensitive reads) consistent with chosen auth model | REQ-0104 | `handler.mjs`, possibly middleware helper in `api/_lib` | DONE |
| TASK-0006 | Stop shipping hardcoded demo password as production default; wire env overrides already described in README | REQ-0105 | `environment.ts`, `generate-env-prod.*` | PARTIAL (demo autofill remains public; seeded bcrypt user; documented threat model) |

---

## Wave 2 — Quality baseline (P1)

| ID | Task | REQ | Affected areas |
|---|---|---|---|
| TASK-0007 | Delete or quarantine `handler.mjs.bak*` with DEC entry | REQ-0107 | `api/employee-management/` | DONE |
| TASK-0008 | Fix playbook §0 overrides for this Angular/Vercel repo (or mark file as portable template only) | REQ-0101 | `docs/PROJECT_ENGINEERING_PLAYBOOK.md` | OPEN |
| TASK-0009 | Install deps; run `ng build`; record results in VALIDATION_SUMMARY | REQ-0108 | CI-local | DONE |
| TASK-0010 | Upgrade critical specs beyond smoke (`MasterService` CRUD URL contracts, login success/fail) | REQ-0108 | `*.spec.ts` | OPEN |
| TASK-0011 | Add lint script (ESLint) if approved — README claims it today but package.json lacks it | REQ-0108 | package.json, eslint config | DONE |

---

## Wave 3 — Maintainability (P2, optional / deferrable)

| ID | Task | REQ | Notes |
|---|---|---|---|
| TASK-0012 | Extract notification builders from `handler.mjs` into dedicated module | REQ-0110 | Vertical slice; no behavior change |
| TASK-0013 | Split `project-form.component.ts` into form sections / services | REQ-0110 | High risk of regressions; needs own gate |
| TASK-0014 | Clarify employee password handling (hash, omit from API responses) | REQ-0106 | Security review |

---

## Wave — Node 24 + audit 0 (2026-09-11)

| ID | Task | REQ | Status |
|---|---|---|---|
| TASK-0015 | Confirm Node 24 pins (`engines`, `.nvmrc`); note Vercel dashboard Node Human-Action | REQ-0111 | DONE |
| TASK-0016 | Patch direct deps within compatible majors (nodemailer ≥9.1.1; Angular 20.3.x latest; Sentry 10.x patch) | REQ-0112 | DONE |
| TASK-0017 | Scoped `overrides` for transitive `js-yaml`, `qs`, `hono` to patched versions | REQ-0112 | DONE |
| TASK-0018 | Clean reinstall; `npm audit` = 0; `npm run lint` + `npm run build` (+ test if green) | REQ-0112 | DONE |
| TASK-0019 | Evaluate Redis/Sentry/PostHog guide vs product need | — | Sentry implemented; Redis/PostHog deferred |

---

## Wave — Refresh / loading UX polish (GATE-0015 — COMPLETE)

| ID | Task | REQ | Status | Affected areas |
|---|---|---|---|---|
| TASK-0020 | Critical CSS / inline `html,body` background + `color-scheme` matching `--background`; align `theme-color` | REQ-0113 | DONE | `src/index.html`, `src/styles.css` |
| TASK-0021 | Solid `bg-background` under `.app-shell` gradients | REQ-0113 | DONE | `app.component.html` / css |
| TASK-0022 | Private-URL refresh: keep private shell during `ensureSession`; auth-gated nav; update specs | REQ-0114 | DONE | `app.component.ts`, shell header, specs |
| TASK-0023 | Localize remaining text loaders (api-doc / api-status) to `app-list-skeleton`; tighten dashboard if still full-swap | REQ-0115 | DONE | api-doc, api-status, dashboard templates |
| TASK-0024 | Align login floating background base with shell `--background` | REQ-0116 | DONE | floating-background / login |
| TASK-0025 | Zod login validation client + server | REQ-0117 | DONE | auth.schema + login + handler |
| TASK-0026 | List URL `?q=`/`?page=` + client pagination | REQ-0118 | DONE | list-query + employee/projects/assignments |

---

## Wave — Page shell + list/dashboard redesign (2026-09-13 — COMPLETE)

| ID | Task | Status | Affected areas |
|---|---|---|---|
| TASK-0027 | Shared `list-page-shell` / `kpi-stat-card` / `list-toolbar` + placeholder alignment | DONE | `components/ui/*`, `route-content-placeholder`, `private-page-meta` |
| TASK-0028 | Employees / Projects / Project Team KPI + filter redesign (`?f=`) | DONE | employee, project, project-employee, list-query |
| TASK-0029 | Dashboard badge strip → KPI cards | DONE | dashboard |
| TASK-0030 | Projects route-only create/edit (remove inline dual editor) | DONE | project list + existing project-form routes |
| TASK-0031 | Chrome-first loading on insights/calendar/API pages | DONE | business-insights, calendar-timeline, api-doc, api-status |

---

## Wave — Per-page UI polish (GATE-0016 — COMPLETE)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0032 | Intake screenshot batch; map issues → pages/components | REQ-0119 | DONE | Dashboard + list screenshots |
| TASK-0033 | Implement approved polish slices only (preserve shell/tokens/`h-11`) | REQ-0119 | DONE | List pages wave coded |
| TASK-0034 | verify-deep + commit-ready for approved slice(s) | REQ-0120 | DONE | List wave committed |
| TASK-0035 | List toolbar v2: SelectMenu multi-filter + Clear + soft skeleton | REQ-0121 | DONE | Shared foundation |
| TASK-0036 | Fix seed path to `dataset/`; local wipe+reseed; enrich sample JSON | REQ-0122 | DONE | Wipe localhost-only; dataset tracked |
| TASK-0037 | List cold-load skeleton; remove KPI emdash flash; shell gap parity | REQ-0123–0124 | DONE | Verified + committed |
| TASK-0038 | Intake prod UI soak findings; map → REQ/TASK; propose Option A/B/C | REQ-0119 | DONE | Findings → GATE-0017 |

---

## Wave — GATE-0017 boot / skeleton / SelectMenu / Team KPIs (COMPLETE)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0039 | Pre-boot ambient radials in `index.html` | REQ-0125 | DONE | Match shell before Angular mounts |
| TASK-0040 | Parametrize list skeletons + project-form skeleton | REQ-0126 | DONE | Meta + shell + form checklist=5 |
| TASK-0041 | SelectMenu pane width (≥16rem, viewport-capped; later drop 24rem max) | REQ-0127 | DONE | measurePaneWidth + styles.css; soak follow-up |
| TASK-0042 | Project Team 6th KPI (People) + listKpiCount=6 | REQ-0128 | DONE | Parity with employee/projects |
| TASK-0043 | verify-deep + security + commit-ready | REQ-0120 | DONE | Local A–Z crawl; docs synced |
| TASK-0044 | Login soak polish: center pair, SelectMenu gap/width, label spacing | REQ-0119 | DONE | `3445214` |
| TASK-0045 | Employees soak polish: skeleton mirror, eh-action-btn*, view labels, ID→avatar | REQ-0119–0120, REQ-0126 | DONE | `4502209` |
| TASK-0046 | Employees Cancel icon + `.eh-btn-icon` gap-1.5 | REQ-0119 | DONE | `6db459c` |
| TASK-0047 | Field-label aboveControl; create/edit scroll; sticky nav host; save spinner | REQ-0119 | DONE | Employees UX |
| TASK-0048 | Projects list UX polish: skeleton, titlecase, eh-action-btn*, readiness+expand | REQ-0119–0120, REQ-0126 | DONE | `eec34a3` |

---

## Wave — GATE-0018 project detail polish (intake) + GATE-0017 list soak follow-up

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0049 | Projects list density: two-row card + border chevron expand; skeleton mirror | REQ-0129 | DONE | This commit |
| TASK-0050 | Intake project **detail** guide; map issues → `project-form` sections/components | REQ-0130 | OPEN | Screenshots / written guide |
| TASK-0051 | Implement only approved detail slices; preserve tokens/shell | REQ-0130–0131 | BLOCKED | Needs detail guide approval |
| TASK-0052 | verify-deep + commit-ready for approved detail slice(s) | REQ-0131 | BLOCKED | After TASK-0051 |

## Wave — GATE-0018 single-layer mirrored skeletons (intake 2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0053 | Intake human screenshots (Project detail, API Status, API Doc); confirm findings and whether Insights/Calendar join this wave | REQ-0132–0133 | DONE | Screenshots received; Insights/Calendar included |
| TASK-0054 | Shared contract: header-action stub spec on `PRIVATE_PAGE_META`; new skeleton kinds; placeholder renders the same page mirror component as the page | REQ-0132 | DONE | Approved CP-0021 |
| TASK-0055 | API Doc: mirror skeleton (info card, method tabs, category chips, endpoint cards) + cache/peek | REQ-0132–0134 | DONE | 2026-10-10 |
| TASK-0056 | API Status: mirror skeleton (overall card, 4 metric tiles, tabs, panel) + clear auto-refresh timer on destroy | REQ-0132–0133, REQ-0135 | DONE | 2026-10-10 |
| TASK-0057 | Project detail: loading wrapper + header stubs match placeholder; extend form skeleton with section accordion stubs | REQ-0130, REQ-0132–0133 | DONE | 2026-10-10 |
| TASK-0058 | Insights + Calendar: same single-layer mirror treatment | REQ-0132–0133 | DONE | 2026-10-10 |
| TASK-0059 | Spec coverage (placeholder kind matches page skeleton) + verify-deep + commit-ready per page | REQ-0131 | DONE | 2026-10-10 |
| TASK-0060 | A–Z verify sweep fixes: background email (`waitUntil`), stale-chunk reload, `**` redirect, mutation-vs-read race, cache clear on login, API Status notice clear-on-success | REQ-0131 | DONE | 2026-10-10 |

## Wave — GATE-0019 CRUD speed, pending UX, cache cascade, email visibility (2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0061 | List cache: `INVALIDATES` cascade (project/employee delete → assignments) + refetch when a response was issued before an invalidation | REQ-0136 | DONE | `MasterService.getCached` generation check |
| TASK-0062 | Calendar "+N more": cancelled collapse timer, keyboard toggle, mouse-only hover expand, Escape refocus | REQ-0139 | DONE | Touch tap no longer double-toggles |
| TASK-0063 | `MutationTracker` + `PendingSet` + `ehAction` button rolled out to Employees, Projects, Project Team, Project detail (dynamic pending labels) | REQ-0137 | DONE | Per-key pending; duplicate-submit guard; `destroyRef` skips stale callbacks |
| TASK-0064 | Server speed: native atomic counter, parallel lookups, `$transaction` deletes, assignment response mapping, dev-only timing logs | REQ-0138 | DONE | See VALIDATION_SUMMARY timings |
| TASK-0065 | `NotificationLog` model + `GetNotificationLog` / `GetNotificationFailures`; redacted errors; Resend/SMTP timeouts | REQ-0140 | DONE | DEC-0035 |
| TASK-0066 | `NotificationMonitorService` failure toast + API Status "Recent Email Deliveries" panel | REQ-0140 | DONE | Coalesced checks at 6/15/30 s |
| TASK-0067 | Lint/test/build + A–Z browser sweep + verifier + security review; fix findings | REQ-0131 | DONE | 95/95 unit |

## Wave — GATE-0020 session check caching, idle warm-up, instant logout (2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0068 | Shared `api/_lib/mongo-client.mjs`; per-instance session cache (`api/_lib/session-cache.mjs`) + single-aggregate session lookup; login primes cache | REQ-0141 | DONE | Auth ~460 ms → ~1 ms warm / ~233 ms cold |
| TASK-0069 | Logout revocation: tombstone closes logout-vs-lookup race; junk tokens not retained | REQ-0141 | DONE | DEC-0036 |
| TASK-0070 | Idle warm-up of Employees/Projects/Project Team lists from `LayoutComponent` | REQ-0142 | DONE | Soft nav served from cache |
| TASK-0071 | Instant logout: local sign-out + navigate; keepalive revoke with timeout/retry/warning; login waits for pending revoke; stale-401 epoch guard; in-flight reads dropped on cache clear | REQ-0143 | DONE | DEC-0037; logout → login ~70 ms |

## Wave — GATE-0021 server auth test suite (2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0072 | `tests/api/support/fake-db.mjs`: in-memory Prisma + Mongo `Session` aggregate fakes (pipeline shape checked), `seedUser`, lookup gate, `pinTestEnv` | REQ-0144 | DONE | DEC-0038 |
| TASK-0073 | `session-cache.test.mjs` (12), `auth.test.mjs` (24), `auth-flow.test.mjs` (11, real Vercel entry over HTTP); `npm run test:api` | REQ-0144 | DONE | 47/47; mutation checks caught |
| TASK-0074 | Fixes found while testing: malformed cookie → 401 not 500 (`parseCookies`); login background image eager + `fetchpriority` (NG0913) | REQ-0144 | DONE | `OptimizedImageComponent` `priority` input |

## Wave — GATE-0022 email skip + CRUD API tests (2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0075 | `notifications.mjs`: skip reserved test-domain recipients (`isDeliverableAddress`); log as skipped (CC promotion later removed in TASK-0081) | REQ-0145 | DONE | DEC-0039; live probe 0 failures |
| TASK-0076 | Fake DB covers every Prisma model + Mongo counter (shape checked); shared `startApiServer` helper; Node 24 guard | REQ-0146 | DONE | `tests/api/support/` |
| TASK-0077 | `crud-flow.test.mjs` (14) and `notifications.test.mjs` (8) | REQ-0145, REQ-0146 | DONE | 69/69 on Node 24.16 and 24.21 |
| TASK-0078 | Fixes found while testing: missing create fields → 400; assignment for unknown project/employee → 404 (no orphan row) via `clientError` + `expose` | REQ-0146 | DONE | Handler only passes through `expose` 4xx |

## Wave — GATE-0023 API input validation (2026-10-10)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0079 | `updateProjectEmployee`: 404 for unknown project/employee (shared `assertAssignmentTargetsExist`), missing assignment reported first, non-integer ids → 400 (`isRecordId`) | REQ-0146 | DONE | No write on rejection |
| TASK-0080 | Malformed JSON → 400 `clientError`; path ids validated with `isRecordId` on Get/Update/Delete routes; exposed-4xx branch sets `statusCodeRef` explicitly | REQ-0147 | DONE | Not sent to Sentry |
| TASK-0081 | Remove CC/BCC promotion: no deliverable To → nothing sent, `skipped`, 0 recipients | REQ-0145 | DONE | DEC-0039 amended |
| TASK-0082 | API docs list CRUD 400/404 responses (`errorResponse` helper); `/api-doc` shows error messages; tests (75 API, 106 unit) | REQ-0147 | DONE | Docs test guards drift |

## Wave — GATE-0024 project detail UI consistency (2026-10-11)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0083 | Header: drop mode badge, compact readiness block aligned with subtitle (header meta + skeleton mirror) | REQ-0149 | DONE | `page-header` `actionsAlign` input (a host `align` attribute right-aligned text) |
| TASK-0084 | Shared field styling: `eh-input` (h-11, matches select trigger), `app-field-label` with icons + `*` on every field | REQ-0148 | DONE | `eh-input`/`eh-textarea`/`eh-read-label`; select triggers named by their labels (`triggerId`) |
| TASK-0085 | Readiness checklist + Project Overview (titles, 3-col read grid, edit form, Content Helper buttons) | REQ-0148, REQ-0149 | DONE | Content Helper stacks below `xl` so buttons never squeeze the copy |
| TASK-0086 | Leadership, Client Contact, Approval Process, footer: same buttons, labels, confirmations, pending labels | REQ-0148 | DONE | Save (edit), approve/reject/reset, archive dialogs; dialogs close on route change |
| TASK-0087 | Tests, browser regression, skeleton parity | REQ-0148, REQ-0149 | DONE | Unit 121, API 84 |
| TASK-0088 | Contentful errors: 404/400 passthrough, generic 502, entry id URL-encoded, Sentry capture | REQ-0150 | DONE | Found during browser sweep (raw upstream JSON in a 500) |

## Wave — GATE-0025 avatars, Title Case, unassigned date, page consistency (2026-10-11)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0089 | Shared helpers: `lib/format/labels.ts`, `lib/media/employee-avatar.ts`, `lib/status/project-status.ts` (+ `BADGE_TONE_CLASS`), `lib/status/api-badges.ts`; `.eh-badge`/`.eh-section-card`/`.eh-panel` styles; icons registered | REQ-0151, REQ-0152 | DONE | Tone classes spelled out so Tailwind keeps them (emerald was purged) |
| TASK-0090 | Project detail + Project Team avatars on every person/client name | REQ-0151 | DONE | Employee ID tile, lead/client/contact, team cards, history/approval/comments |
| TASK-0091 | Title Case labels (status, readiness, approval timeline server label, KPIs, route titles) | REQ-0152 | DONE | `inactive` maps to slate, not Active |
| TASK-0092 | `unassignedAt` stamp/clear in `updateProjectEmployee` (one lookup) + UI label | REQ-0153 | DONE | API 85 |
| TASK-0093 | Timeline/Gantt/Calendar: signal inputs, badges, lead avatars + `shield-user`, Start/End/Duration/client icons, reminders | REQ-0151, REQ-0152, REQ-0154 | DONE | Schedule payload adds `leadEmail`/`leadAvatarUrl` |
| TASK-0094 | Business Insights, API Status, API Doc + skeletons on shared primitives; toasts (CSV/PDF export, manual refresh failure, Copy URL) | REQ-0154 | DONE | Unit 138 |

## Wave — GATE-0026 archive vs delete, reseed, lead sync, tiles, counts (2026-10-12)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0095 | Orphan root cause (Prisma `deleteMany` skips non-ObjectId `_id`) → native `deleteWithAssignments` + check; `ArchiveProject`/`RestoreProject`; archived excluded from schedule/capacity/aggregates; archived team and lead locked (409) | REQ-0155, REQ-0156 | DONE | API tests 95 |
| TASK-0096 | Active/Archived tabs on Projects + Project Team (`constants/tabs.ts`, `?view=`), Restore on archived rows, skeleton tab row; detail archived banner + Archive/Delete Permanently dialogs with assignment count | REQ-0156 | DONE | `MasterService.setProjectArchived` moves assignments between views in cache |
| TASK-0097 | Remove legacy bootstrap/dataset; `prisma/seed-data.ts`; `tools/reset-demo-data.mjs` (guarded); unique assignment index; reseed DB | REQ-0157 | DONE | Only `admin` kept; counters raised with `$max` |
| TASK-0098 | Lead sync on create/update (duplicate-key race ignored) + Project Team Lead badge | REQ-0158 | DONE | |
| TASK-0099 | Projects list Lead / Client Contact tiles with avatars; "Contact Email" label | REQ-0159 | DONE | |
| TASK-0100 | Timeline Lead caption, readiness %, team size (`readinessScore`, `teamSize` in schedule) | REQ-0159 | DONE | Timeline spec |
| TASK-0101 | `projectCounts` / `projectCountsLabel` on Dashboard, Projects, Project Team, Insights | REQ-0160 | DONE | Unit 148 |

## Wave — GATE-0027 project detail confirmations (2026-10-12)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0102 | Confirm dialogs for Request Approval, Restore, Add Assignment, Add Comment, Resolve/Reopen (`pendingConfirm`, `PROJECT_DETAIL_CONFIRM_COPY`) + specs | REQ-0161 | DONE | Unit 158 |
| TASK-0103 | `normalizeProjectOverview` so empty overviews return arrays | REQ-0162 | DONE | Found in browser sweep; API test |
| TASK-0104 | Review-flag clarity: `session.user`; API test for non-duplicate lead-assignment errors | REQ-0158 | DONE | API 97 |

## Wave — GATE-0028 seed emails, email log retention (2026-10-12)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0105 | Seed employee/lead emails and SOW link → `example.com`; shared DB reseeded | REQ-0163 | DONE | 0 deliverable seed addresses; seed comment logs only `NOTIFY_APPROVAL_TO` |
| TASK-0106 | 90-day `NotificationLog` TTL: `tools/ensure-indexes.mjs` (`db:indexes`, `db:push`), reset ensures it, API self-heals once per instance | REQ-0164 | DONE | API 98; live index `ttl=7776000` |

## Wave — GATE-0029 consistent KPIs and Insights cards (COMPLETE 2026-10-13)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0107 | `projectCounts` value = total; Projects KPI on Dashboard, Projects, Project Team, Insights; Project Team Total Assignments = all with "On Active Projects · Archived" subtitle | REQ-0165 | DONE | Project/Project Team specs; `project-archive.spec.ts` already covers `total` |
| TASK-0108 | Shared status buckets in `lib/status/` (move `IN_FLIGHT/PLANNING/ON_HOLD` out of `project.component.ts`); Dashboard KPIs regrouped: Employees, Projects, In Flight, Planning, On Hold, Staffing (Staffed · Lead Only · Unstaffed), Assignments (Active · Inactive · Archived), Archived; hero chips + people count match Project Team | REQ-0166 | DONE | `lib/status/portfolio-stats.ts` + `constants/portfolio-kpis.ts`; Dashboard "People" (same label/number as Project Team); Insights status cards use the same buckets |
| TASK-0109 | Insights: subtitles on all overview KPI cards, remove duplicate chip row, status cards with share-of-total subtitle, capacity in people, "—" for empty departments, equal-height responsive grids | REQ-0167 | DONE | `kpi-stat-card` host `block h-full`; CSV with UTF-8 BOM; browser 390 + 1280 px |
| TASK-0110 | Shared "Reset Filters" inline link (`app-clear-filters-button`) in list toolbars and on the Insights filter row (shown only while a filter is set; desktop aligned, phone stacked) | REQ-0167 | DONE | Spec for show/reset; browser 390 + 1280 px |

## Wave — GATE-0030 project delivery status + deleted lead (COMPLETE 2026-10-13, committed locally)

| ID | Task | REQ | Status | Notes |
|---|---|---|---|---|
| TASK-0111 | API: `SetProjectStatus` (`setProjectDeliveryStatus`, history + timeline entry, 400/404/409, no-op when unchanged); approve sets `in_flight`; create derives status from approval; `UpdateProject` stops writing status/approval/history | REQ-0168 | DONE | API tests 104/104 |
| TASK-0112 | API + shared rules: closed projects lock team/lead (`teamLockedMessage`, also when moving an assignment away), excluded from capacity and dashboard counts; `projectStatus` on assignments; `portfolio-stats` buckets Completed/Cancelled, `isProjectClosed`, `isProjectTeamLocked`, `deliveryStatusOf`, `closedCount(sLabel)` | REQ-0169 | DONE | `portfolio-stats.spec` |
| TASK-0113 | UI: detail Delivery Status menu + confirm, closed banner with Reopen, team/lead locks; Closed card on Projects/Dashboard (+ chart slice); Project Team closed rows read-only ("Open Project", shown inactive, filter agrees); Insights Completed/Cancelled | REQ-0168, REQ-0169 | DONE | Specs + browser 390 + 1280 px |
| TASK-0114 | Deleted lead: API clears `leadByEmpId`, lead checked only when changed; `NO_LEAD_LABEL` on detail/Timeline, "—" in Projects list; seed covers every status (Comet completed, Nova cancelled, Orion rejected), shared DB reseeded on user approval | REQ-0170 | DONE | Browser: temp employee as Orion lead, deleted, then lead restored |

---

## Recommended approval options (GATE-0016 prod soak)

**Closed:** Soak findings implemented under GATE-0017. List density follow-up shipped; CP-0020 awaits project-detail guide.

---

## Recommended approval options

**Option A — Refresh FOUC + shell stability only:** Approve TASK-0020…0022 (REQ-0113–0114).  
**Option B — Full WAVE GATE-0015:** Approve TASK-0020…0024 (REQ-0113–0116).  
**Option C — Defer:** Keep GATE-0014 resume; wait for screenshots before coding.

Default recommendation: **Option B** once screenshots confirm acceptance criteria (or Option A if screenshots only show blank refresh flash).

---

## Legacy recommended approval options (C1 bootstrap)

**Option A — Security-first C1:** Approve Wave 1 (TASK-0001…0006) now; Wave 2 after Gate re-check.  
**Option B — Docs + hygiene first:** Approve TASK-0001…0003, 0007…0009 only; defer auth API work.  
**Option C — Full Wave 1+2:** Approve all P0+P1 tasks; defer Wave 3.

(Historical; Wave 1 largely delivered under user direction.)
