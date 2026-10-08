import { Component, computed, input } from '@angular/core';
import { RequestStatus, STATUS_LABEL } from '../core/models';

/** Status label styled consistently everywhere. */
@Component({
  selector: 'app-status-chip',
  template: `<span class="chip" [class.dark]="status() === 'IN_PROGRESS'" [class.dashed]="status() === 'RESOLVED'" [class.muted]="status() === 'CLOSED'">{{ label() }}</span>`,
})
export class StatusChip {
  readonly status = input.required<RequestStatus>();
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
