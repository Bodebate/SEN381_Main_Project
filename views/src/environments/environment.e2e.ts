/**
 * Live E2E tests (`npm run e2e:live`): the app on port 4300 talks to a throwaway test API on
 * port 3100 (scripts/start-test-api.js, in-memory MongoDB), never to your own servers or Atlas.
 */
export const environment = {
  production: false,
  mockApis: { auth: false, requests: false, users: false, reports: false },
  apiBaseUrl: 'http://localhost:3100/api',
};
