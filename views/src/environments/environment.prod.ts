/** Production settings (used by `ng build`). Switch each area to false once its Express routes are live. */
export const environment = {
  production: true,
  mockApis: { auth: true, requests: true, users: true, reports: true },
  apiBaseUrl: '/api',
};
