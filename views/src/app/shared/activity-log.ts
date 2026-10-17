import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { LookupService } from '../core/data/lookup.service';
import { STATUS_LABEL, ServiceRequest } from '../core/models';

export interface ActivityEntry {
  at: string;
  who: string;
  action: string;
  comment: string;
}

/** Read-only log of status changes and notes, newest first (FR-STF-006). Staff view. */
@Component({
  selector: 'app-activity-log',
  imports: [DatePipe],
  template: `
    <div class="box flush scroll-x">
      <table class="data">
        <caption class="sr-only">Activity log</caption>
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Comment</th></tr></thead>
        <tbody>
          @for (entry of entries(); track $index) {
            <tr>
              <td>{{ entry.at | date: 'd MMM HH:mm' }}</td>
              <td>{{ entry.who }}</td>
              <td class="wrap">{{ entry.action }}</td>
              <td class="wrap">{{ entry.comment }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ActivityLog {
  private readonly lookup = inject(LookupService);
  readonly request = input.required<ServiceRequest>();

  protected readonly entries = computed<ActivityEntry[]>(() => {
    const r = this.request();
    const requesters = new Set(r.requesterIds);
    const who = (id: string) => `${this.lookup.getUserName(id)}${requesters.has(id) ? ' (requester)' : ''}`;
    const fromHistory = r.statusHistory.map((h) => ({
      at: h.at,
      who: who(h.by),
      action: h.from ? `${STATUS_LABEL[h.from]} → ${STATUS_LABEL[h.to]}` : 'Submitted',
      comment: h.comment,
    }));
    const noteLabel = { WORK: 'Work note', COMMENT: 'Comment', ASSIGNMENT: 'Assignment', SYSTEM: 'Change' } as const;
    const fromNotes = r.notes.map((n) => ({ at: n.date, who: who(n.userId), action: noteLabel[n.type], comment: n.details }));
    return [...fromHistory, ...fromNotes].sort((a, b) => b.at.localeCompare(a.at));
  });
}
