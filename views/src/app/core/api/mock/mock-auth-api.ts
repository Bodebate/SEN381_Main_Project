import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResult, RegistrationData, User } from '../../models';
import { ApiError } from '../api-error';
import { AuthApi } from '../contracts';
import { MockDb } from './mock-db';

const TOKEN_PREFIX = 'mock-token-';

function maskDestination(user: User): string {
  if (user.notifyVia === 'SMS' && user.phone) return `SMS ••• ${user.phone.slice(-4)}`;
  if (user.email) return `email ${user.email.replace(/^(.).*(@.*)$/, '$1•••$2')}`;
  return user.phone ? `SMS ••• ${user.phone.slice(-4)}` : 'your contact details';
}

@Injectable()
export class MockAuthApi extends AuthApi {
  private readonly db = inject(MockDb);

  override postLogin(username: string, password: string): Observable<AuthResult> {
    return this.db.respond(() => {
      const user = this.db.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      if (!user || this.db.passwords.get(user.id) !== password) {
        throw new ApiError(401, 'Incorrect username or password.');
      }
      if (user.approval === 'DECLINED') {
        throw new ApiError(403, 'Your account application was declined. Contact the organisation for help.');
      }
      this.db.currentUserId = user.id;
      return { user, token: TOKEN_PREFIX + user.id };
    }, 300);
  }

  override postRegistration(data: RegistrationData): Observable<{ userId: string; sentTo: string }> {
    return this.db.respond(() => {
      if (this.db.users.some((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
        throw new ApiError(409, 'That username is already taken.');
      }
      const user: User = {
        id: this.db.nextId('u'),
        username: data.username.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        // The role is never taken from the form: new accounts wait for manager sign-off.
        role: null,
        clearance: 0,
        departmentId: null,
        workCategoryIds: [],
        email: data.email,
        phone: data.phone,
        notifyVia: data.notifyVia,
        verified: false,
        approval: 'PENDING',
        approvedBy: null,
        approvedAt: null,
        decisionNote: null,
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      this.db.users.push(user);
      this.db.passwords.set(user.id, data.password);
      this.db.pendingCodes.set(user.id, '000000');
      return { userId: user.id, sentTo: maskDestination(user) };
    }, 300);
  }

  override postVerification(userId: string, code: string): Observable<AuthResult> {
    return this.db.respond(() => {
      const user = this.db.users.find((u) => u.id === userId);
      if (!user) throw new ApiError(404, 'Account not found. Please register again.');
      // Mock: any 6-digit code is accepted.
      if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code we sent you.');
      user.verified = true;
      this.db.pendingCodes.delete(userId);
      this.db.currentUserId = user.id;
      return { user, token: TOKEN_PREFIX + user.id };
    }, 300);
  }

  override postResendCode(userId: string): Observable<{ sentTo: string }> {
    return this.db.respond(() => {
      const user = this.db.users.find((u) => u.id === userId);
      if (!user) throw new ApiError(404, 'Account not found. Please register again.');
      return { sentTo: maskDestination(user) };
    });
  }

  override getSessionUser(token: string): Observable<User> {
    return this.db.respond(() => {
      const id = token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : '';
      const user = this.db.users.find((u) => u.id === id);
      if (!user) throw new ApiError(401, 'Session expired.');
      this.db.currentUserId = user.id;
      return user;
    }, 0);
  }

  override postLogout(): Observable<void> {
    return this.db.respond(() => {
      this.db.currentUserId = null;
    }, 0);
  }
}
