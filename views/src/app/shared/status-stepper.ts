import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { STATUS_LABEL, STATUS_ORDER, ServiceRequest } from '../core/models';

/** Five-step progress bar (FR-REQ-003). Dates come from the request's status history. */
@Component({
  selector: 'app-status-stepper',
  imports: [DatePipe],
  template: `
    <ol class="steps" aria-label="Request progress">
      @for (step of steps(); track step.status; let i = $index) {
        <li [class.done]="step.reached" [attr.aria-current]="step.current ? 'step' : null">
          <span class="dot" aria-hidden="true">{{ step.reached && !step.current ? '✓' : i + 1 }}</span>
          <strong [class.muted]="!step.reached">{{ step.label }}</strong>
          <span class="small muted">{{ step.at ? (step.at | date: 'd MMM, HH:mm') : '—' }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    li { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .dot { width: 28px; height: 28px; border-radius: 999px; border: 2px solid var(--ink); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: var(--surface); }
    li.done .dot { background: var(--ink); color: #fff; }
    @media (max-width: 520px) { strong { font-size: 12px; } }
  `,
})
export class StatusStepper {
  readonly request = input.required<ServiceRequest>();
  protected readonly steps = computed(() => {
    const r = this.request();
    const currentIndex = STATUS_ORDER.indexOf(r.status);
    return STATUS_ORDER.map((status, i) => ({
      status,
      label: STATUS_LABEL[status],
      reached: i <= currentIndex,
      current: i === currentIndex,
      at: [...r.statusHistory].reverse().find((h) => h.to === status)?.at ?? null,
    }));
  });
}
