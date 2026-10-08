import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api/api-error';
import { ReportApi, RequestApi } from '../../core/api/contracts';
import { LookupService } from '../../core/data/lookup.service';
import { daysBetween, isOpenStatus, isOverdue } from '../../core/domain/request-rules';
import { STATUS_LABEL, ServiceRequest } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { StatusChip } from '../../shared/status-chip';

type Tab = 'OPEN' | 'OVERDUE' | 'RESOLVED' | 'CLOSED' | 'ALL';
type DateBucket = 'none' | 'week' | 'month';

interface Group {
  key: string;
  label: string;
  items: ServiceRequest[];
  overdue: number;
}

function weekStart(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Wireframe 08 (FR-MNG-002, FR-MNG-003, FR-MNG-004): track, group and export requests. */
@Component({
  selector: 'app-track-page',
  imports: [DatePipe, FormsModule, RouterLink, StatusChip, EmptyState],
  templateUrl: './track-page.html',
  styles: `
    details > summary { cursor: pointer; list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 16px; background: var(--surface-muted); }
    details > summary::-webkit-details-marker { display: none; }
    details[open] > summary { border-bottom: 1.5px solid var(--line); }
    .caret::before { content: '▸'; }
    details[open] .caret::before { content: '▾'; }
  `,
})
export class TrackPage implements OnInit {
  private readonly requestApi = inject(RequestApi);
  private readonly reportApi = inject(ReportApi);
  protected readonly lookup = inject(LookupService);

  /** ?tab=OVERDUE from the dashboard links. */
  readonly tab = input<Tab>();

  protected readonly all = signal<ServiceRequest[]>([]);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly activeTab = signal<Tab>('OPEN');

  protected readonly groupBy = signal({ department: true, category: true, status: false });
  protected readonly dateBucket = signal<DateBucket>('none');
  protected readonly departmentId = signal('');
  protected readonly categoryId = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected exportOptions = { lifecycle: true, comments: true, staffMetrics: false };

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'OPEN', label: 'Open' },
    { id: 'OVERDUE', label: 'Overdue' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'CLOSED', label: 'Closed' },
    { id: 'ALL', label: 'All' },
  ];

  private readonly baseFiltered = computed(() =>
    this.all().filter((r) => {
      if (this.departmentId() && r.departmentId !== this.departmentId()) return false;
      if (this.categoryId() && r.categoryId !== this.categoryId()) return false;
      if (this.from() && r.createdAt.slice(0, 10) < this.from()) return false;
      if (this.to() && r.createdAt.slice(0, 10) > this.to()) return false;
      return true;
    }),
  );

  private matchesTab(r: ServiceRequest, tab: Tab): boolean {
    switch (tab) {
      case 'OPEN':
        return isOpenStatus(r.status);
      case 'OVERDUE':
        return isOverdue(r);
      case 'RESOLVED':
        return r.status === 'RESOLVED';
      case 'CLOSED':
        return r.status === 'CLOSED';
      default:
        return true;
    }
  }

  protected readonly counts = computed(() => {
    const items = this.baseFiltered();
    return Object.fromEntries(this.tabs.map((t) => [t.id, items.filter((r) => this.matchesTab(r, t.id)).length])) as Record<Tab, number>;
  });

  protected readonly filtered = computed(() => this.baseFiltered().filter((r) => this.matchesTab(r, this.activeTab())));

  /** FR-MNG-003: group by any combination of department, category, status and date. */
  protected readonly groups = computed<Group[]>(() => {
    const g = this.groupBy();
    const bucket = this.dateBucket();
    const map = new Map<string, Group>();
    for (const r of this.filtered()) {
      const parts: string[] = [];
      if (g.department) parts.push(this.lookup.getDepartmentName(r.departmentId) === '—' ? 'Not yet routed' : this.lookup.getDepartmentName(r.departmentId));
      if (g.category) parts.push(this.lookup.getCategoryName(r.categoryId));
      if (g.status) parts.push(STATUS_LABEL[r.status]);
      if (bucket === 'week') parts.push(`Week of ${weekStart(r.createdAt)}`);
      if (bucket === 'month') parts.push(r.createdAt.slice(0, 7));
      const label = parts.length ? parts.join(' › ') : 'All requests';
      const group = map.get(label) ?? { key: label, label, items: [], overdue: 0 };
      group.items.push(r);
      if (isOverdue(r)) group.overdue += 1;
      map.set(label, group);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  ngOnInit(): void {
    if (this.tab()) this.activeTab.set(this.tab()!);
    this.requestApi.getRequests().subscribe({
      next: (items) => this.all.set(items),
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }

  protected toggleGroup(key: 'department' | 'category' | 'status', on: boolean): void {
    this.groupBy.update((g) => ({ ...g, [key]: on }));
  }

  protected daysOver(r: ServiceRequest): number {
    return r.dueAt && isOverdue(r) ? Math.floor(daysBetween(r.dueAt, new Date().toISOString())) : 0;
  }

  /** FR-MNG-004: downloads the filtered records as CSV. */
  protected exportCsv(): void {
    const ids = this.filtered().map((r) => r.id);
    if (!ids.length) {
      this.notice.set('Nothing to export with these filters.');
      return;
    }
    this.reportApi.getExport(ids, this.exportOptions).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `civicconnect-requests-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.notice.set(`Exported ${ids.length} requests.`);
      },
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }
}
