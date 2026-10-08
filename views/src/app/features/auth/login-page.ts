import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/api/api-error';
import { SessionService } from '../../core/auth/session.service';

/** Wireframe 01. Username + password only; the 2FA code is asked for once, at registration. */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <form class="box stack auth-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h1>Sign in</h1>
        @if (error()) {
          <div class="alert error" role="alert">{{ error() }}</div>
        }
        <div class="field">
          <label class="label" for="username">Username</label>
          <input class="input" id="username" formControlName="username" autocomplete="username" />
        </div>
        <div class="field">
          <label class="label" for="password">Password</label>
          <input class="input" id="password" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        <p class="small muted">Forgot your password? Contact the organisation's help desk.</p>
        <p class="small">No account? <a routerLink="/register">Register</a>. New accounts need manager approval before they can be used.</p>
      </form>

      @if (showDemo) {
        <aside class="box soft stack-sm demo" aria-label="Demo accounts">
          <strong>Demo accounts</strong>
          <p class="small muted">Mock API is on. Every password is <span class="mono">demo</span>.</p>
          <ul class="small">
            @for (account of demoAccounts; track account.username) {
              <li><button type="button" class="link-btn" (click)="fill(account.username)">{{ account.username }}</button> — {{ account.note }}</li>
            }
          </ul>
        </aside>
      }
    </div>
  `,
  styles: `
    .auth-wrap { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; align-items: flex-start; width: 100%; }
    .auth-card { width: 100%; max-width: 420px; padding: 32px; }
    .demo { width: 100%; max-width: 320px; }
    ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** Bound from ?returnUrl= by the router. */
  readonly returnUrl = input<string>();

  protected readonly showDemo = environment.useMockApi;
  protected readonly demoAccounts = [
    { username: 'requester', note: 'Requester' },
    { username: 'staff', note: 'Staff, Water, clearance 3' },
    { username: 'staff3', note: 'Staff, Roads, clearance 2' },
    { username: 'manager', note: 'Manager' },
    { username: 'admin', note: 'Admin' },
    { username: 'pending', note: 'waiting for approval' },
    { username: 'unverified', note: 'never entered the sign-up code' },
    { username: 'declined', note: 'application declined' },
  ];

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected fill(username: string): void {
    this.form.setValue({ username, password: 'demo' });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter your username and password.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.session.postLogin(username, password).subscribe({
      next: (homeUrl) => {
        const target = this.session.isApproved() && this.returnUrl() ? this.returnUrl()! : homeUrl;
        void this.router.navigateByUrl(target);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(getErrorMessage(e));
      },
    });
  }
}
