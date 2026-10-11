# CivicConnect front end (Angular 22)

Clickable front end for the CivicConnect request tracker, built from agreed-upon wireframes.
It runs entirely in the browser on **demo data** until the Express API is ready.

## Run it

From the project root:

```bash
npm run web          # = npm --prefix views start  → http://localhost:4200
npm run web:build    # = npm --prefix views run build → views/dist/
```

Or from `views/`: `npm install` (first time), then:

| Command | What it does |
| --- | --- |
| `npm start` | Dev server on http://localhost:4200 |
| `npm run build` | Production build into `views/dist/` |
| `npm run lint` | ESLint static analysis (angular-eslint) |
| `npm test` | Unit tests (Vitest); add `-- --watch=false` for a single run |
| `npm run e2e` | Browser (E2E) tests with Playwright; starts the dev server itself |

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

## Testing

All tests follow the **AAA pattern** (Arrange, Act, Assert), with each step marked by a comment.

| Level | Tool | Where | What it covers |
| --- | --- | --- | --- |
| Static analysis | ESLint (angular-eslint) | `eslint.config.js` | Code quality and Angular template rules |
| Unit | Vitest via `ng test` | `src/**/*.spec.ts` | Status transitions, overdue rule, visibility, resolve/close and approval rules, route guards |
| E2E | Playwright | `e2e/*.spec.ts` | E2E-01 submit and track a request (FR-REQ-001, FR-REQ-002); E2E-02 requester blocked from staff pages; E2E-03 signed-out visitor sent to sign in (NFR-SEC-001) |

First-time E2E setup: `npx playwright install chromium`. The E2E tests run against `ng serve` and the
built-in demo data, so they need no back end. Their TypeScript settings are in `tsconfig.e2e.json`
(Node types for the Playwright files only).

## CI pipeline

`.github/workflows/ci.yml` runs on every pull request and push to
`implementation/baseline`, `development` and `main`:

| Check | Steps |
| --- | --- |
| Front end - lint, unit tests, build | `npm ci`, ESLint, Vitest, production build |
| Front end - E2E tests | Playwright against `ng serve`; the HTML report is kept as a run artifact |
| Front end - dependency audit | `npm audit --omit=dev --audit-level=high` |

GitHub's CodeQL scanning and Dependabot (`.github/dependabot.yml`) add code and dependency security checks.
A failing check blocks the merge once the branch ruleset requires these checks. Back-end, database and
notification tests will be added to the same workflow when that code exists.

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
e2e/               Playwright E2E tests (helpers.ts + one spec file per journey)
```

### Swapping in the real backend

1. Implement the Express routes (paths are listed in `core/api/http/http-apis.ts`; rename freely).
2. Set `useMockApi: false` and `apiBaseUrl` in `src/environments/environment.ts` (and `.prod.ts`).
3. That's it: pages, guards and the session use the contracts, not the implementation.

The real API **must enforce** the same rules server-side (NFR-SEC-001). The UI guards and
`core/domain/request-rules.ts` only shape what the user sees.

## Notes

- Styling is plain SCSS (`src/styles.scss`) matching the wireframes, plus Angular CDK for the account menu.
- Fonts load from Google Fonts. Production builds inline them, so `ng build` needs internet access.
- Live status on the requester page polls every 15 s; replace with WebSocket/SSE later if needed.
- `environment.prod.ts` is not used yet: `angular.json` has no production `fileReplacements`. Both
  environment files use demo data today; add the replacement when switching to the real API.
