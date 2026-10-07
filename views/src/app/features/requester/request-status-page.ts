import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError, getErrorMessage } from '../../core/api/api-error';
import { RequestApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { LookupService } from '../../core/data/lookup.service';
import { STATUS_LABEL, ServiceRequest } from '../../core/models';
import { StatusChip } from '../../shared/status-chip';
import { StatusStepper } from '../../shared/status-stepper';

const REFRESH_MS = 15_000;

interface Update {
  at: string;
  title: string;
  who: string;
  text: string;
  notified: boolean;
}

/** Wireframe 04 (FR-REQ-003): live status of one of the requester's own requests. */
@Component({
  selector: 'app-request-status-page',
  imports: [RouterLink, DatePipe, FormsModule, StatusChip, StatusStepper],
  template: `
    <div class="page">
      <a routerLink="/requests">‹ My requests</a>
      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      } @else if (!request()) {
        <p class="muted" role="status">Loading request…</p>
      } @else {
        @let r = request()!;
        <div class="row">
          <span class="mono strong">{{ r.trackingId }}</span>
          <app-status-chip [status]="r.status" />
          <span class="muted small push" role="status">● Updates automatically</span>
        </div>
        <h1>{{ r.title }}</h1>

        <section class="box" aria-label="Status progress"><app-status-stepper [request]="r" /></section>

        <div class="split">
          <section class="main stack" aria-labelledby="updates-h">
            <h2 id="updates-h">Updates</h2>
            @for (u of updates(); track $index) {
              <article class="box tight stack-sm">
                <div class="row-sm"><strong>{{ u.title }}</strong><span class="small muted push">{{ u.at | date: 'd MMM y, HH:mm' }} · {{ u.who }}</span></div>
                @if (u.text) {
                  <p>“{{ u.text }}”</p>
                }
                @if (u.notified) {
                  <span class="small muted">Notification sent by {{ notifyName() }} ✓</span>
                }
              </article>
            }
            <form class="stack-sm" (ngSubmit)="postComment()">
              <label class="label" for="comment">Add a comment for staff</label>
              <textarea class="input" id="comment" name="comment" rows="3" maxlength="2000" [(ngModel)]="comment" placeholder="Extra details, access instructions…"></textarea>
              @if (commentError()) {
                <span class="error-text" role="alert">{{ commentError() }}</span>
              }
              <div class="row"><button type="submit" class="btn push" [disabled]="busy()">Post comment</button></div>
            </form>
          </section>
          <aside class="aside stack">
            <dl class="box kv">
              <dt>Category</dt>
              <dd>
                @if (r.categoryId) {
                  {{ lookup.getCategoryName(r.categoryId) }} <span class="small muted">(set by staff)</span>
                } @else {
                  <span class="muted">Pending staff review</span>
                }
              </dd>
              <dt>Location</dt><dd>{{ r.address }}</dd>
              <dt>Submitted</dt><dd>{{ r.createdAt | date: 'd MMM y, HH:mm' }}</dd>
              <dt>Notify via</dt><dd>{{ notifyName() }} (account setting) · <a routerLink="/account">account settings</a></dd>
            </dl>
            <div class="box stack-sm">
              <strong>Description</strong>
              <p class="muted">{{ r.details }}</p>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
})
export class RequestStatusPage implements OnInit {
  private readonly requestApi = inject(RequestApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly lookup = inject(LookupService);

  /** Bound from the :id route parameter. */
  readonly id = input.required<string>();

  protected readonly request = signal<ServiceRequest | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly commentError = signal('');
  protected comment = '';

  protected readonly updates = computed<Update[]>(() => {
    const r = this.request();
    if (!r) return [];
    const me = this.session.user()?.id;
    // Requesters see "Maintenance staff" rather than individual staff names.
    const who = (id: string) => (id === me ? 'You' : r.requesterIds.includes(id) ? 'Another requester' : 'Maintenance staff');
    const history: Update[] = r.statusHistory.map((h) => ({
      at: h.at,
      title: h.from ? `Status → ${STATUS_LABEL[h.to]}` : 'Request submitted',
      who: who(h.by),
      text: h.notifyRequester ? h.comment : '',
      notified: !!h.from,
    }));
    const comments: Update[] = r.notes
      .filter((n) => n.visibility === 'PUBLIC')
      .map((n) => ({ at: n.date, title: n.userId === me ? 'You added a comment' : 'Comment', who: who(n.userId), text: n.details, notified: false }));
    return [...history, ...comments].sort((a, b) => b.at.localeCompare(a.at));
  });

  protected notifyName(): string {
    return this.session.user()?.notifyVia === 'SMS' ? 'SMS' : 'Email';
  }

  constructor() {
    // FR-REQ-003: keep the status current. Replace with WebSocket/SSE when the API supports it.
    const timer = setInterval(() => this.getRequest(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit(): void {
    this.getRequest();
  }

  private getRequest(): void {
    this.requestApi.getRequest(this.id()).subscribe({
      next: (r) => this.request.set(r),
      error: (e) => {
        if (e instanceof ApiError && e.status === 403) void this.router.navigate(['/403']);
        else this.error.set(getErrorMessage(e));
      },
    });
  }

  protected postComment(): void {
    if (!this.comment.trim()) {
      this.commentError.set('Write a comment first.');
      return;
    }
    this.busy.set(true);
    this.commentError.set('');
    this.requestApi.postComment(this.id(), this.comment).subscribe({
      next: (r) => {
        this.request.set(r);
        this.comment = '';
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.commentError.set(getErrorMessage(e));
      },
    });
  }
}
