import { RequestStatus, ServiceRequest, STATUS_ORDER, User } from '../models';

/**
 * Business rules shared by the UI and the mock API.
 * The real Express API must enforce the same rules server-side (NFR-SEC-001); the UI only mirrors them.
 */

/** FR-STF-005: the only status a request may move to next, or null when it is closed. */
export function getNextStatus(status: RequestStatus): RequestStatus | null {
  const index = STATUS_ORDER.indexOf(status);
  return index >= 0 && index < STATUS_ORDER.length - 1 ? STATUS_ORDER[index + 1] : null;
}

/** FR-STF-005: a transition is valid only to the immediate next status. */
export function validateTransition(from: RequestStatus, to: RequestStatus): boolean {
  return getNextStatus(from) === to;
}

export function isOpenStatus(status: RequestStatus): boolean {
  return status !== 'RESOLVED' && status !== 'CLOSED';
}

/** FR-MNG-002: overdue = a staff-set due date has passed and the request is not resolved or closed. */
export function isOverdue(request: Pick<ServiceRequest, 'dueAt' | 'status'>, now: Date = new Date()): boolean {
  return !!request.dueAt && isOpenStatus(request.status) && new Date(request.dueAt).getTime() < now.getTime();
}

export function isStaffRole(user: User | null): boolean {
  return !!user && (user.role === 'STAFF' || user.role === 'MANAGER' || user.role === 'ADMIN');
}

export function isManagerRole(user: User | null): boolean {
  return !!user && (user.role === 'MANAGER' || user.role === 'ADMIN');
}

/**
 * FR-STF-007: who may resolve or close a request.
 * Managers and admins always may; staff may when their clearance covers the request's security level.
 * [confirm with the team]
 */
export function validateCanResolveOrClose(user: User | null, request: ServiceRequest): boolean {
  if (!user) return false;
  if (isManagerRole(user)) return true;
  return user.role === 'STAFF' && user.clearance >= (request.securityLevel ?? 0);
}

/**
 * FR-REQ-004 / FR-STF-001: who may see a request.
 * - Requesters: only their own.
 * - Staff: their department, within their clearance, plus uncategorised requests waiting for triage.
 * - Managers and admins: everything.
 */
export function validateCanViewRequest(user: User | null, request: ServiceRequest): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'REQUESTER') return request.requesterIds.includes(user.id);
  if (isManagerRole(user)) return true;
  if (request.categoryId === null) return true;
  return request.departmentId === user.departmentId && (request.securityLevel ?? 0) <= user.clearance;
}

/** Whether the user is the account that may approve another account. */
export function validateCanApprove(approver: User | null, target: User, roleToGrant: User['role']): boolean {
  if (!approver || !isManagerRole(approver) || approver.id === target.id) return false;
  // [confirm] Only an admin may grant Manager or Admin roles.
  if ((roleToGrant === 'MANAGER' || roleToGrant === 'ADMIN') && approver.role !== 'ADMIN') return false;
  return true;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;
}
