/** Development settings (used by `ng serve`). */
export const environment = {
  production: false,
  /** Per area: true = demo data in the browser; false = call the Express API at apiBaseUrl. */
  mockApis: { auth: true, requests: true, users: true, reports: true },
  apiBaseUrl: 'http://localhost:3000/api',
};
