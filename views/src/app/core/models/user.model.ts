/** Roles a user can hold once a manager has approved their account. */
export type Role = 'REQUESTER' | 'STAFF' | 'MANAGER' | 'ADMIN';

/** Channel used for request update notifications (stored per account, not per request). */
export type NotifyChannel = 'EMAIL' | 'SMS';

/** Where a new account sits in the manager sign-off process. */
export type ApprovalState = 'PENDING' | 'APPROVED' | 'DECLINED';

export const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: 'Requester',
  STAFF: 'Staff',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};

/**
 * Mirrors the `users` collection (camelCase in the front end, snake_case in MongoDB).
 * A new account starts with role = null, clearance = 0 and isActive = false until approved.
 */
export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role | null;
  clearance: number;
  departmentId: string | null;
  workCategoryIds: string[];
  email: string | null;
  phone: string | null;
  notifyVia: NotifyChannel;
  /** True once the registration code (2FA) has been entered. Only asked for at sign-up. */
  verified: boolean;
  approval: ApprovalState;
  approvedBy: string | null;
  approvedAt: string | null;
  decisionNote: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DirectoryEntry {
  id: string;
  name: string;
  role: Role | null;
}

export interface RegistrationData {
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  phone: string | null;
  notifyVia: NotifyChannel;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface ApprovalDecision {
  decision: 'APPROVE' | 'DECLINE';
  role: Role | null;
  clearance: number;
  departmentId: string | null;
  workCategoryIds: string[];
  note: string;
}

export interface ContactUpdate {
  email: string | null;
  phone: string | null;
  notifyVia: NotifyChannel;
  /** Code sent to a changed email or phone number. Required only when one of them changes. */
  code?: string;
}

export type ContactUpdateResult = { status: 'SAVED'; user: User } | { status: 'CODE_SENT'; sentTo: string };

export function fullName(user: Pick<User, 'firstName' | 'lastName'> | null | undefined): string {
  return user ? `${user.firstName} ${user.lastName}` : '';
}

export function initials(user: Pick<User, 'firstName' | 'lastName'> | null | undefined): string {
  return user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() : '';
}
