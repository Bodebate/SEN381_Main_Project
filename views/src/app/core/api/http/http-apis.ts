import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
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
} from '../../models';
import { AuthApi, ReportApi, RequestApi, UserApi } from '../contracts';

/**
 * HTTP implementations for the real Express API (used when `environment.useMockApi` is false).
 * Endpoint paths are proposals: align them with the Express routes in `controllers/` when they exist.
 * The Express API returns camelCase JSON; MongoDB snake_case is mapped on the server.
 */
const base = environment.apiBaseUrl;

@Injectable()
export class HttpAuthApi extends AuthApi {
  private readonly http = inject(HttpClient);
  override postLogin(username: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${base}/auth/login`, { username, password });
  }
  override postRegistration(data: RegistrationData): Observable<{ userId: string; sentTo: string }> {
    return this.http.post<{ userId: string; sentTo: string }>(`${base}/auth/register`, data);
  }
  override postVerification(userId: string, code: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${base}/auth/verify`, { userId, code });
  }
  override postResendCode(userId: string): Observable<{ sentTo: string }> {
    return this.http.post<{ sentTo: string }>(`${base}/auth/resend-code`, { userId });
  }
  override getSessionUser(_token: string): Observable<User> {
    // The token is attached by authInterceptor.
    return this.http.get<User>(`${base}/auth/me`);
  }
  override postLogout(): Observable<void> {
    return this.http.post<void>(`${base}/auth/logout`, {});
  }
}

@Injectable()
export class HttpRequestApi extends RequestApi {
  private readonly http = inject(HttpClient);
  override getRequests(query: RequestQuery = {}): Observable<ServiceRequest[]> {
    let params = new HttpParams();
    if (query.mine) params = params.set('mine', 'true');
    return this.http.get<ServiceRequest[]>(`${base}/requests`, { params });
  }
  override getRequest(id: string): Observable<ServiceRequest> {
    return this.http.get<ServiceRequest>(`${base}/requests/${id}`);
  }
  override postRequest(data: NewRequestData): Observable<ServiceRequest> {
    return this.http.post<ServiceRequest>(`${base}/requests`, data);
  }
  override postComment(id: string, text: string): Observable<ServiceRequest> {
    return this.http.post<ServiceRequest>(`${base}/requests/${id}/comments`, { text });
  }
  override postNote(id: string, details: string, applyToGroup: boolean): Observable<ServiceRequest> {
    return this.http.post<ServiceRequest>(`${base}/requests/${id}/notes`, { details, applyToGroup });
  }
  override updateTriage(id: string, data: TriageData): Observable<ServiceRequest> {
    return this.http.put<ServiceRequest>(`${base}/requests/${id}/triage`, data);
  }
  override updateAssignee(id: string, assigneeId: string): Observable<ServiceRequest> {
    return this.http.put<ServiceRequest>(`${base}/requests/${id}/assignee`, { assigneeId });
  }
  override updateDueDate(id: string, dueAt: string, reason: string): Observable<ServiceRequest> {
    return this.http.put<ServiceRequest>(`${base}/requests/${id}/due-date`, { dueAt, reason });
  }
  override updateCategory(id: string, categoryId: string, reason: string): Observable<ServiceRequest> {
    return this.http.put<ServiceRequest>(`${base}/requests/${id}/category`, { categoryId, reason });
  }
  override updateStatus(id: string, update: StatusUpdate): Observable<ServiceRequest> {
    return this.http.put<ServiceRequest>(`${base}/requests/${id}/status`, update);
  }
  override getGroups(): Observable<RequestGroup[]> {
    return this.http.get<RequestGroup[]>(`${base}/request-groups`);
  }
  override postGroup(requestIds: string[], title: string): Observable<RequestGroup> {
    return this.http.post<RequestGroup>(`${base}/request-groups`, { requestIds, title });
  }
  override getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${base}/categories`);
  }
  override getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${base}/departments`);
  }
}

@Injectable()
export class HttpUserApi extends UserApi {
  private readonly http = inject(HttpClient);
  override getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${base}/users`);
  }
  override getDirectory(): Observable<DirectoryEntry[]> {
    return this.http.get<DirectoryEntry[]>(`${base}/users/directory`);
  }
  override getAssignableStaff(departmentId: string | null): Observable<User[]> {
    const params = departmentId ? new HttpParams().set('departmentId', departmentId) : undefined;
    return this.http.get<User[]>(`${base}/users/assignable`, { params });
  }
  override updateApproval(userId: string, decision: ApprovalDecision): Observable<User> {
    return this.http.put<User>(`${base}/users/${userId}/approval`, decision);
  }
  override updateProfile(firstName: string, lastName: string): Observable<User> {
    return this.http.put<User>(`${base}/me/profile`, { firstName, lastName });
  }
  override updateContact(update: ContactUpdate): Observable<ContactUpdateResult> {
    return this.http.put<ContactUpdateResult>(`${base}/me/contact`, update);
  }
  override updatePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${base}/me/password`, { currentPassword, newPassword });
  }
}

@Injectable()
export class HttpReportApi extends ReportApi {
  private readonly http = inject(HttpClient);
  override getDashboard(fromIso: string, toIso: string, departmentId: string | null): Observable<DashboardData> {
    let params = new HttpParams().set('from', fromIso).set('to', toIso);
    if (departmentId) params = params.set('departmentId', departmentId);
    return this.http.get<DashboardData>(`${base}/reports/dashboard`, { params });
  }
  override getExport(requestIds: string[], options: ExportOptions): Observable<Blob> {
    return this.http.post(`${base}/reports/export`, { requestIds, ...options }, { responseType: 'blob' });
  }
}
