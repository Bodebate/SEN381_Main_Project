import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models';
import { SessionService } from './session.service';

/**
 * Route guards. They only shape navigation; the API must still reject unauthorised calls (NFR-SEC-001).
 */

/** Signed-in users only; others go to /login and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return session.isSignedIn()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Verified and manager-approved accounts only; others go to /register/verify or /pending. */
export const approvedGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isApproved() ? true : inject(Router).parseUrl(session.getHomeUrl());
};

/** Route `data: { roles: [...] }` lists who may enter; everyone else sees Access denied. */
export const roleGuard: CanActivateFn = (route) => {
  const roles = (route.data['roles'] ?? []) as Role[];
  const role = inject(SessionService).user()?.role;
  return role && roles.includes(role) ? true : inject(Router).parseUrl('/403');
};

/** Signed-out visitors only (login, register). Signed-in users go to their home page. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isSignedIn() ? inject(Router).parseUrl(session.getHomeUrl()) : true;
};

/** The code-entry page: only for a registration that still needs its code. */
export const verificationGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const user = session.user();
  const needsCode = (user && !user.verified) || (!user && session.pendingVerification() !== null);
  return needsCode ? true : inject(Router).parseUrl(session.getHomeUrl());
};

/** The waiting page: only for verified accounts that management has not approved yet. */
export const pendingGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const user = session.user();
  if (!user) return inject(Router).parseUrl('/login');
  return session.getHomeUrl(user) === '/pending' ? true : inject(Router).parseUrl(session.getHomeUrl(user));
};
