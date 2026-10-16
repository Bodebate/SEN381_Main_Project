/**
 * Local development against the real Express API (`npm run start:live` in views/).
 * Needs the API running: `npm start` in the project root.
 */
export const environment = {
  production: false,
  mockApis: { auth: false, requests: false, users: false, reports: false },
  apiBaseUrl: 'http://localhost:3000/api',
};
