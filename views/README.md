# CivicConnect front end (Angular 22)

Clickable front end for the CivicConnect request tracker, built from the wireframes (screens 01–12).
It runs entirely in the browser on **demo data** until the Express API is ready.

## Run it

From the project root:

```bash
npm run web          # = npm --prefix views start  → http://localhost:4200
npm run web:build    # = npm --prefix views run build → views/dist/
```

Or from `views/`: `npm install` (first time), `npm start`, `npm run build`, `npm test`.

### Demo accounts (password `demo` for all)

| Username | What you see |
| --- | --- |
| `requester` | Requester: my requests, new request, request status |
| `staff` | Staff, Water department, clearance 3: queue, triage, request detail |
| `staff3` | Staff, Roads, clearance 2 (sees different requests) |
| `manager` | Manager: dashboard, track/group/export, account approvals, plus staff pages |
| `admin` | Admin: as manager, and can grant Manager/Admin roles |
| `pending` | Verified but waiting for approval → `/pending` |
| `unverified` | Registered but never entered the sign-up code → `/register/verify` |
| `declined` | Application declined → sign-in error |

Registering a new account works too; any 6-digit code verifies it. Demo data resets on page refresh.

## How it fits together

```
src/app/
  core/
    models/        TypeScript types that mirror the ERD (camelCase here, snake_case in MongoDB)
    domain/        Business rules: status transitions, overdue, who can see/resolve/approve
    api/
      contracts.ts       AuthApi, RequestApi, UserApi, ReportApi  ← pages depend only on these
      api.providers.ts   THE switch: mock or HTTP, from environment.useMockApi
      mock/              In-browser demo implementation + seed data
      http/              HttpClient implementation for the Express API (endpoint paths are proposals)
    auth/          SessionService, route guards, auth interceptor (Bearer token)
    data/          LookupService (categories, departments, display names)
  layouts/         PublicLayout (signed-out pages), ShellLayout (header + sidebar)
  shared/          Status chip, status stepper, activity log, KPI tile, bar list, empty state
  features/
    auth/          login, register, verify (2FA once, at sign-up), pending approval
    requester/     my requests, new request, request status
    staff/         request queue, request detail (triage, ownership, due date, status change)
    manager/       dashboard, track/group/export, account approvals
    account/       account settings (all roles)
    errors/        403 access denied, 404 not found
```

### Swapping in the real backend

1. Implement the Express routes (paths are listed in `core/api/http/http-apis.ts`; rename freely).
2. Set `useMockApi: false` and `apiBaseUrl` in `src/environments/environment.ts` (and `.prod.ts`).
3. That's it: pages, guards and the session use the contracts, not the implementation.

The real API **must enforce** the same rules server-side (NFR-SEC-001). The UI guards and
`core/domain/request-rules.ts` only shape what the user sees.

### Decisions built in (from the team sign-off and wireframe comments)

- 2FA code only at registration; normal sign-in is username + password.
- New accounts: role `null`, clearance 0, inactive until a manager approves them.
- Notification channel (Email/SMS) lives on the account, not on each request.
- Requesters don't choose a category. Staff set category, owner, due date and priority at triage,
  which moves Submitted → Assigned.
- Due dates are set by staff only. Overdue = past due and not Resolved/Closed.
- Status follows FR-STF-005 exactly; every change needs a comment.
- Attachments are deferred.

Items marked `[confirm]` in the code are open team decisions (who may resolve/close, who may grant
Manager/Admin, uncategorised requests visible to all staff, POPI masking in exports).

## Notes

- Styling is plain SCSS (`src/styles.scss`) matching the wireframes, plus Angular CDK for the account menu.
- Fonts load from Google Fonts. Production builds inline them, so `ng build` needs internet access.
- Live status on the requester page polls every 15 s; replace with WebSocket/SSE later if needed.
- Tests: `npm test` (Vitest) covers status rules, visibility rules, approvals and route guards.
