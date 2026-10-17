# CivicConnect

Request tracker for SEN381: an Angular 22 front end (`views/`) and an Express 5 + MongoDB API
(project root). The front end can run on **built-in demo data** or against the **real API**,
chosen per area in the environment files.

## First-time setup

1. Install dependencies: `npm install` in the project root, then `npm install` in `views/`.
2. Copy `.env.example` to `.env` and fill it in (one `KEY=value` per line, no trailing `;`):

| Key | What it is |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (Atlas or local) |
| `ENCRYPTION_KEY`, `FIXED_IV` | Keys for encrypted user fields (names, phone numbers); ask the team for the shared values |
| `JWT_Secret` | Long random string that signs sign-in tokens: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | API port, default `3000` |
| `CORS_ORIGIN` | Front-end address allowed to call the API, default `http://localhost:4200` |
| `TWILIO_*` | Twilio account details for SMS and email |
| `NOTIFY_MODE` | `console` prints SMS/email messages in the API terminal instead of sending them (use this in development) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The first admin account, created by `npm run seed` (password 8+ characters) |

3. Create the first admin, once per database: `npm run seed`. To reset that admin's password and
   email to the values in `.env`: `npm run seed -- --reset-password`.

`.env` is never committed. Share its values privately, not in GitHub, chat screenshots or the README.

## Run it

