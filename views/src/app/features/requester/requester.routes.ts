import { Routes } from '@angular/router';

export const REQUESTER_ROUTES: Routes = [
  { path: '', title: 'My requests · CivicConnect', loadComponent: () => import('./my-requests-page').then((m) => m.MyRequestsPage) },
  { path: 'new', title: 'New request · CivicConnect', loadComponent: () => import('./new-request-page').then((m) => m.NewRequestPage) },
  { path: ':id', title: 'Request status · CivicConnect', loadComponent: () => import('./request-status-page').then((m) => m.RequestStatusPage) },
];
