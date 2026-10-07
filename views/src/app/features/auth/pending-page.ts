import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';

/** Wireframe 10, right panel. Verified accounts wait here until a manager approves them. */
@Component({
  selector: 'app-pending-page',
  template: `
    <section class="box strong stack card" aria-labelledby="pending-title">
      <span class="eyebrow">Account status</span>
      <h1 id="pending-title">Account waiting for approval</h1>
      <p>Your account is verified. A manager will review it and set your access.</p>
      <dl class="box soft kv">
        <dt>Username</dt><dd class="mono">{{ user()?.username }}</dd>
        <dt>Role</dt><dd>None yet</dd>
        <dt>Clearance</dt><dd class="mono">{{ user()?.clearance }}</dd>
        <dt>Status</dt><dd>Pending approval</dd>
      </dl>
      <p class="muted small">You'll get an email or SMS when it's approved or declined. Until then you can't submit or view requests.</p>
      @if (stillPending()) {
        <p class="small muted" role="status">Still pending. Check again later.</p>
      }
      <div class="row">
        <button type="button" class="btn" (click)="checkAgain()">Check again</button>
        <button type="button" class="btn push" (click)="signOut()">Sign out</button>
      </div>
    </section>
  `,
  styles: `.card { width: 100%; max-width: 460px; padding: 32px; }`,
})
export class PendingPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly user = this.session.user;
  protected readonly stillPending = signal(false);

  protected async checkAgain(): Promise<void> {
    await this.session.restore();
    const url = this.session.getHomeUrl();
    if (url === '/pending') this.stillPending.set(true);
    else void this.router.navigateByUrl(url);
  }

  protected signOut(): void {
    this.session.logout().subscribe({ complete: () => void this.router.navigate(['/login']), error: () => void this.router.navigate(['/login']) });
  }
}
