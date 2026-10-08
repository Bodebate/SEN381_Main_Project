import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApprovalDecision, ContactUpdate, ContactUpdateResult, DirectoryEntry, User } from '../../models';
import { isManagerRole, validateCanApprove } from '../../domain/request-rules';
import { ApiError } from '../api-error';
import { UserApi } from '../contracts';
import { MockDb } from './mock-db';

@Injectable()
export class MockUserApi extends UserApi {
  private readonly db = inject(MockDb);

  override getUsers(): Observable<User[]> {
    return this.db.respond(() => {
      if (!isManagerRole(this.db.currentUser())) throw new ApiError(403, 'Only managers can view accounts.');
      return [...this.db.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  override getDirectory(): Observable<DirectoryEntry[]> {
    return this.db.respond(() => {
      this.db.currentUser();
      return this.db.users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role }));
    }, 0);
  }

  override getAssignableStaff(departmentId: string | null): Observable<User[]> {
    return this.db.respond(() =>
      this.db.users.filter(
        (u) => u.isActive && u.role === 'STAFF' && (departmentId === null || u.departmentId === departmentId),
      ),
    );
  }

  override updateApproval(userId: string, decision: ApprovalDecision): Observable<User> {
    return this.db.respond(() => {
      const approver = this.db.currentUser();
      const target = this.db.users.find((u) => u.id === userId);
      if (!target) throw new ApiError(404, 'Account not found.');
      const now = new Date().toISOString();
      if (decision.decision === 'DECLINE') {
        if (!decision.note.trim()) throw new ApiError(400, 'A note is required when declining.');
        if (!isManagerRole(approver) || approver.id === target.id) throw new ApiError(403, 'You cannot decide on this account.');
        Object.assign(target, { approval: 'DECLINED', isActive: false, approvedBy: approver.id, approvedAt: now, decisionNote: decision.note.trim() });
        return target;
      }
      if (!decision.role) throw new ApiError(400, 'Choose a role.');
      if (!validateCanApprove(approver, target, decision.role)) {
        throw new ApiError(403, 'You cannot grant this role. Only an admin can grant Manager or Admin.');
      }
      if (decision.role === 'STAFF' && !decision.departmentId) {
        throw new ApiError(400, 'Staff need a department.');
      }
      Object.assign(target, {
        role: decision.role,
        clearance: decision.clearance,
        departmentId: decision.role === 'REQUESTER' ? null : decision.departmentId,
        workCategoryIds: decision.role === 'STAFF' ? decision.workCategoryIds : [],
        approval: 'APPROVED',
        isActive: true,
        approvedBy: approver.id,
        approvedAt: now,
        decisionNote: decision.note.trim() || null,
      });
      return target;
    });
  }

  override updateProfile(firstName: string, lastName: string): Observable<User> {
    return this.db.respond(() => {
      const user = this.db.currentUser();
      if (!firstName.trim() || !lastName.trim()) throw new ApiError(400, 'First and last name are required.');
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      return user;
    });
  }

  override updateContact(update: ContactUpdate): Observable<ContactUpdateResult> {
    return this.db.respond((): ContactUpdateResult => {
      const user = this.db.currentUser();
      if (!update.email && !update.phone) throw new ApiError(400, 'Keep at least one of email or mobile.');
      if (update.notifyVia === 'EMAIL' && !update.email) throw new ApiError(400, 'Add an email address to receive email updates.');
      if (update.notifyVia === 'SMS' && !update.phone) throw new ApiError(400, 'Add a mobile number to receive SMS updates.');
      const emailChanged = (update.email ?? null) !== user.email;
      const phoneChanged = (update.phone ?? null) !== user.phone;
      if ((emailChanged || phoneChanged) && !update.code) {
        const sentTo = emailChanged && update.email ? update.email : `SMS ••• ${update.phone?.slice(-4)}`;
        return { status: 'CODE_SENT', sentTo };
      }
      if ((emailChanged || phoneChanged) && !/^\d{6}$/.test(update.code ?? '')) {
        throw new ApiError(400, 'Enter the 6-digit code we sent to your new contact details.');
      }
      Object.assign(user, { email: update.email, phone: update.phone, notifyVia: update.notifyVia });
      return { status: 'SAVED', user };
    });
  }

  override updatePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.db.respond(() => {
      const user = this.db.currentUser();
      if (this.db.passwords.get(user.id) !== currentPassword) throw new ApiError(400, 'Your current password is incorrect.');
      if (newPassword.length < 8) throw new ApiError(400, 'Use at least 8 characters for the new password.');
      this.db.passwords.set(user.id, newPassword);
    });
  }
}
