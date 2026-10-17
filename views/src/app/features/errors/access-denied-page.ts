import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';

/** FR-STF-001 / NFR-SEC-001: shown when a user opens something outside their role or department. */
@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <section class="box stack card">
      <span class="eyebrow">Error 403</span>
      <h1>Access denied</h1>
      <p class="muted">You don't have permission to view this page or request. It may belong to another department or role.</p>
      <a class="btn primary" [routerLink]="home()">Go to my home page</a>
    </section>
  `,
  styles: `.card { width: 100%; max-width: 440px; padding: 32px; }`,
})
export class AccessDeniedPage {
  private readonly session = inject(SessionService);
  protected home(): string {
    return this.session.getHomeUrl();
  }
}
