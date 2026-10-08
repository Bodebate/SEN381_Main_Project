import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Category,
  Department,
  NewRequestData,
  RequestGroup,
  RequestQuery,
  ServiceRequest,
  STATUS_LABEL,
  StatusUpdate,
  TriageData,
} from '../../models';
import {
  isStaffRole,
  validateCanResolveOrClose,
  validateCanViewRequest,
  validateTransition,
} from '../../domain/request-rules';
import { ApiError } from '../api-error';
import { RequestApi } from '../contracts';
import { MockDb } from './mock-db';

@Injectable()
export class MockRequestApi extends RequestApi {
  private readonly db = inject(MockDb);

  /** Loads a request the current user may see, or fails with 403 (FR-STF-001 "Access Denied"). */
  private visibleRequest(id: string): ServiceRequest {
    const request = this.db.findRequest(id);
    if (!validateCanViewRequest(this.db.currentUser(), request)) {
      throw new ApiError(403, 'Access denied. This request is outside your role or department.');
    }
    return request;
  }

  private requireStaff(): void {
    if (!isStaffRole(this.db.currentUser())) throw new ApiError(403, 'Only staff can do this.');
  }

  private touch(request: ServiceRequest): ServiceRequest {
    request.updatedAt = new Date().toISOString();
    return request;
  }

