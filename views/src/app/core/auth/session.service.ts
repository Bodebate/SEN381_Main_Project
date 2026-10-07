import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { AuthResult, RegistrationData, User } from '../models';
import { AuthApi } from '../api/contracts';

const TOKEN_KEY = 'cc.token';
const PENDING_KEY = 'cc.pendingVerification';

export interface PendingVerification {
  userId: string;
  sentTo: string;
}

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode): session lasts until refresh */
  }
}

/**
 * Holds who is signed in. Pages and guards read from here; only this service talks to AuthApi.
 * Flow: register -> verify code (2FA, once) -> pending manager approval -> approved -> role home page.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly authApi = inject(AuthApi);

  readonly user = signal<User | null>(null);
  readonly token = signal<string | null>(readStorage(TOKEN_KEY));
  readonly pendingVerification = signal<PendingVerification | null>(
    JSON.parse(readStorage(PENDING_KEY) ?? 'null') as PendingVerification | null,
  );

  readonly isSignedIn = computed(() => this.user() !== null);
  /** Verified, approved and given a role by management. */
  readonly isApproved = computed(() => {
    const u = this.user();
    return !!u && u.verified && u.approval === 'APPROVED' && u.isActive && u.role !== null;
  });

  /** Called once at start-up so a page refresh keeps the user signed in. */
  async restore(): Promise<void> {
    const token = this.token();
    if (!token) return;
    try {
      this.user.set(await firstValueFrom(this.authApi.getSessionUser(token)));
    } catch {
      this.clear();
    }
  }

  /** Returns the URL to go to after signing in. */
  postLogin(username: string, password: string): Observable<string> {
    return this.authApi.postLogin(username, password).pipe(
      tap((result) => this.start(result)),
      map((result) => {
        if (!result.user.verified) {
          this.setPending({ userId: result.user.id, sentTo: 'the contact details you registered with' });
        }
        return this.getHomeUrl(result.user);
      }),
    );
  }

  postRegistration(data: RegistrationData): Observable<PendingVerification> {
    return this.authApi.postRegistration(data).pipe(tap((pending) => this.setPending(pending)));
  }

  postVerification(code: string): Observable<string> {
    const pending = this.pendingVerification();
    const userId = pending?.userId ?? this.user()?.id ?? '';
    return this.authApi.postVerification(userId, code).pipe(
      tap((result) => {
        this.start(result);
        this.setPending(null);
      }),
      map((result) => this.getHomeUrl(result.user)),
    );
  }

  postResendCode(): Observable<{ sentTo: string }> {
    const userId = this.pendingVerification()?.userId ?? this.user()?.id ?? '';
    return this.authApi.postResendCode(userId).pipe(tap((r) => this.setPending({ userId, sentTo: r.sentTo })));
  }

  logout(): Observable<void> {
    return this.authApi.postLogout().pipe(tap({ next: () => this.clear(), error: () => this.clear() }));
  }

  /** Keep the session copy of the user in sync after profile changes. */
  updateUser(user: User): void {
    this.user.set(user);
  }

  /** Where each kind of account lands. Unverified and unapproved accounts never reach role pages. */
  getHomeUrl(user: User | null = this.user()): string {
    if (!user) return '/login';
    if (!user.verified) return '/register/verify';
    if (user.approval !== 'APPROVED' || !user.role || !user.isActive) return '/pending';
    switch (user.role) {
      case 'REQUESTER':
        return '/requests';
      case 'STAFF':
        return '/staff/queue';
      default:
        return '/manage/dashboard';
    }
  }

  clear(): void {
    this.user.set(null);
    this.token.set(null);
    writeStorage(TOKEN_KEY, null);
  }

  private start(result: AuthResult): void {
    this.user.set(result.user);
    this.token.set(result.token);
    writeStorage(TOKEN_KEY, result.token);
  }

  private setPending(pending: PendingVerification | null): void {
    this.pendingVerification.set(pending);
    writeStorage(PENDING_KEY, pending ? JSON.stringify(pending) : null);
  }
}
