# Agile V State

**Cycle:** C1  
**Phase / Stage:** Stage 4 — GATE-0030 (project delivery status + deleted lead, TASK-0111–0114) and TASK-0110 committed locally, not pushed; `origin/main` = `ba6d19d`  
**Gate:** GATE-0030 **COMPLETE (local)**; GATE-0029 **COMPLETE**; GATE-0028 **COMPLETE**; GATE-0027 **COMPLETE**; GATE-0026 **COMPLETE**; GATE-0025 **COMPLETE**; GATE-0024 **COMPLETE**; GATE-0023 **COMPLETE**; GATE-0022 **COMPLETE**; GATE-0021 **COMPLETE**; GATE-0020 **COMPLETE**; GATE-0019 **COMPLETE**; GATE-0018 skeleton parity **COMPLETE**; detail-polish guide (CP-0020) **RESOLVED**; GATE-0017 soak CP-0019 **PENDING**; GATE-0001 **CLOSED**  
**Status:** GATE-0030 (REQ-0168–0170) committed locally on top of TASK-0110 (Reset Filters, also local); neither pushed. Node 24.21: lint PASS, API tests 104/104, unit 180/180, production build PASS, browser 390 + 1280 px PASS. Shared database reseeded 2026-10-13 with every project status (8 projects, 12 assignments); prod still runs `ba6d19d`, which buckets the new `in_flight` / `completed` / `cancelled` / `rejected` values with the old rules until this is deployed.  
**Updated:** 2026-10-13  
**resume_token:** `c1-gate30-delivery-status-2026-10-13`

---

## Resume Point

**Next exact task:** push GATE-0030 + TASK-0110 on user approval (prod data is already reseeded for the new statuses), check on prod at 1280 + 390 px (delivery status cycle, Closed card, Reset Filters), then run the CRUD prod soak.

**Completed (GATE-0030, TASK-0111–0114):**

- Status model: `approvalStatus` = draft / in_review / approved / rejected; once approved, `status` = `in_flight` / `on_hold` / `completed` / `cancelled` (`DeliveryStatus`). API `POST SetProjectStatus?id=` (`setProjectDeliveryStatus`): 400 bad status, 404, 409 archived (wins) or not approved, no-op when unchanged, else history "Delivery status set to X" + timeline entry. Approve sets `in_flight`; create derives status from approval (`initialProjectStatus`). `updateProject` no longer writes status, approval fields, history, timeline or reviewer comments (stale form overwrite fixed).
- Closed (completed/cancelled): `teamLockedMessage` (archived first, then closed) guards assignment create/update/delete (including moving one away) and lead changes (409 "Project is closed…"); excluded from resource insights capacity and dashboard active counts; assignments carry `projectStatus`. Frontend: `portfolio-stats` buckets Planning (draft, in_review, rejected) / In Flight / On Hold / Completed / Cancelled, `isProjectClosed`, `isAssignmentClosed`, `isProjectTeamLocked`, `deliveryStatusOf`, `DELIVERY_STATUS_OPTIONS`, `closedCount`, `closedCountsLabel`; staffing, workforce, people and assignment counts use open projects only. `MasterService.setProjectStatus` via `trackProjectMutation`, which now also patches `projectStatus` on cached assignments.
- UI: detail "Delivery Status" `app-select-menu` (approved and not archived) → `pendingConfirm` kind `status` (copy `PROJECT_DETAIL_CONFIRM_COPY.status`), closed banner with "Reopen Project", Edit Lead / Add to Team disabled with `footerCopy.teamLocked`; approval header "Approved · <status>". Projects + Dashboard "Closed" card (`PORTFOLIO_KPIS.closed`, "N Completed · M Cancelled") replaces "Archived"; Dashboard staffing chart gains a Closed slice. Project Team: closed projects not in the picker, closed rows show "Project Completed/Cancelled", count and filter as Inactive, "Open Project" instead of Edit/Delete. Insights distribution includes Completed and Cancelled.
- Deleted lead: `deleteEmployee` clears `leadByEmpId`; lead validated only when changed; `NO_LEAD_LABEL` ("No lead") on detail (no avatar) and Timeline, "—" in Projects list.
- Seed: Aurora in_flight, Helios in_review, Mercury draft, Atlas on_hold, Beacon completed + archived, Comet completed, Nova cancelled, Orion rejected (`prisma/seed-data.ts`); fixture `portfolio-fixture.ts` mirrors it.

