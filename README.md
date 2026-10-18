# CivicConnect

Request tracker for SEN381: an Angular 22 front end (`views/`) and an Express 5 + MongoDB API
(project root). The front end can run on **built-in demo data** or against the **real API**,
chosen per area in the environment files.

## First-time setup

1. Install dependencies: `npm install` in the project root, then `npm install` in `views/`.

`.env` is never committed. Share its values privately, not in GitHub, chat screenshots or the README.

## Notifications (ntfy)

Sign-up codes, phone-change codes and request updates are sent through [ntfy](https://ntfy.sh)
(`services/notify.js`). ntfy does not send real SMS: an "SMS" arrives as a push notification in the
ntfy phone app. Email is forwarded by ntfy as plain text.

**`.env` settings**

| Key | Value |
| --- | --- |
| `NOTIFY_MODE` | `console` prints every message in the API terminal (no sending); `live` sends through ntfy |
| `NTFY_SERVER` | `https://ntfy.sh` |
| `NTFY_TOPIC_PREFIX` | the team's shared prefix; must be identical on every machine |
| `NTFY_TOKEN` | ntfy.sh access token; only needed for email (shared privately) |

Restart the API (`npm start`) after changing `.env`.

**Receiving "SMS" on a phone**

1. Install the **ntfy** app and allow its notifications.
2. Tap **+** and subscribe to `<NTFY_TOPIC_PREFIX>-<cell number, digits only>`,
   e.g. `<prefix>-27821234567` for +27 82 123 4567.
3. Register in CivicConnect with that number (`+27…` format) and choose **SMS**.

**Receiving email:** ntfy.sh only emails addresses verified in the account that owns `NTFY_TOKEN`.
Add and verify the address in that ntfy account first, otherwise choose SMS.

Tests never send messages: the Jest suites mock `services/notify.js`.

## Production & Live Deployment

* **Live Frontend Link**: `https://sen381-main-project-1.onrender.com/api`
* **Backend Service**: Deployed on Render via Docker using `server.js` and `app.js`.
* **Frontend Service**: Deployed as a separate Render Static Site using the Angular application builder output (`views/dist/civicconnect/browser`).

| Goal | Commands / Target |
| --- | --- |
| Front end on demo data only | `npm run web` → http://localhost:4200 |
| Local development against real API | `npm start` (API on port 3000), then `npm run web:live` (Frontend pointing to local or live API) |
| Throwaway API with demo accounts | `npm run api:test`: API on port 3100 with an in-memory database |
| Production build | `npm run web:build` → `views/dist/civicconnect/browser` |

### Accounts

- **Demo data** (`npm run web`) and **test API** (`npm run api:test`, `npm run e2e:live`): password
  `demo`. Demo data has `requester`, `staff`, `staff3`, `manager`, `admin`, `pending`, `unverified`
  and `declined`; the test API has `requester`, `staff`, `manager` and `admin`.
- **Real API** (`npm start`): `admin` with `********`. New accounts register on the
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

Access rules are enforced on the server: `middleware/authenticate.js` checks the
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
own test API (port 3100) and app (port 4300), so it never touches Atlas or the running servers. The
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
services/            notify.js (notifications via ntfy: SMS as push, email; NOTIFY_MODE=console for dev), mask.js
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

## Notes

- Styling is plain SCSS (`src/styles.scss`) matching agreed-upon wireframes, plus Angular CDK for the account menu.
- Fonts load from Google Fonts. Production builds inline them, so `ng build` needs internet access.
- Live status on the requester page polls every 15 s.