  override getRequests(query: RequestQuery = {}): Observable<ServiceRequest[]> {
    return this.db.respond(() => {
      const user = this.db.currentUser();
      return this.db.requests
        .filter((r) => validateCanViewRequest(user, r))
        .filter((r) => !query.mine || r.assignedTo === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  override getRequest(id: string): Observable<ServiceRequest> {
    return this.db.respond(() => this.visibleRequest(id));
  }

  override postRequest(data: NewRequestData): Observable<ServiceRequest> {
    return this.db.respond(() => {
      const user = this.db.currentUser();
      if (user.role !== 'REQUESTER') throw new ApiError(403, 'Only requesters can submit requests.');
      const now = new Date().toISOString();
      const request: ServiceRequest = {
        id: this.db.nextId('r'),
        trackingId: this.db.nextTrackingNumber(),
        title: data.title.trim(),
        details: data.details.trim(),
        address: data.address.trim(),
        contact: data.contact,
        requesterIds: [user.id],
        categoryId: null,
        departmentId: null,
        securityLevel: null,
        priority: null,
        status: 'SUBMITTED',
        active: true,
        groupId: null,
        assignedTo: null,
        assignedBy: null,
        assignedAt: null,
        categorisedBy: null,
        dueAt: null,
        dueSetBy: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionOutcome: null,
        closedAt: null,
        closedBy: null,
        createdAt: now,
        updatedAt: now,
        notes: [],
        statusHistory: [{ from: null, to: 'SUBMITTED', by: user.id, at: now, comment: 'Request submitted.', notifyRequester: false }],
      };
      this.db.requests.push(request);
      return request;
    }, 400);
  }

  override postComment(id: string, text: string): Observable<ServiceRequest> {
    return this.db.respond(() => {
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      request.notes.push({ id: this.db.nextId('n'), type: 'COMMENT', visibility: 'PUBLIC', details: text.trim(), userId: user.id, date: new Date().toISOString() });
      return this.touch(request);
    });
  }

  override postNote(id: string, details: string, applyToGroup: boolean): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      // REQ-DAT-002: one note copied to every active request in the group (a transaction in the real API).
      const targets = applyToGroup && request.groupId
        ? this.db.requests.filter((r) => r.groupId === request.groupId && r.active)
        : [request];
      const date = new Date().toISOString();
      for (const target of targets) {
        target.notes.push({ id: this.db.nextId('n'), type: 'WORK', visibility: 'INTERNAL', details: details.trim(), userId: user.id, date });
        this.touch(target);
      }
      return request;
    });
  }

  override updateTriage(id: string, data: TriageData): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      if (request.status !== 'SUBMITTED') throw new ApiError(409, 'This request has already been triaged.');
      const category = this.db.categories.find((c) => c.id === data.categoryId && c.isActive);
      if (!category) throw new ApiError(400, 'Choose a valid category.');
      const assignee = this.db.users.find((u) => u.id === data.assigneeId && u.isActive && u.role !== 'REQUESTER');
      if (!assignee) throw new ApiError(400, 'Choose an active staff member.');
      if (!data.comment.trim()) throw new ApiError(400, 'A comment is required.');
      const now = new Date().toISOString();
      Object.assign(request, {
        categoryId: category.id,
        departmentId: category.departmentId,
        securityLevel: category.defaultSecurityLevel,
        categorisedBy: user.id,
        priority: data.priority,
        assignedTo: assignee.id,
        assignedBy: user.id,
        assignedAt: now,
        dueAt: data.dueAt,
        dueSetBy: user.id,
        status: 'ASSIGNED',
      });
      request.statusHistory.push({ from: 'SUBMITTED', to: 'ASSIGNED', by: user.id, at: now, comment: data.comment.trim(), notifyRequester: true });
      return this.touch(request);
    });
  }

  override updateAssignee(id: string, assigneeId: string): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      const assignee = this.db.users.find((u) => u.id === assigneeId && u.isActive && u.role !== 'REQUESTER');
      if (!assignee) throw new ApiError(400, 'Choose an active staff member.');
      const now = new Date().toISOString();
      Object.assign(request, { assignedTo: assignee.id, assignedBy: user.id, assignedAt: now });
      request.notes.push({ id: this.db.nextId('n'), type: 'ASSIGNMENT', visibility: 'INTERNAL', details: `Assigned to ${assignee.firstName} ${assignee.lastName}.`, userId: user.id, date: now });
      return this.touch(request);
    });
  }

  override updateDueDate(id: string, dueAt: string, reason: string): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      if (!reason.trim()) throw new ApiError(400, 'A reason is required to change the due date.');
      request.dueAt = dueAt;
      request.dueSetBy = user.id;
      request.notes.push({ id: this.db.nextId('n'), type: 'SYSTEM', visibility: 'INTERNAL', details: `Due date changed to ${dueAt.slice(0, 10)}: ${reason.trim()}`, userId: user.id, date: new Date().toISOString() });
      return this.touch(request);
    });
  }

  override updateCategory(id: string, categoryId: string, reason: string): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      const category = this.db.categories.find((c) => c.id === categoryId && c.isActive);
      if (!category) throw new ApiError(400, 'Choose a valid category.');
      if (!reason.trim()) throw new ApiError(400, 'A reason is required to change the category.');
      Object.assign(request, { categoryId: category.id, departmentId: category.departmentId, securityLevel: category.defaultSecurityLevel, categorisedBy: user.id });
      request.notes.push({ id: this.db.nextId('n'), type: 'SYSTEM', visibility: 'INTERNAL', details: `Category changed to ${category.name}: ${reason.trim()}`, userId: user.id, date: new Date().toISOString() });
      return this.touch(request);
    });
  }

  override updateStatus(id: string, update: StatusUpdate): Observable<ServiceRequest> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      const request = this.visibleRequest(id);
      if (request.status === 'SUBMITTED') throw new ApiError(409, 'Use triage to move a request out of Submitted.');
      if (!validateTransition(request.status, update.to)) {
        throw new ApiError(409, `A request can't move from ${STATUS_LABEL[request.status]} to ${STATUS_LABEL[update.to]}.`);
      }
      if ((update.to === 'RESOLVED' || update.to === 'CLOSED') && !validateCanResolveOrClose(user, request)) {
        throw new ApiError(403, 'Your role cannot resolve or close this request.');
      }
      if (!update.comment.trim()) throw new ApiError(400, 'A comment is required for every status change.');
      const now = new Date().toISOString();
      request.statusHistory.push({ from: request.status, to: update.to, by: user.id, at: now, comment: update.comment.trim(), notifyRequester: update.notifyRequester });
      request.status = update.to;
      if (update.to === 'RESOLVED') {
        Object.assign(request, { resolvedAt: now, resolvedBy: user.id, resolutionOutcome: update.resolutionOutcome ?? 'FIXED' });
      }
      if (update.to === 'CLOSED') {
        Object.assign(request, { closedAt: now, closedBy: user.id, active: false });
      }
      return this.touch(request);
    });
  }

  override getGroups(): Observable<RequestGroup[]> {
    return this.db.respond(() => this.db.groups);
  }

  override postGroup(requestIds: string[], title: string): Observable<RequestGroup> {
    return this.db.respond(() => {
      this.requireStaff();
      const user = this.db.currentUser();
      if (requestIds.length < 2) throw new ApiError(400, 'Select at least two requests to group.');
      const requests = requestIds.map((id) => this.visibleRequest(id));
      const group: RequestGroup = {
        id: this.db.nextId('grp'),
        title: title.trim() || `Group of ${requests.length} requests`,
        departmentId: requests[0].departmentId,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
      };
      this.db.groups.push(group);
      requests.forEach((r) => {
        r.groupId = group.id;
        this.touch(r);
      });
      return group;
    });
  }

  override getCategories(): Observable<Category[]> {
    return this.db.respond(() => this.db.categories.filter((c) => c.isActive), 0);
  }

  override getDepartments(): Observable<Department[]> {
    return this.db.respond(() => this.db.departments.filter((d) => d.isActive), 0);
  }
}
