import { Routes } from '@angular/router';

export const STAFF_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'queue' },
  { path: 'queue', title: 'Request queue · CivicConnect', loadComponent: () => import('./staff-queue-page').then((m) => m.StaffQueuePage) },
  { path: 'requests/:id', title: 'Request detail · CivicConnect', loadComponent: () => import('./staff-request-page').then((m) => m.StaffRequestPage) },
];
