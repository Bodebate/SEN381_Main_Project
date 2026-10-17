import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

/**
 * Attaches the session token to every API call and handles auth failures centrally.
 * Only active with the HTTP API (the mock API does not use HttpClient).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const token = session.token();
  const authorised = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  return next(authorised).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        session.clear();
        void router.navigate(['/login']);
      } else if (error instanceof HttpErrorResponse && error.status === 403) {
        void router.navigate(['/403']);
      }
      return throwError(() => error);
    }),
  );
};
