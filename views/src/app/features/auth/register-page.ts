import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api/api-error';
import { SessionService } from '../../core/auth/session.service';

const E164 = /^\+[1-9][0-9]{7,14}$/;

function contactRequired(group: AbstractControl): ValidationErrors | null {
  const { email, phone, notifyVia } = group.value as { email: string; phone: string; notifyVia: string };
  if (!email && !phone) return { contact: 'Enter an email address or a mobile number.' };
  if (notifyVia === 'EMAIL' && !email) return { contact: 'Add an email address to get updates by email.' };
  if (notifyVia === 'SMS' && !phone) return { contact: 'Add a mobile number to get updates by SMS.' };
  return null;
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/** Wireframe 10. Creates an account with no role; a code is sent next (2FA, once). */
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <form class="box stack card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h1>Create an account</h1>
      <p class="muted small">After you confirm your contact details, a manager reviews your account and sets your access.</p>
      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }
      <div class="row">
        <div class="field grow">
          <label class="label" for="firstName">First name *</label>
          <input class="input" id="firstName" formControlName="firstName" autocomplete="given-name" />
        </div>
        <div class="field grow">
          <label class="label" for="lastName">Last name *</label>
          <input class="input" id="lastName" formControlName="lastName" autocomplete="family-name" />
        </div>
      </div>
      <div class="field">
        <label class="label" for="username">Username *</label>
        <input class="input" id="username" formControlName="username" autocomplete="username" />
      </div>
      <div class="field">
        <label class="label" for="email">Email</label>
        <input class="input" id="email" type="email" formControlName="email" autocomplete="email" placeholder="name@example.com" />
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <span class="error-text">Enter a valid email address.</span>
        }
      </div>
      <div class="field">
        <label class="label" for="phone">Mobile number</label>
        <input class="input" id="phone" formControlName="phone" autocomplete="tel" placeholder="+27821234567" />
        @if (form.controls.phone.touched && form.controls.phone.invalid) {
          <span class="error-text">Use international format, e.g. +27821234567.</span>
        }
        <span class="hint">At least one of email or mobile is needed. We send your sign-up code there.</span>
      </div>
      <fieldset class="stack-sm">
        <legend class="label">Send request updates by *</legend>
        <div class="row">
          <label class="check"><input type="radio" formControlName="notifyVia" value="EMAIL" /> Email</label>
          <label class="check"><input type="radio" formControlName="notifyVia" value="SMS" /> SMS</label>
        </div>
        <span class="hint">Saved on your account; you can change it later in account settings.</span>
      </fieldset>
      @if (form.touched && form.errors?.['contact']) {
        <span class="error-text">{{ form.errors?.['contact'] }}</span>
      }
      <div class="row">
        <div class="field grow">
          <label class="label" for="password">Password *</label>
          <input class="input" id="password" type="password" formControlName="password" autocomplete="new-password" />
          <span class="hint">At least 8 characters.</span>
        </div>
        <div class="field grow">
          <label class="label" for="confirm">Confirm password *</label>
          <input class="input" id="confirm" type="password" formControlName="confirm" autocomplete="new-password" />
          @if (form.controls.confirm.touched && form.errors?.['mismatch']) {
            <span class="error-text">Passwords don't match.</span>
          }
        </div>
      </div>
      <label class="check small">
        <input type="checkbox" formControlName="consent" />
        I agree that my contact details are stored and used only to process my requests and send updates (POPI Act).
      </label>
      <button type="submit" class="btn primary" [disabled]="busy()">{{ busy() ? 'Creating account…' : 'Create account' }}</button>
      <p class="small">Already have an account? <a routerLink="/login">Sign in</a></p>
    </form>
  `,
  styles: `
    .card { width: 100%; max-width: 520px; padding: 32px; }
    .grow { flex: 1 1 180px; }
  `,
})
export class RegisterPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', Validators.email],
      phone: ['', Validators.pattern(E164)],
      notifyVia: ['EMAIL' as 'EMAIL' | 'SMS', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
      consent: [false, Validators.requiredTrue],
    },
    { validators: [contactRequired, passwordsMatch] },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.form.controls.consent.invalid ? 'Please accept the data consent to continue.' : 'Please fix the highlighted fields.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    this.session
      .postRegistration({
        firstName: v.firstName,
        lastName: v.lastName,
        username: v.username,
        email: v.email || null,
        phone: v.phone || null,
        notifyVia: v.notifyVia,
        password: v.password,
      })
      .subscribe({
        next: () => void this.router.navigate(['/register/verify']),
        error: (e) => {
          this.busy.set(false);
          this.error.set(getErrorMessage(e));
        },
      });
  }
}
