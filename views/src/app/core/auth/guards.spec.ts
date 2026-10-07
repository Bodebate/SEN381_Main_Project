import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideApi } from '../api/api.providers';
import { User } from '../models';
import { approvedGuard, authGuard, guestGuard, pendingGuard, roleGuard, verificationGuard } from './guards';
import { SessionService } from './session.service';

const approved: User = {
  id: 'u1', username: 'u1', firstName: 'A', lastName: 'B', role: 'REQUESTER', clearance: 0, departmentId: null,
  workCategoryIds: [], email: null, phone: null, notifyVia: 'EMAIL', verified: true, approval: 'APPROVED',
  approvedBy: null, approvedAt: null, decisionNote: null, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

function run(guard: typeof authGuard, data: Record<string, unknown> = {}, url = '/requests'): boolean | UrlTree {
  const route = { data } as unknown as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => guard(route, state)) as boolean | UrlTree;
}

function target(result: boolean | UrlTree): string {
  return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result).split('?')[0] : String(result);
}

describe('route guards', () => {
  let session: SessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideApi(true)] });
    session = TestBed.inject(SessionService);
  });

  it('sends signed-out users to /login', () => {
    expect(target(run(authGuard))).toBe('/login');
  });

  it('lets an approved requester into requester pages but not staff pages', () => {
    session.user.set(approved);
    expect(run(authGuard)).toBe(true);
    expect(run(approvedGuard)).toBe(true);
    expect(run(roleGuard, { roles: ['REQUESTER'] })).toBe(true);
    expect(target(run(roleGuard, { roles: ['STAFF', 'MANAGER', 'ADMIN'] }))).toBe('/403');
  });

  it('keeps unverified accounts on the code page (2FA only at sign-up)', () => {
    session.user.set({ ...approved, verified: false, role: null, approval: 'PENDING', isActive: false });
    expect(target(run(approvedGuard))).toBe('/register/verify');
    expect(run(verificationGuard)).toBe(true);
  });

  it('keeps verified but unapproved accounts on /pending', () => {
    session.user.set({ ...approved, role: null, approval: 'PENDING', isActive: false });
    expect(target(run(approvedGuard))).toBe('/pending');
    expect(run(pendingGuard)).toBe(true);
  });

  it('sends signed-in users away from login and register', () => {
    session.user.set(approved);
    expect(target(run(guestGuard))).toBe('/requests');
  });
});
