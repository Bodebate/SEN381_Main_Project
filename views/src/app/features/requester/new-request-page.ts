import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api/api-error';
import { RequestApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { ServiceRequest } from '../../core/models';

/**
 * Wireframe 03 (FR-REQ-001). The requester does NOT choose a category: staff set it at triage.
 * Notification channel is read-only here; it comes from the account.
 */
@Component({
  selector: 'app-new-request-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <a routerLink="/requests">‹ My requests</a>
      <h1>Submit a service request</h1>

      <div class="split">
        <div class="main">
          @if (created(); as req) {
            <section class="box strong stack" aria-live="polite">
              <span class="eyebrow">Request submitted</span>
              <h2>Thanks, we've got it.</h2>
              <p>Your tracking ID</p>
              <p class="mono tracking">{{ req.trackingId }}</p>
              <p class="muted small">You'll get an {{ notifyLabel() }} each time its status changes.</p>
              <div class="row">
                <button type="button" class="btn" (click)="copy(req.trackingId)">{{ copied() ? 'Copied' : 'Copy ID' }}</button>
                <a class="btn primary" [routerLink]="['/requests', req.id]">Track it</a>
                <button type="button" class="btn push" (click)="reset()">Submit another</button>
              </div>
            </section>
          } @else {
            <form class="box stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              @if (error()) {
                <div class="alert error" role="alert">{{ error() }}</div>
              }
              <div class="field">
                <label class="label" for="title">Title *</label>
                <input class="input" id="title" formControlName="title" maxlength="100" placeholder="Short summary, e.g. Burst pipe on Main Rd" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <span class="error-text">Add a short title.</span>
                } @else {
                  <span class="hint">{{ form.controls.title.value.length }} / 100 characters</span>
                }
              </div>
              <div class="field">
                <label class="label" for="details">Description *</label>
                <textarea class="input" id="details" formControlName="details" rows="6" maxlength="2000" placeholder="What is the problem? How long has it been happening?"></textarea>
                @if (form.controls.details.touched && form.controls.details.invalid) {
                  <span class="error-text">Describe the problem (at least 10 characters).</span>
                } @else {
                  <span class="hint">{{ form.controls.details.value.length }} / 2000 characters</span>
                }
              </div>
              <div class="field">
                <label class="label" for="address">Location / address *</label>
                <div class="row-sm">
                  <input class="input grow" id="address" formControlName="address" placeholder="Street address or landmark" />
                  <button type="button" class="btn" (click)="useLocation()">Use my location</button>
                </div>
                @if (form.controls.address.touched && form.controls.address.invalid) {
                  <span class="error-text">Tell us where the problem is.</span>
                }
                @if (locationNote()) {
                  <span class="hint" role="status">{{ locationNote() }}</span>
                }
              </div>
              <fieldset class="stack-sm">
                <legend class="label">Contact for this request *</legend>
                <div class="row">
                  <div class="field grow">
                    <label class="label" for="email">Email</label>
                    <input class="input" id="email" type="email" formControlName="email" />
                  </div>
                  <div class="field grow">
                    <label class="label" for="phone">Mobile</label>
                    <input class="input" id="phone" formControlName="phone" placeholder="+27821234567" />
                  </div>
                </div>
                <span class="hint">Pre-filled from your account. Staff may use these to reach you about this request.</span>
              </fieldset>
              <div class="stack-sm">
                <span class="label">Update notifications</span>
                <div class="box soft tight row">
                  <span>Updates on this request go to <strong>{{ notifyName() }}</strong> (your account preference).</span>
                  <a class="push" routerLink="/account">Change in account settings</a>
                </div>
              </div>
              <div class="row">
                <a class="btn" routerLink="/requests">Cancel</a>
                <button type="submit" class="btn primary push" [disabled]="busy()">{{ busy() ? 'Submitting…' : 'Submit request' }}</button>
              </div>
            </form>
          }
        </div>
        <aside class="aside box stack-sm">
          <strong>What happens next</strong>
          <ol class="muted steps">
            <li>You get a tracking ID immediately.</li>
            <li>Staff review it, set the category and assign it to the right team.</li>
            <li>You're notified on every status change.</li>
          </ol>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .grow { flex: 1 1 220px; }
    .tracking { font-size: 22px; font-weight: 600; }
    .steps { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
  `,
})
export class NewRequestPage {
  private readonly requestApi = inject(RequestApi);
  private readonly session = inject(SessionService);
  private readonly fb = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly created = signal<ServiceRequest | null>(null);
  protected readonly copied = signal(false);
  protected readonly locationNote = signal('');
  protected readonly form = this.buildForm();

  protected notifyName(): string {
    return this.session.user()?.notifyVia === 'SMS' ? 'SMS' : 'Email';
  }
  protected notifyLabel(): string {
    return this.session.user()?.notifyVia === 'SMS' ? 'SMS' : 'email';
  }

  private buildForm() {
    const user = this.session.user();
    return this.fb.nonNullable.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      details: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      address: ['', Validators.required],
      email: [user?.email ?? '', Validators.email],
      phone: [user?.phone ?? '', Validators.pattern(/^\+[1-9][0-9]{7,14}$/)],
    });
  }

  protected useLocation(): void {
    if (!('geolocation' in navigator)) {
      this.locationNote.set('Location is not available in this browser. Please type the address.');
      return;
    }
    this.locationNote.set('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.form.controls.address.setValue(`GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        this.locationNote.set('Location added. Add a landmark if you can.');
      },
      () => this.locationNote.set("We couldn't get your location. Please type the address."),
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please fill in the required fields.');
      const firstInvalid = document.querySelector<HTMLElement>('form .ng-invalid:not(form)');
      firstInvalid?.focus();
      return;
    }
    const v = this.form.getRawValue();
    if (!v.email && !v.phone) {
      this.error.set('Add an email address or mobile number so staff can contact you.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.requestApi
      .postRequest({ title: v.title, details: v.details, address: v.address, contact: { email: v.email || null, phone: v.phone || null } })
      .subscribe({
        next: (req) => {
          this.busy.set(false);
          this.created.set(req);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(getErrorMessage(e));
        },
      });
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => this.copied.set(true));
  }

  protected reset(): void {
    this.form.reset();
    this.created.set(null);
    this.copied.set(false);
  }
}
