import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <section class="box stack card">
        <span class="eyebrow">Error 404</span>
        <h1>Page not found</h1>
        <p class="muted">The page you were looking for doesn't exist or has moved.</p>
        <a class="btn primary" routerLink="/">Go to my home page</a>
      </section>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; background: var(--surface-muted); display: flex; justify-content: center; align-items: flex-start; padding: 64px 16px; }
    .card { width: 100%; max-width: 440px; padding: 32px; }
  `,
})
export class NotFoundPage {}
