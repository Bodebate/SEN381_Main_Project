import { ServiceRequest, User } from '../models';
import {
  getNextStatus,
  isOverdue,
  validateCanApprove,
  validateCanResolveOrClose,
  validateCanViewRequest,
  validateTransition,
} from './request-rules';

const baseUser: User = {
  id: 'u1', username: 'u1', firstName: 'A', lastName: 'B', role: 'STAFF', clearance: 2, departmentId: 'dep-water',
  workCategoryIds: [], email: null, phone: null, notifyVia: 'EMAIL', verified: true, approval: 'APPROVED',
  approvedBy: null, approvedAt: null, decisionNote: null, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};
const user = (patch: Partial<User>): User => ({ ...baseUser, ...patch });

const baseRequest = {
  id: 'r1', requesterIds: ['req1'], categoryId: 'cat', departmentId: 'dep-water', securityLevel: 2,
  status: 'IN_PROGRESS', dueAt: null,
} as unknown as ServiceRequest;
const request = (patch: Partial<ServiceRequest>): ServiceRequest => ({ ...baseRequest, ...patch });

describe('status transitions (FR-STF-005)', () => {
  it('only allows the next step in order', () => {
    expect(validateTransition('SUBMITTED', 'ASSIGNED')).toBe(true);
    expect(validateTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(validateTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    expect(validateTransition('RESOLVED', 'CLOSED')).toBe(true);
  });

  it('rejects skipping, going back, or moving a closed request', () => {
    expect(validateTransition('SUBMITTED', 'CLOSED')).toBe(false);
    expect(validateTransition('ASSIGNED', 'RESOLVED')).toBe(false);
    expect(validateTransition('IN_PROGRESS', 'ASSIGNED')).toBe(false);
    expect(getNextStatus('CLOSED')).toBeNull();
  });
});

describe('overdue (FR-MNG-002)', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('is overdue when the staff-set due date has passed and the request is open', () => {
    expect(isOverdue(request({ dueAt: '2026-10-09T17:00:00Z', status: 'ASSIGNED' }), now)).toBe(true);
  });
  it('is not overdue without a due date, before it, or once resolved', () => {
    expect(isOverdue(request({ dueAt: null }), now)).toBe(false);
    expect(isOverdue(request({ dueAt: '2026-10-11T17:00:00Z' }), now)).toBe(false);
    expect(isOverdue(request({ dueAt: '2026-10-01T17:00:00Z', status: 'RESOLVED' }), now)).toBe(false);
  });
});

describe('who can see a request (FR-REQ-004, FR-STF-001)', () => {
  it('requesters see only their own requests', () => {
    expect(validateCanViewRequest(user({ id: 'req1', role: 'REQUESTER' }), request({}))).toBe(true);
    expect(validateCanViewRequest(user({ id: 'other', role: 'REQUESTER' }), request({}))).toBe(false);
  });
  it('staff see their department within their clearance, plus uncategorised triage', () => {
    expect(validateCanViewRequest(user({}), request({}))).toBe(true);
    expect(validateCanViewRequest(user({ departmentId: 'dep-roads' }), request({}))).toBe(false);
    expect(validateCanViewRequest(user({ clearance: 1 }), request({}))).toBe(false);
    expect(validateCanViewRequest(user({ departmentId: 'dep-roads' }), request({ categoryId: null, departmentId: null }))).toBe(true);
  });
  it('managers see everything; unapproved accounts see nothing', () => {
    expect(validateCanViewRequest(user({ role: 'MANAGER', departmentId: null }), request({}))).toBe(true);
    expect(validateCanViewRequest(user({ role: null }), request({}))).toBe(false);
  });
});

describe('resolve/close and approvals (FR-STF-007, account sign-off)', () => {
  it('staff need enough clearance to resolve; managers always can', () => {
    expect(validateCanResolveOrClose(user({ clearance: 2 }), request({ securityLevel: 2 }))).toBe(true);
    expect(validateCanResolveOrClose(user({ clearance: 1 }), request({ securityLevel: 2 }))).toBe(false);
    expect(validateCanResolveOrClose(user({ role: 'MANAGER' }), request({ securityLevel: 5 }))).toBe(true);
    expect(validateCanResolveOrClose(user({ role: 'REQUESTER' }), request({ securityLevel: 0 }))).toBe(false);
  });
  it('managers approve others but not themselves, and only admins grant Manager/Admin', () => {
    const manager = user({ id: 'm', role: 'MANAGER' });
    const admin = user({ id: 'a', role: 'ADMIN' });
    const target = user({ id: 't', role: null });
    expect(validateCanApprove(manager, target, 'STAFF')).toBe(true);
    expect(validateCanApprove(manager, manager, 'STAFF')).toBe(false);
    expect(validateCanApprove(manager, target, 'MANAGER')).toBe(false);
    expect(validateCanApprove(admin, target, 'MANAGER')).toBe(true);
  });
});
