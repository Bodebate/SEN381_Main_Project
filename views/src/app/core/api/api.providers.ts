import { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthApi, ReportApi, RequestApi, UserApi } from './contracts';
import { HttpAuthApi, HttpReportApi, HttpRequestApi, HttpUserApi } from './http/http-apis';
import { MockAuthApi } from './mock/mock-auth-api';
import { MockReportApi } from './mock/mock-report-api';
import { MockRequestApi } from './mock/mock-request-api';
import { MockUserApi } from './mock/mock-user-api';

/**
 * The ONE place that decides which API the app talks to.
 * To switch to the real Express backend: implement the Http*Api classes and set
 * `useMockApi: false` in the environment file. Nothing else changes.
 */
export function provideApi(useMock: boolean = environment.useMockApi): Provider[] {
  return useMock
    ? [
        { provide: AuthApi, useClass: MockAuthApi },
        { provide: RequestApi, useClass: MockRequestApi },
        { provide: UserApi, useClass: MockUserApi },
        { provide: ReportApi, useClass: MockReportApi },
      ]
    : [
        { provide: AuthApi, useClass: HttpAuthApi },
        { provide: RequestApi, useClass: HttpRequestApi },
        { provide: UserApi, useClass: HttpUserApi },
        { provide: ReportApi, useClass: HttpReportApi },
      ];
}
