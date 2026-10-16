import { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthApi, ReportApi, RequestApi, UserApi } from './contracts';
import { HttpAuthApi, HttpReportApi, HttpRequestApi, HttpUserApi } from './http/http-apis';
import { MockAuthApi } from './mock/mock-auth-api';
import { MockReportApi } from './mock/mock-report-api';
import { MockRequestApi } from './mock/mock-request-api';
import { MockUserApi } from './mock/mock-user-api';

export interface MockApis {
  auth: boolean;
  requests: boolean;
  users: boolean;
  reports: boolean;
}

/**
 * The ONE place that decides which API the app talks to, per area.
 * Set an area to false in `environment.mockApis` once its Express routes are live.
 * `true` (all mocks) and `false` (all HTTP) still work, so specs that call
 * `provideApi(true)` need no change.
 */
export function provideApi(mock: boolean | MockApis = environment.mockApis): Provider[] {
  const m: MockApis = typeof mock === 'boolean'
    ? { auth: mock, requests: mock, users: mock, reports: mock }
    : mock;
  return [
    { provide: AuthApi, useClass: m.auth ? MockAuthApi : HttpAuthApi },
    { provide: RequestApi, useClass: m.requests ? MockRequestApi : HttpRequestApi },
    { provide: UserApi, useClass: m.users ? MockUserApi : HttpUserApi },
    { provide: ReportApi, useClass: m.reports ? MockReportApi : HttpReportApi },
  ];
}
