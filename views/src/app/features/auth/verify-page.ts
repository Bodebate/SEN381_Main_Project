import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { getErrorMessage } from '../../core/api/api-error';
import { SessionService } from '../../core/auth/session.service';

/**
 * Wireframe 01 step 2, moved to sign-up: the 2FA code is entered ONCE after registering.
 * Entering it marks the account verified; it then waits for manager approval.
 */
@Component({
  selector: 'app-verify-page',
  imports: [ReactiveFormsModule],
  template: `
    <form class="box stack card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <span class="eyebrow">Step 2 of 2 · Verify your account</span>
      <h1>Enter your security code</h1>
      <p class="muted">We sent a 6-digit code to <strong class="ink">{{ sentTo() }}</strong>. You only need to do this once.</p>
      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }
      @if (notice()) {
        <div class="alert success" role="status">{{ notice() }}</div>
      }
      <div class="field">
        <label class="label" for="code">6-digit code</label>
        <input class="input code" id="code" formControlName="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" />
        @if (showDemo) {
          <span class="hint">Demo: any 6 digits work.</span>
        }
      </div>
      <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Verify account' }}</button>
      <div class="row small">
        <button type="button" class="link-btn" (click)="resend()" [disabled]="cooldown() > 0">
          {{ cooldown() > 0 ? 'Resend code (' + cooldown() + 's)' : 'Resend code' }}
        </button>
        <button type="button" class="link-btn push" (click)="startOver()">Use a different account</button>
      </div>
    </form>
  `,
  styles: `
    .card { width: 100%; max-width: 440px; padding: 32px; }
    .code { font-family: var(--mono); font-size: 22px; letter-spacing: .4em; text-align: center; }
    .ink { color: var(--ink); }
  `,
})
export class VerifyPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly showDemo = environment.useMockApi;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly cooldown = signal(30);
  protected readonly sentTo = computed(() => this.session.pendingVerification()?.sentTo ?? 'your email or mobile number');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    const timer = setInterval(() => this.cooldown.update((s) => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set('Enter the 6-digit code.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.session.postVerification(this.form.getRawValue().code).subscribe({
      next: (url) => void this.router.navigateByUrl(url),
      error: (e) => {
        this.busy.set(false);
        this.error.set(getErrorMessage(e));
      },
    });
  }

  protected resend(): void {
    this.session.postResendCode().subscribe({
      next: (r) => {
        this.notice.set(`A new code was sent to ${r.sentTo}.`);
        this.cooldown.set(30);
      },
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }

  protected startOver(): void {
    this.session.logout().subscribe({ complete: () => void this.router.navigate(['/register']), error: () => void this.router.navigate(['/register']) });
  }
}
