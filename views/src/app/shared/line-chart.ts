import { Component, computed, input, signal } from '@angular/core';
import { DashboardData } from '../core/models';

type Day = DashboardData['daily'][number];
type SeriesKey = 'received' | 'resolved';

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 36 };

/** Received vs resolved per day (no chart library). One axis, hover for exact values, a table for screen readers. */
@Component({
  selector: 'app-line-chart',
  template: `
    @if (days().length === 0) {
      <p class="muted">No data for this period.</p>
    } @else {
      <div class="legend" aria-hidden="true">
        @for (s of series; track s.key) {
          <span class="key">
            <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" [attr.stroke]="s.color" stroke-width="2" [attr.stroke-dasharray]="s.dash" /></svg>
            {{ s.label }} <span class="mono">{{ totals()[s.key] }}</span>
          </span>
        }
      </div>
      <div class="plot">
        <svg class="chart" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()"
             (pointermove)="onMove($event)" (pointerleave)="hover.set(null)">
          @for (t of yTicks(); track t.value) {
            <line class="grid" [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="tick" [attr.x]="pad.left - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.value }}</text>
          }
          @for (t of xTicks(); track t.i) {
            <text class="tick" [attr.x]="x(t.i)" [attr.y]="height - 8" text-anchor="middle">{{ t.label }}</text>
          }
          @for (s of series; track s.key) {
            <path [attr.d]="path(s.key)" fill="none" [attr.stroke]="s.color" stroke-width="2"
                  stroke-linejoin="round" stroke-linecap="round" [attr.stroke-dasharray]="s.dash" />
          }
          @if (active(); as a) {
            <line class="cross" [attr.x1]="x(a.i)" [attr.x2]="x(a.i)" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" />
            @for (s of series; track s.key) {
              <circle [attr.cx]="x(a.i)" [attr.cy]="y(a.day[s.key])" r="4" [attr.fill]="s.color" stroke="#fff" stroke-width="2" />
            }
          }
        </svg>
        @if (active(); as a) {
          <div class="tip" [class.flip]="a.i > days().length / 2" [style.left.%]="(x(a.i) / width) * 100">
            <strong>{{ label(a.day.date, true) }}</strong>
            @for (s of series; track s.key) {
              <span>{{ s.label }} <span class="mono">{{ a.day[s.key] }}</span></span>
            }
          </div>
        }
      </div>
      <!-- Wrapped: a table ignores height and overflow, so .sr-only on the table itself leaves it taking up page height -->
      <div class="sr-only">
      <table>
        <caption>Requests received and resolved per day</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Received</th><th scope="col">Resolved</th></tr></thead>
        <tbody>
          @for (d of days(); track d.date) {
            <tr><th scope="row">{{ label(d.date, true) }}</th><td>{{ d.received }}</td><td>{{ d.resolved }}</td></tr>
          }
        </tbody>
      </table>
      </div>
    }
  `,
  styles: `
    .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; }
    .key { display: inline-flex; align-items: center; gap: 6px; }
    .plot { position: relative; }
    .chart { display: block; width: 100%; height: auto; touch-action: pan-y; }
    .grid { stroke: var(--line-soft); stroke-width: 1; }
    .tick { fill: var(--ink-muted); font-size: 11px; font-family: var(--mono); }
    .cross { stroke: var(--line); stroke-width: 1; }
    .tip {
      position: absolute; top: 0; transform: translateX(10px); display: flex; flex-direction: column; gap: 2px;
      background: var(--surface); border: 1.5px solid var(--ink); border-radius: var(--radius);
      padding: 6px 10px; font-size: 13px; white-space: nowrap; pointer-events: none; box-shadow: 0 6px 18px rgba(0, 0, 0, .12);
    }
    .tip.flip { transform: translateX(calc(-100% - 10px)); }
  `,
})
export class LineChart {
  readonly days = input.required<Day[]>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  // Colour-blind-safe pair; "resolved" is also dashed so the lines never rely on colour alone
  protected readonly series: { key: SeriesKey; label: string; color: string; dash: string }[] = [
    { key: 'received', label: 'Received', color: '#6d28d9', dash: '' },
    { key: 'resolved', label: 'Resolved', color: '#c2410c', dash: '6 4' },
  ];
  protected readonly hover = signal<number | null>(null);

  protected readonly active = computed(() => {
    const i = this.hover();
    const day = i === null ? undefined : this.days()[i];
    return i === null || !day ? null : { i, day };
  });
  // Top of the y-axis: a multiple of 4 so the 5 gridlines land on whole numbers
  private readonly top = computed(() => Math.ceil(Math.max(1, ...this.days().flatMap((d) => [d.received, d.resolved])) / 4) * 4);
  protected readonly yTicks = computed(() => [0, 1, 2, 3, 4].map((n) => {
    const value = (this.top() / 4) * n;
    return { value, y: this.y(value) };
  }));
  protected readonly xTicks = computed(() => {
    const every = Math.max(1, Math.ceil(this.days().length / 6));
    return this.days().map((d, i) => ({ i, label: this.label(d.date) })).filter((t) => t.i % every === 0);
  });
  protected readonly totals = computed(() => ({
    received: this.days().reduce((sum, d) => sum + d.received, 0),
    resolved: this.days().reduce((sum, d) => sum + d.resolved, 0),
  }));
  protected readonly summary = computed(() =>
    `${this.totals().received} requests received and ${this.totals().resolved} resolved over ${this.days().length} days`);

  protected x(i: number): number {
    const n = this.days().length;
    const plot = WIDTH - PAD.left - PAD.right;
    return PAD.left + (n <= 1 ? plot / 2 : (i * plot) / (n - 1));
  }

  protected y(value: number): number {
    const plot = HEIGHT - PAD.top - PAD.bottom;
    return PAD.top + plot - (value / this.top()) * plot;
  }

  protected path(key: SeriesKey): string {
    return this.days().map((d, i) => `${i ? 'L' : 'M'}${this.x(i)},${this.y(d[key])}`).join(' ');
  }

  protected label(date: string, long = false): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-ZA', {
      timeZone: 'UTC', day: 'numeric', month: 'short', ...(long ? { weekday: 'short' } : {}),
    });
  }

  protected onMove(event: PointerEvent): void {
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    const n = this.days().length;
    const step = n <= 1 ? 1 : (WIDTH - PAD.left - PAD.right) / (n - 1);
    this.hover.set(Math.min(n - 1, Math.max(0, Math.round((px - PAD.left) / step))));
  }
}
