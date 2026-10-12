/** The five lifecycle steps from FR-STF-005, in order. */
export type RequestStatus = 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const STATUS_ORDER: readonly RequestStatus[] = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: 'Submitted',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export type ResolutionOutcome = 'FIXED' | 'REJECTED' | 'DUPLICATE';
export const OUTCOME_LABEL: Record<ResolutionOutcome, string> = {
  FIXED: 'Fixed',
  REJECTED: 'Rejected',
  DUPLICATE: 'Duplicate',
};

export type NoteType = 'WORK' | 'COMMENT' | 'ASSIGNMENT' | 'SYSTEM';
export type NoteVisibility = 'INTERNAL' | 'PUBLIC';

export interface RequestNote {
  id: string;
  type: NoteType;
  visibility: NoteVisibility;
  details: string;
  userId: string;
  date: string;
}

export interface StatusChange {
  from: RequestStatus | null;
  to: RequestStatus;
  by: string;
  at: string;
  comment: string;
  /** When true the comment is shown to the requester and sent with the notification. */
  notifyRequester: boolean;
}

/** Mirrors the `requests` collection. Attachments are deferred and intentionally absent. */
export interface ServiceRequest {
  id: string;
  trackingId: string;
  title: string;
  details: string;
  address: string;
  contact: { email: string | null; phone: string | null };
  requesterIds: string[];
  /** Set by staff at triage; null while the request is uncategorised. */
  categoryId: string | null;
  departmentId: string | null;
  securityLevel: number | null;
  priority: Priority | null;
  status: RequestStatus;
  active: boolean;
  groupId: string | null;
  assignedTo: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  categorisedBy: string | null;
  /** Set by staff, never by the requester. */
  dueAt: string | null;
  dueSetBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionOutcome: ResolutionOutcome | null;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  notes: RequestNote[];
  statusHistory: StatusChange[];
}

export interface RequestGroup {
  id: string;
  title: string;
  departmentId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface NewRequestData {
  title: string;
  details: string;
  address: string;
  contact: { email: string | null; phone: string | null };
}

export interface TriageData {
  categoryId: string;
  assigneeId: string;
  dueAt: string;
  priority: Priority;
  comment: string;
}

export interface StatusUpdate {
  to: RequestStatus;
  comment: string;
  notifyRequester: boolean;
  resolutionOutcome?: ResolutionOutcome;
}

export interface RequestQuery {
  /** Only requests assigned to the current user. */
  mine?: boolean;
}
