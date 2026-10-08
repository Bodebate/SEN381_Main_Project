import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kpi-tile',
  template: `
    <div class="box kpi" [class.alert-tile]="emphasis()">
      <span class="muted">{{ label() }}</span>
      <span class="value mono">{{ value() }}</span>
      <span class="small muted"><ng-content /></span>
    </div>
  `,
  styles: `
    .kpi { display: flex; flex-direction: column; gap: 6px; padding: 18px; height: 100%; }
    .value { font-size: 30px; font-weight: 700; }
    .alert-tile { border: 2px solid var(--danger); }
  `,
})
export class KpiTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly emphasis = input(false);
}
