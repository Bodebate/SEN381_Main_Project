import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { Category, Department, RequestGroup, ServiceRequest, User } from '../../models';
import { ApiError } from '../api-error';
import { DEMO_PASSWORD, SEED_CATEGORIES, SEED_DEPARTMENTS, SEED_GROUPS, SEED_USERS, buildSeedRequests } from './mock-seed';

/**
 * In-memory "database" for the mock API. Data resets on page refresh.
 * Only the mock implementations touch this class; pages never do.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  users: User[] = structuredClone(SEED_USERS);
  passwords = new Map<string, string>(SEED_USERS.map((u) => [u.id, DEMO_PASSWORD]));
  departments: Department[] = structuredClone(SEED_DEPARTMENTS);
  categories: Category[] = structuredClone(SEED_CATEGORIES);
  groups: RequestGroup[] = structuredClone(SEED_GROUPS);
  requests: ServiceRequest[] = buildSeedRequests();
  /** Codes "sent" to new accounts; the mock accepts any 6 digits. */
  pendingCodes = new Map<string, string>();
  currentUserId: string | null = null;
  private sequence = 1000;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  nextTrackingNumber(): string {
    const max = Math.max(0, ...this.requests.map((r) => Number(r.trackingId.slice(-6))));
    return `REQ-${new Date().getFullYear()}-${String(max + 1).padStart(6, '0')}`;
  }

  currentUser(): User {
    const user = this.users.find((u) => u.id === this.currentUserId);
    if (!user) throw new ApiError(401, 'Your session has expired. Please sign in again.');
    return user;
  }

  findRequest(id: string): ServiceRequest {
    const request = this.requests.find((r) => r.id === id);
    if (!request) throw new ApiError(404, 'Request not found.');
    return request;
  }

  /** Wraps a synchronous mock operation so it behaves like an HTTP call (async, clone, errors). */
  respond<T>(operation: () => T, latencyMs = 150): Observable<T> {
    try {
      return of(structuredClone(operation())).pipe(delay(latencyMs));
    } catch (error) {
      return throwError(() => (error instanceof ApiError ? error : new ApiError(500, String(error))));
    }
  }
}
