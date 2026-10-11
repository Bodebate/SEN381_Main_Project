import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/** Frame for signed-out pages: sign in, register, verify, pending, access denied. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="public">
      <header class="public-header">
        <a routerLink="/" class="brand"><span class="logo" aria-hidden="true"></span>CivicConnect</a>
      </header>
      <main id="main" class="public-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .public { min-height: 100vh; background: var(--surface-muted); display: flex; flex-direction: column; }
    .public-header { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1.5px solid var(--ink); background: var(--surface); }
    .public-main { flex: 1; display: flex; justify-content: center; align-items: flex-start; padding: 48px 16px; }
  `,
})
export class PublicLayout {}
