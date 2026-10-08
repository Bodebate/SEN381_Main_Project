import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api/api-error';
import { RequestApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { LookupService } from '../../core/data/lookup.service';
import { isManagerRole, isOpenStatus, isOverdue } from '../../core/domain/request-rules';
import { PRIORITY_LABEL, Priority, RequestStatus, STATUS_LABEL, STATUS_ORDER, ServiceRequest } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { StatusChip } from '../../shared/status-chip';

type View = 'mine' | 'triage' | 'overdue' | undefined;
type Sort = 'newest' | 'oldest' | 'due' | 'priority';
const PAGE_SIZE = 25;
const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Wireframe 05 (FR-STF-001, FR-STF-002): requests visible to this staff member. */
@Component({
  selector: 'app-staff-queue-page',
  imports: [RouterLink, DatePipe, FormsModule, StatusChip, EmptyState],
  templateUrl: './staff-queue-page.html',
})
export class StaffQueuePage implements OnInit {
  private readonly requestApi = inject(RequestApi);
  private readonly session = inject(SessionService);
  protected readonly lookup = inject(LookupService);

  /** ?view=mine|triage|overdue from the sidebar links. */
  readonly view = input<View>();

  protected readonly statusOptions = STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  protected readonly priorityLabel = PRIORITY_LABEL;
  protected readonly all = signal<ServiceRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  // Filters (FR-STF-002)
  protected readonly search = signal('');
  protected readonly category = signal<string>('ALL');
  protected readonly status = signal<string>('OPEN');
  protected readonly priority = signal<string>('ALL');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly sort = signal<Sort>('newest');
  protected readonly page = signal(0);

  // Grouping
  protected readonly selected = signal<Set<string>>(new Set());
  protected groupTitle = '';
  protected readonly grouping = signal(false);

  protected readonly heading = computed(() => {
    switch (this.view()) {
      case 'mine':
        return 'Assigned to me';
      case 'triage':
        return 'Triage · uncategorised';
      case 'overdue':
        return 'Overdue requests';
      default:
        return 'Request queue';
    }
  });

  protected readonly scopeNote = computed(() =>
    isManagerRole(this.session.user())
      ? 'Showing requests across all departments'
      : 'Showing your department and clearance, plus new requests waiting for triage',
  );

  protected readonly filtered = computed(() => {
    const me = this.session.user()?.id;
    const term = this.search().trim().toLowerCase();
    const items = this.all().filter((r) => {
      if (this.view() === 'mine' && r.assignedTo !== me) return false;
      if (this.view() === 'triage' && r.categoryId !== null) return false;
      if (this.view() === 'overdue' && !isOverdue(r)) return false;
      if (term && !`${r.trackingId} ${r.title} ${r.details} ${r.address}`.toLowerCase().includes(term)) return false;
      if (this.category() === 'NONE' && r.categoryId !== null) return false;
      if (this.category() !== 'ALL' && this.category() !== 'NONE' && r.categoryId !== this.category()) return false;
      if (this.status() === 'OPEN' && !isOpenStatus(r.status)) return false;
      if (this.status() !== 'OPEN' && this.status() !== 'ALL' && r.status !== this.status()) return false;
      if (this.priority() !== 'ALL' && r.priority !== this.priority()) return false;
      if (this.from() && r.createdAt.slice(0, 10) < this.from()) return false;
      if (this.to() && r.createdAt.slice(0, 10) > this.to()) return false;
      return true;
    });
    const byDue = (r: ServiceRequest) => r.dueAt ?? '9999';
    const sorters: Record<Sort, (a: ServiceRequest, b: ServiceRequest) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      due: (a, b) => byDue(a).localeCompare(byDue(b)),
      priority: (a, b) => (a.priority ? PRIORITY_RANK[a.priority] : 3) - (b.priority ? PRIORITY_RANK[b.priority] : 3),
    };
    return [...items].sort(sorters[this.sort()]);
  });

  protected readonly pageItems = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));
  protected readonly rangeEnd = computed(() => Math.min(this.filtered().length, (this.page() + 1) * PAGE_SIZE));

  protected readonly activeFilters = computed(() => {
    const chips: { key: string; label: string }[] = [];
    if (this.search()) chips.push({ key: 'search', label: `Search: “${this.search()}”` });
    if (this.category() !== 'ALL') chips.push({ key: 'category', label: `Category: ${this.category() === 'NONE' ? 'Uncategorised' : this.lookup.getCategoryName(this.category())}` });
    if (this.status() !== 'ALL') chips.push({ key: 'status', label: `Status: ${this.status() === 'OPEN' ? 'Open' : STATUS_LABEL[this.status() as RequestStatus]}` });
    if (this.priority() !== 'ALL') chips.push({ key: 'priority', label: `Priority: ${PRIORITY_LABEL[this.priority() as Priority]}` });
    if (this.from()) chips.push({ key: 'from', label: `From ${this.from()}` });
    if (this.to()) chips.push({ key: 'to', label: `To ${this.to()}` });
    return chips;
  });

  ngOnInit(): void {
    this.getRequests();
  }

  private getRequests(): void {
    this.loading.set(true);
    this.requestApi.getRequests().subscribe({
      next: (items) => {
        this.all.set(items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(getErrorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected isOverdue(r: ServiceRequest): boolean {
    return isOverdue(r);
  }

  protected apply(key: 'search' | 'category' | 'status' | 'priority' | 'from' | 'to', value: string): void {
    ({ search: this.search, category: this.category, status: this.status, priority: this.priority, from: this.from, to: this.to })[key].set(value ?? '');
    this.page.set(0);
  }

  protected clearFilter(key: string): void {
    const reset: Record<string, () => void> = {
      search: () => this.search.set(''),
      category: () => this.category.set('ALL'),
      status: () => this.status.set('ALL'),
      priority: () => this.priority.set('ALL'),
      from: () => this.from.set(''),
      to: () => this.to.set(''),
    };
    reset[key]?.();
    this.page.set(0);
  }

  protected clearAll(): void {
    ['search', 'category', 'status', 'priority', 'from', 'to'].forEach((k) => this.clearFilter(k));
  }

  protected toggle(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.pageItems().map((r) => r.id)) : new Set());
  }

  protected postGroup(): void {
    const ids = [...this.selected()];
    this.requestApi.postGroup(ids, this.groupTitle).subscribe({
      next: (group) => {
        this.notice.set(`Grouped ${ids.length} requests as “${group.title}”.`);
        this.selected.set(new Set());
        this.groupTitle = '';
        this.grouping.set(false);
        this.getRequests();
      },
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }
}