**Completed (GATE-0029 follow-up, TASK-0110):**

- Shared `app-clear-filters-button` (`components/ui/clear-filters-button.component.ts`): inline text link, `rotate-ccw` icon, "Reset Filters", output `cleared`. Replaces the "Clear" button in `list-toolbar` (Employees, Projects, Project Team).
- Insights: `filtersActive` signal (date range or department not "all"), `resetFilters()` restores defaults, recalculates and returns focus to the Date Range dropdown. The link sits after Department, centred on the dropdown row on desktop, stacked under the dropdowns on phone, wraps to the next row with Custom Range.
- Department Breakdown showing Employee Success with 0 projects and "—" is expected: it groups active projects by lead department and that department only leads the archived Beacon project. No change.

**Completed (GATE-0029, TASK-0107–0109):**

- One rule set in `lib/status/portfolio-stats.ts` (spec'd): `projectStatusBucket(s)` (In Flight / Planning / On Hold, archived excluded), `staffingCounts` (Staffed / Lead Only / Unstaffed), `assignmentCounts` (total, on active projects, active, inactive, archived), `uniqueAssignees` (people on active projects, any state), `workforceCounts` (Assigned = active assignment on an active project; Available = active employee without one), `isAssignmentActive`, `isEmployeeActive` (`isActive !== false`), `allocationToPeople` / `peopleLabel`, `dotJoin`, `uniqueCount`. Card copy for the shared buckets in `constants/portfolio-kpis.ts` (`PORTFOLIO_KPIS`), reused by Insights status items.
- "Projects" card = total incl. archived + "N Active · M Archived" on Dashboard, Projects, Project Team, Insights. Project Team "Total Assignments" = all, "N On Active Projects · M Archived"; tab badges use the same counts.
- Dashboard: 9 cards (Employees, Projects, People, In Flight, Planning, On Hold, Staffing, Assignments, Archived), hero "N people on projects · N active assignments", charts Staffed/Lead Only/Unstaffed/Archived and Active/Inactive/Archived, skeleton 9 cards. "People Booked" from the plan shipped as "People" (same label and number as Project Team). A failed list request now still computes the cards.
- Insights: subtitles on every card, pill row removed (page + skeleton), status cards "N of M active" with the shared mapping (`approved` is In Flight, no longer Completed), capacity in people, `averageReadiness: null` → "—" for departments without projects (table + CSV with UTF-8 BOM), unused project categorization removed.
- `app-kpi-stat-card` host `block h-full` + `h-full` article: equal heights per grid row app-wide.
- Test fixture `src/app/testing/portfolio-fixture.ts` (seed-shaped data, `warmPortfolioCaches`, `kpiCards`).

**Completed (GATE-0028, TASK-0105–0106):**

- Seed employees and department lead emails use `@example.com` (SOW link `docs.example.com`); notifications to them are skipped. Only addresses in `NOTIFY_APPROVAL_TO` (operator-configured, by design) still receive comment/approval emails.
- `NotificationLog` entries expire after 90 days: TTL index `NotificationLog_createdAt_ttl` (constants in `api/_lib/notification-log-retention.mjs`). Prisma cannot declare TTL and `prisma db push` drops undeclared indexes, so: `@@index([createdAt])` removed from the schema; `tools/ensure-indexes.mjs` (`npm run db:indexes`, idempotent, replaces an old `{createdAt: 1}` index); `npm run db:push` = Prisma push + ensure; `db:reset:demo` ensures it; the API recreates it once per instance on the first delivery (conflict → Sentry + hint, transient error → retried).
- Calendar event chips were already `<a routerLink>` with `aria-label` and a focus ring; keyboard check confirmed (Tab reaches the chip, Enter opens the project).

**Completed (GATE-0027, TASK-0102–0104):**

- Every project-detail mutation now asks first. Request Approval joins the approval dialog (`APPROVAL_CONFIRM_COPY.request`). Restore Project, Add Assignment, Add Comment and Resolve/Reopen comment share one `app-alert-dialog` driven by `pendingConfirm` with copy in `PROJECT_DETAIL_CONFIRM_COPY` (`constants/project-detail.ts`). Validation runs before the dialog; the dialog shows the busy label, can't be dismissed while busy, closes on success, stays open on error, closes on route change, and re-checks before running (stale → closes). Late archive/restore responses for a project the user left no longer touch the open dialog.
- API: projects saved without overview content return `overview` with `summary`, `objectives`, `successCriteria` (`normalizeProjectOverview`); a `{}` overview crashed the detail page preview (found in the sweep).
- Review flags were false positives; made explicit: `session.user` in ArchiveProject/RestoreProject, and an API test that only duplicate-key errors are ignored when auto-assigning a lead.

**Completed (GATE-0026, TASK-0095–0101):**

- Orphan root cause: Prisma's MongoDB `deleteMany` resolves rows by `_id` and silently skipped assignments whose `_id` was not an ObjectId (legacy imports). Deletes now go through the native driver (`deleteWithAssignments`); the reseed writes ObjectId `_id`s.
- Archive and Delete are separate. `POST ArchiveProject/{id}` / `RestoreProject/{id}` set or clear `archivedAt`/`archivedBy` (history entry, nothing deleted). `DeleteProject` deletes assignments then the project with native driver deletes, sweeps again and fails loudly if any assignment still references the project; returns `deletedAssignments`. Archived projects are excluded from schedule, capacity, dashboard and insights aggregates; their team cannot change (409), and their lead cannot change (409) while other edits still save.
- Projects and Project Team have Active/Archived tabs (`constants/tabs.ts`, `?view=archived` via `bindListQuery`, badge counts, skeleton tab row via `listTabCount`). Archived rows show only Restore. Project detail: archived banner with Restore, footer "Archive Project" + "Delete Permanently", each with an `app-alert-dialog`; the delete dialog states how many assignments will be removed (`deleteProjectWarning`).
- Shared `lib/status/project-archive.ts`: `isProjectArchived`, `isAssignmentArchived`, `projectCounts`, `projectCountsLabel` ("4 Active · 1 Archived"), delete copy. (GATE-0029: the "Projects" KPI value is now the total.)
- Lead sync: create/update gives the new lead an active "Project Lead" assignment if missing (duplicate-key race ignored); Project Team shows a violet "Lead" badge with a crown icon. Unique index `ProjectEmployee(projectId, empId)`.
- Projects list: Lead tile (avatar, name, lead's employee email) and Client Contact tile (avatar, email, phone); read-only "Email" renamed "Contact Email". Timeline: "Lead" caption, readiness % and team size lines (schedule payload adds `readinessScore`, `teamSize`); `shield-user` removed.
- Legacy bootstrap removed (`ensureBootstrapData`, `store.mjs`, `data.json`, `dataset/*.json`, `tools/wipe-local-domain.mjs`). New typed `prisma/seed-data.ts` (3 + 7 departments, 5 employees, 5 projects incl. one archived, 7 assignments). `npm run db:reset:demo` / `db:reseed:local` (`tools/reset-demo-data.mjs`) needs `ALLOW_DB_WIPE=1`, plus `EH_ALLOW_REMOTE_WIPE=1` for a non-local host; it never prints credentials and keeps only `admin`.

**Completed (GATE-0025, TASK-0089–0094):**

- Shared helpers: `lib/format/labels.ts` (`titleCaseLabel`), `lib/media/employee-avatar.ts` (`employeeAvatar`, seed = email else name), `lib/status/project-status.ts` (`projectStatusMeta`, `BADGE_TONE_CLASS`, fills/borders/legend), `lib/status/api-badges.ts` (health, delivery, HTTP method/status tones). Styles: `.eh-badge` + `.eh-badge-<tone>`, `.eh-section-card`, `.eh-section-heading`, `.eh-panel`. Tone classes must be referenced via `BADGE_TONE_CLASS` (string concatenation gets purged by Tailwind).
- Avatars on project detail (lead, client, contact, team cards, status history, approval timeline, reviewer comments), Project Team (pill + Employee ID tile), Employees, Dashboard, Timeline leads (+ `shield-user`), Gantt tooltip, reminder owners.
- Title Case everywhere (status pills, readiness, approval timeline label from the server, KPI labels, route titles).
- `updateProjectEmployee`: deactivate stamps `unassignedAt`, reactivate clears it (one lookup shared with the target check). UI: date / "Still Assigned" / "Not Recorded".
- Timeline/Gantt use signal inputs (fixes stale `computed` over `@Input`); schedule payload adds `leadEmail` / `leadAvatarUrl`.
- Business Insights, API Status, API Doc + skeletons on `app-kpi-stat-card` (new `loading` input), `.eh-badge`, `ehAction`, `app-field-label`, toasts (CSV/PDF export, manual Refresh/Retry failure, Copy URL success/failure).

**Completed (GATE-0024, TASK-0083–0088):**

- Project detail uses the shared primitives: `app-field-label` with Lucide icons (`PROJECT_DETAIL_FIELD_ICONS` / `PROJECT_DETAIL_SECTION_ICONS`) and `*` on required fields; `eh-input` / `eh-textarea` / `eh-read-label` in `styles.css` (every input 44 px, same as `app-select-menu`); every button is `ehAction` + `eh-action-btn` with an icon and pending label.
- Header: mode badge removed; readiness bar on one line, bottom-aligned with the subtitle (`page-header` `actionsAlign="end"`). Overview and Client Contact read tiles: 1 / 2 / 3 columns (`sm` / `md`). Content Helper stacks below `xl`.
- Confirmation dialogs: save (edit mode only; create saves directly), approve, reject (comment required first), reset, archive (`app-alert-dialog` `confirmIcon`). Dialog closes on success, stays open on error, cannot be dismissed while busy, and closes when the route switches project.
- `app-select-menu` `triggerId` + `app-field-label` `forId` → trigger named "label + value" (`aria-labelledby`); also on Project Team create/edit selects.
- Mutation results for a project the user has navigated away from are ignored (`routedProjectId`); the confirmed action re-checks its preconditions and closes the dialog if they no longer hold.
- Contentful: upstream 404 → 404, 400/422 → 400, other → generic 502 + Sentry; no upstream body exposed; entry id URL-encoded; no DB bootstrap on this route.
- Skeleton mirrors the new layout (labels, icons, 44 px fields, buttons, footer).

**Completed (GATE-0023, TASK-0079–0082):**

- Malformed JSON body → 400 "Invalid JSON body" (was 500 + Sentry). Non-integer path or body ids → 400 (`isRecordId`).
- Editing an assignment to an unknown project/employee → 404, nothing written; a missing assignment is reported first ("Project employee not found"). Shared `assertAssignmentTargetsExist` for create + update.
- No CC/BCC promotion: if every To address is a test domain, nothing is sent and the delivery is `skipped` with 0 recipients (DEC-0039 amended).
- API docs list the 400/404 responses for CRUD routes; `/api-doc` shows each error's message.

**Completed (GATE-0022, TASK-0075–0078):**

- Email to reserved test domains (`example.com/.net/.org`, `.test`, `.example`, `.invalid`, `.localhost`) is skipped, not sent (DEC-0039). Live probe: 0 failed deliveries.
- CRUD bad input returns 400 (missing fields) and 404 (assignment for unknown project/employee) instead of 500 / orphan rows (`clientError` with `expose`).
- `npm run test:api` — 69 tests (auth 47 + CRUD 14 + email 8); fake DB covers all models; needs Node 24 (fails fast below).

**Completed (GATE-0021, TASK-0072–0074):**

- `npm run test:api` — 47 `node:test` tests in `tests/api/` (DEC-0038): session cache, auth helpers, HTTP Login/Session/Logout via the real Vercel entry; fake DB in `tests/api/support/fake-db.mjs`.
- Malformed `Cookie` header → 401 (was 500). Login background image eager (NG0913 gone).

**Completed (GATE-0020, TASK-0068–0071):**

- Session check cached per instance (`api/_lib/session-cache.mjs`, DEC-0036): auth ~460 ms → ~1 ms warm / ~233 ms cold; login primes the cache; logout tombstone closes the revoke race. `SESSION_CACHE_TTL_SECONDS` default 30.
- Shared native Mongo client `api/_lib/mongo-client.mjs` (auth + repository).
- `LayoutComponent` idle-prefetches Employees/Projects/Project Team lists (`MasterService.warmLists`).
- Instant logout (DEC-0037): local sign-out + navigate (~70 ms); keepalive revoke with retry/toast; login waits for pending revoke; interceptor ignores 401s from an ended session (auth epoch); in-flight list reads dropped on cache clear.

**Completed (GATE-0019, TASK-0061–0067):**

- Inline pending per action button (`lib/mutation-tracker.ts` `MutationTracker` + `PendingSet`, `components/ui/action-button.component.ts` `ehAction`) on Employees, Projects, Project Team, Project detail. Dynamic labels ("Deleting…", "Approving…"); duplicate submits ignored; pending buttons keep focus (`aria-disabled`).
- `MasterService` list cache cascades invalidations (project/employee delete → assignments) and refetches responses issued before an invalidation.
- Server: native atomic counter (DEC-0034), parallel lookups, `$transaction` deletes, dev-only timing logs (`api/_lib/timing.mjs`).
- Email outcomes stored in `NotificationLog` (DEC-0035) with redacted errors; `NotificationMonitorService` toasts failures after mutations; API Status shows "Recent Email Deliveries". New API routes `GetNotificationLog`, `GetNotificationFailures`.
- Calendar "+N more": mouse-only hover expand, keyboard toggle, Escape refocus, collapse timer cancelled.

**Remaining / known (low):**

- Cross-instance revocation window up to 30 s (RISK-0022, accepted).
- Fake DB doesn't reject unknown Prisma fields.
- Project/employee deletes are native driver deletes (no longer a Prisma `$transaction`, RISK-0020 closed): not atomic, but a failed check throws instead of leaving orphans.
- Prod could not be checked by script (Vercel Security Checkpoint returns 429 to curl); prod uses the same database as local, so the reseed already applies there.
- `bg-white/2` / `min-h-auto` / `bg-white/5/80` classes generate no CSS (older cards; `.eh-section-card` omits it).
- Employee edits don't refresh lead names in project list/schedule until TTL.
- Guest `Session` 401 on the login page console (intentional).
- The shared `archive` pending key blocks Restore on a second project until the first archive/restore request returns.
- `uniqueAssignees` keys by employee id, else name; one person stored once with an id and once name-only would count twice (no such rows today).

**Blockers:** none. Push/deploy needs human approval (GATE-0002). `npm run db:push` already applied to the configured DB (schema + TTL index).

**Next exact action:** Push GATE-0029 when the user approves (GATE-0002), then check prod KPIs match: Dashboard 5/4/2/1/1/4/7/1, Projects 5, Project Team 7 / People 4, Insights subtitles and capacity in people. Then user's CRUD prod soak (CP-0025): a comment on a seed project sends no email to seed employees (API Status "Recent Email Deliveries" counts only `NOTIFY_APPROVAL_TO`); every project-detail dialog (request approval, restore, add assignment, add comment, resolve/reopen); archive → Archived tab → restore on Projects and project detail; Delete Permanently (dialog shows the assignment count, rows gone from Project Team); change a lead (new Lead row appears); Timeline readiness/team lines; KPI "Projects" matches on Dashboard, Projects, Project Team and Insights. Run `npm run db:push` on any other database before using it (unique assignment index + TTL). Then the GATE-0025 soak (CP-0024): triage each bug / UI-consistency mismatch into a scoped plan for approval. Soak areas: project detail avatars, Project Team unassigned dates (deactivate/reactivate an assignment), Calendar (3 tabs), Insights (4 tabs + CSV export), API Status and API Doc (Copy URL needs a real clipboard). Earlier soak still open: prod soak of the project detail page (every section's edit/save, approval request → approve/reject → reset, archive, Contentful + AI helpers) and CRUD across Employees / Projects / Project Team. Note: dev saw one-off 40–77 s approval writes during a MongoDB latency spike (same endpoint ~2 s otherwise); watch for it on Vercel.

**Resume prompt:**

```text
Load CLAUDE.md, AGENTS.md, and .agile-v/STATE.md.
Resume resume_token c1-gate29-complete-2026-10-13.
GATE-0026–0028 pushed (origin/main 4512353). GATE-0029 (shared KPI rules in lib/status/portfolio-stats.ts, total-based Projects KPI, regrouped Dashboard, Insights card subtitles) committed locally, not pushed. Next: push on approval, prod KPI check, then CRUD prod soak (CP-0025).
```

---

## Deferred

- `?expand=<id>` list deep-links (pagination edge cases; leave lists static)
- Employee / Project Team dedicated detail routes (optional later; Projects already has detail)
- Department card → `/employee` deep-link
- Major migrations: Angular 21+, Prisma 7+, Tailwind 4, ESLint 10
