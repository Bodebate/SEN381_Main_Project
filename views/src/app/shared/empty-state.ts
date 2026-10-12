import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="box dashed empty">
      <strong>{{ title() }}</strong>
      @if (message()) {
        <p class="muted">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `.empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }`,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input<string>('');
}
