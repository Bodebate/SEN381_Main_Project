import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { approvedGuard, authGuard, guestGuard, pendingGuard, roleGuard, verificationGuard } from './core/auth/guards';
import { SessionService } from './core/auth/session.service';
import { PublicLayout } from './layouts/public-layout';
import { ShellLayout } from './layouts/shell-layout';

/** Route map. Matches wireframe 09 (Angular routes & components). */
export const routes: Routes = [
  // "/" sends each user to their own home page.
  { path: '', pathMatch: 'full', redirectTo: () => inject(SessionService).getHomeUrl() },

  // Public pages: sign in, register, verify code (2FA, once at sign-up), waiting for approval.
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: 'login', title: 'Sign in · CivicConnect', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage) },
      { path: 'register', title: 'Create an account · CivicConnect', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register-page').then((m) => m.RegisterPage) },
      { path: 'register/verify', title: 'Verify your account · CivicConnect', canActivate: [verificationGuard], loadComponent: () => import('./features/auth/verify-page').then((m) => m.VerifyPage) },
      { path: 'pending', title: 'Waiting for approval · CivicConnect', canActivate: [pendingGuard], loadComponent: () => import('./features/auth/pending-page').then((m) => m.PendingPage) },
      { path: '403', title: 'Access denied · CivicConnect', loadComponent: () => import('./features/errors/access-denied-page').then((m) => m.AccessDeniedPage) },
    ],
  },

  // Signed-in, approved users.
  {
    path: '',
    component: ShellLayout,
    canActivate: [authGuard, approvedGuard],
    children: [
      { path: 'requests', canActivate: [roleGuard], data: { roles: ['REQUESTER'] }, loadChildren: () => import('./features/requester/requester.routes').then((m) => m.REQUESTER_ROUTES) },
      { path: 'staff', canActivate: [roleGuard], data: { roles: ['STAFF', 'MANAGER', 'ADMIN'] }, loadChildren: () => import('./features/staff/staff.routes').then((m) => m.STAFF_ROUTES) },
      { path: 'manage', canActivate: [roleGuard], data: { roles: ['MANAGER', 'ADMIN'] }, loadChildren: () => import('./features/manager/manager.routes').then((m) => m.MANAGER_ROUTES) },
      { path: 'account', title: 'Account settings · CivicConnect', loadComponent: () => import('./features/account/account-settings-page').then((m) => m.AccountSettingsPage) },
    ],
  },

  { path: '**', title: 'Page not found · CivicConnect', loadComponent: () => import('./features/errors/not-found-page').then((m) => m.NotFoundPage) },
];
