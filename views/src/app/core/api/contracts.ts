import { Observable } from 'rxjs';
import {
  ApprovalDecision,
  AuthResult,
  Category,
  ContactUpdate,
  ContactUpdateResult,
  DashboardData,
  Department,
  DirectoryEntry,
  ExportOptions,
  NewRequestData,
  RegistrationData,
  RequestGroup,
  RequestQuery,
  ServiceRequest,
  StatusUpdate,
  TriageData,
  User,
} from '../models';

/**
 * API contracts. Pages and services depend ONLY on these abstract classes.
 * `api.providers.ts` binds each one to either the mock or the HTTP implementation,
 * chosen by `environment.useMockApi`. Swapping to the real Express API means filling in
 * the `Http*Api` classes and setting `useMockApi: false`; no page changes are needed.
 */

export abstract class AuthApi {
  /** Username + password only. 2FA is asked for at registration, not on every login. */
  abstract postLogin(username: string, password: string): Observable<AuthResult>;
  /** Creates an unverified account (role null, clearance 0) and sends a 6-digit code. */
  abstract postRegistration(data: RegistrationData): Observable<{ userId: string; sentTo: string }>;
  /** Marks the account verified. Returns a session so the user lands on the pending-approval page. */
  abstract postVerification(userId: string, code: string): Observable<AuthResult>;
  abstract postResendCode(userId: string): Observable<{ sentTo: string }>;
  /** Re-reads the signed-in user from a stored token (page refresh). */
  abstract getSessionUser(token: string): Observable<User>;
  abstract postLogout(): Observable<void>;
}

export abstract class RequestApi {
  abstract getRequests(query?: RequestQuery): Observable<ServiceRequest[]>;
  abstract getRequest(id: string): Observable<ServiceRequest>;
  abstract postRequest(data: NewRequestData): Observable<ServiceRequest>;
  abstract postComment(id: string, text: string): Observable<ServiceRequest>;
  abstract postNote(id: string, details: string, applyToGroup: boolean): Observable<ServiceRequest>;
  /** Staff triage: category + owner + due date + priority in one step; moves SUBMITTED -> ASSIGNED. */
  abstract updateTriage(id: string, data: TriageData): Observable<ServiceRequest>;
  abstract updateAssignee(id: string, assigneeId: string): Observable<ServiceRequest>;
  abstract updateDueDate(id: string, dueAt: string, reason: string): Observable<ServiceRequest>;
  abstract updateCategory(id: string, categoryId: string, reason: string): Observable<ServiceRequest>;
  abstract updateStatus(id: string, update: StatusUpdate): Observable<ServiceRequest>;
  abstract getGroups(): Observable<RequestGroup[]>;
  abstract postGroup(requestIds: string[], title: string): Observable<RequestGroup>;
  abstract getCategories(): Observable<Category[]>;
  abstract getDepartments(): Observable<Department[]>;
}

export abstract class UserApi {
  abstract getUsers(): Observable<User[]>;
  /** Display names for showing who did what (no contact details). */
  abstract getDirectory(): Observable<DirectoryEntry[]>;
  /** Active staff who can be assigned requests in a department. */
  abstract getAssignableStaff(departmentId: string | null): Observable<User[]>;
  abstract updateApproval(userId: string, decision: ApprovalDecision): Observable<User>;
  abstract updateProfile(firstName: string, lastName: string): Observable<User>;
  abstract updateContact(update: ContactUpdate): Observable<ContactUpdateResult>;
  abstract updatePassword(currentPassword: string, newPassword: string): Observable<void>;
}

export abstract class ReportApi {
  abstract getDashboard(fromIso: string, toIso: string, departmentId: string | null): Observable<DashboardData>;
  /** FR-MNG-004: returns a CSV file of the given requests. */
  abstract getExport(requestIds: string[], options: ExportOptions): Observable<Blob>;
}
