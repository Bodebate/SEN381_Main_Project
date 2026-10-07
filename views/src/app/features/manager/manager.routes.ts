import { Routes } from '@angular/router';

export const MANAGER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', title: 'Dashboard · CivicConnect', loadComponent: () => import('./dashboard-page').then((m) => m.DashboardPage) },
  { path: 'track', title: 'Track, group & export · CivicConnect', loadComponent: () => import('./track-page').then((m) => m.TrackPage) },
  { path: 'approvals', title: 'Account approvals · CivicConnect', loadComponent: () => import('./approvals-page').then((m) => m.ApprovalsPage) },
];
