import { Component, computed, input } from '@angular/core';

/** Simple accessible horizontal bar chart (no chart library). Values are always shown as text. */
@Component({
  selector: 'app-bar-list',
  template: `
    @if (rows().length === 0) {
      <p class="muted">No data for this period.</p>
    } @else {
      <ul class="bars" role="list">
        @for (row of scaled(); track row.label) {
          <li class="bar-row">
            <span>{{ row.label }}</span>
            <span class="bar-track" aria-hidden="true"><span class="bar-fill" [style.width.%]="row.percent" style="display: block"></span></span>
            <span class="mono">{{ row.count }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `ul { list-style: none; margin: 0; padding: 0; }`,
})
export class BarList {
  readonly rows = input.required<{ label: string; count: number }[]>();
  protected readonly scaled = computed(() => {
    const max = Math.max(1, ...this.rows().map((r) => r.count));
    return this.rows().map((r) => ({ ...r, percent: (r.count / max) * 100 }));
  });
}