| Goal | Commands (project root) |
| --- | --- |
| Front end on demo data only | `npm run web` → http://localhost:4200 |
| Front end on the real API | `npm start` (API on http://localhost:3000/api), then in a second terminal `npm run web:live` |
| Throwaway API with demo accounts | `npm run api:test`: API on port 3100 with an in-memory database (data is lost on stop) |
| Production build | `npm run web:build` → `views/dist/` |

`npm run web:live` uses the `live` Angular configuration (`environment.live.ts`, all areas on the
real API), so nobody needs to edit `environment.ts` to test against the API. Keep `environment.ts`
on demo data: CI's demo-data E2E tests rely on it.

### Accounts

- **Demo data** (`npm run web`) and **test API** (`npm run api:test`, `npm run e2e:live`): password
  `demo`. Demo data has `requester`, `staff`, `staff3`, `manager`, `admin`, `pending`, `unverified`
  and `declined`; the test API has `requester`, `staff`, `manager` and `admin`.
- **Real API** (`npm start`): `admin` with your `SEED_ADMIN_PASSWORD`. New accounts register on the
  sign-up page; with `NOTIFY_MODE=console` the 6-digit code appears in the API terminal. An admin or
  manager then approves them on the approvals page.

## API

`app.js` mounts these route groups under `/api`; every route except login, registration and the
health check needs a `Bearer` token:

| Path | Who | What |
| --- | --- | --- |
| `/health` | anyone | `{ "ok": true }` |
| `/auth` | anyone / signed in | login, register, verify, resend-code, me, logout |
| `/requests` | approved users by role | list (`?mine=true`), view, create, comments, notes, triage, assignee, due date, category, status |
| `/request-groups` | staff, manager, admin | list, create |
| `/users` | manager, admin (directory: everyone) | list, directory, assignable staff, approval decisions |
| `/me` | approved users | profile, contact details (new phone number confirmed by SMS code), password |
| `/reports` | manager, admin | dashboard, CSV export |
| `/categories`, `/departments` | approved users | lookup lists from `config/lookups.js` |

Access rules are enforced on the server (NFR-SEC-001): `middleware/authenticate.js` checks the
token, approval and role, and the DB layer (`models/DatabaseRead.js`, `models/DatabaseWriteUpdate.js`)
filters what each user may see or change. The Angular guards only shape what the user sees.

## Testing

All tests follow the **AAA pattern** (Arrange, Act, Assert), with each step marked by a comment.

| Level | Tool | Command | Where | What it covers |
| --- | --- | --- | --- | --- |
| Back-end unit + API | Jest + Supertest | `npm test` (root) | `tests/*.test.js` | DB rules and mappers; every API area: sign-in, registration, roles, approvals, own account, requests, groups, reports. The DB layer is stubbed, so no database is needed |
| Static analysis | ESLint | `npm run lint` (views) | `views/eslint.config.js` | Code quality and Angular template rules |
| Front-end unit | Vitest via `ng test` | `npx ng test --watch=false` (views) | `views/src/**/*.spec.ts` | Status rules, visibility, approval rules, route guards |
| E2E, demo data | Playwright | `npm run e2e` (views) | `views/e2e/*.spec.ts` | E2E-01 submit and track a request; E2E-02 requester blocked from staff pages; E2E-03 signed-out visitor sent to sign in |
| E2E, real API | Playwright | `npm run e2e:live` (views) | same specs | The same journeys against the real Express API and an in-memory MongoDB |
| Performance/load | autocannon | `npm run perf` (root) | `perf/load-test.js` | GET /api/requests (manager queue) under 20 connections for 30 s against an isolated test API; results and limits in `perf/results/` |

First-time E2E setup: `npx playwright install chromium` in `views/`. `npm run e2e:live` starts its
own test API (port 3100) and app (port 4300), so it never touches Atlas or your running servers. The
first run downloads a MongoDB binary, which takes a minute.

## CI pipeline

`.github/workflows/ci.yml` runs on every pull request and push to `implemenation/baseline`,
`development` and `main`:

| Check | Steps |
| --- | --- |
| Back end - unit tests | `npm ci`, Jest + Supertest (`npm test`) |
| Front end - lint, unit tests, build | `npm ci`, ESLint, Vitest, production build |
| Front end - E2E tests | Playwright against `ng serve` on demo data; HTML report kept as an artifact |
| E2E tests against the real API | Playwright against the test API (in-memory MongoDB) and `ng serve -c e2e`; report kept as an artifact |
| Front end - dependency audit | `npm audit --omit=dev --audit-level=high` |

GitHub's CodeQL scanning and Dependabot (`.github/dependabot.yml`) add code and dependency security
checks. A failing check blocks the merge once the branch ruleset requires these checks.

## How it fits together

```
server.js            loads .env, connects to MongoDB, starts the API
app.js               Express app: CORS, JSON, routes, JSON 404, error handler
config/              db.js (connection), lookups.js (categories and departments)
middleware/          authenticate.js (JWT → req.actor, requireApproved, requireRole), errorHandle.js
routes/              one file per API area: URL → middleware → controller
controllers/         read the request, call the DB layer, send JSON
models/
  mongo-schemas/     Mongoose schemas (User, Request, Request-Group, Log, User-Authorization)
  DatabaseRead.js    reads with access filtering
  DatabaseWriteUpdate.js  writes, status rules, audit log
  utils/Mappers.js   snake_case DB documents ↔ camelCase Angular models
services/            twilio.js (SMS, WhatsApp, email; NOTIFY_MODE=console for dev), mask.js
scripts/             seed-admin.js (npm run seed), start-test-api.js (npm run api:test, live E2E)
tests/               Jest + Supertest tests and shared helpers
views/src/app/
  core/
    models/          TypeScript types that mirror the API responses
    domain/          Business rules: status transitions, overdue, who can see/resolve/approve
    api/
      contracts.ts       AuthApi, RequestApi, UserApi, ReportApi  ← pages depend only on these
      api.providers.ts   THE switch: mock or HTTP per area, from environment.mockApis
      mock/              In-browser demo implementation + seed data
      http/              HttpClient implementation for the Express API
    auth/            SessionService, route guards, auth interceptor (Bearer token)
    data/            LookupService (categories, departments, display names)
  layouts/, shared/, features/   pages and components (auth, requester, staff, manager, account, errors)
views/src/environments/
  environment.ts       demo data (default, used by CI's demo E2E tests)
  environment.live.ts  real API on port 3000 (npm run web:live)
  environment.e2e.ts   test API on port 3100 (npm run e2e:live)
```

### Mock or real API

`environment.mockApis` has one flag per area (`auth`, `requests`, `users`, `reports`). Switch them
**together**: the demo data only knows who is signed in when the demo login ran, so real sign-in with
demo requests shows "Your session has expired". Use `npm run web:live` instead of editing the flags.

## Notes

- Styling is plain SCSS (`src/styles.scss`) matching the wireframes, plus Angular CDK for the account menu.
- Fonts load from Google Fonts. Production builds inline them, so `ng build` needs internet access.
- Live status on the requester page polls every 15 s; replace with WebSocket/SSE later if needed.
- `environment.prod.ts` is not used yet: `angular.json` has no production `fileReplacements`.
- Some request fields (`assignedBy`, `dueSetBy`, `categorisedBy`, a group's department) are returned as
  `null` because the database does not store them yet.
