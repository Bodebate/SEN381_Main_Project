import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getErrorMessage } from '../../core/api/api-error';
import { RequestApi } from '../../core/api/contracts';
import { LookupService } from '../../core/data/lookup.service';
import { isOpenStatus } from '../../core/domain/request-rules';
import { ServiceRequest } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { StatusChip } from '../../shared/status-chip';

type Tab = 'ALL' | 'OPEN' | 'RESOLVED' | 'CLOSED';
const PAGE_SIZE = 10;

/** Wireframe 02 (FR-REQ-004): the requester's own requests, newest first. */
@Component({
  selector: 'app-my-requests-page',
  imports: [RouterLink, DatePipe, StatusChip, EmptyState],
  template: `
    <div class="page">
      <div class="row">
        <h1>My requests</h1>
        <a class="btn primary push" routerLink="/requests/new">+ New request</a>
      </div>

      <div class="row">
        <div class="tabs" role="tablist" aria-label="Filter by status">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab" class="btn" [attr.aria-selected]="tab() === t.id" (click)="setTab(t.id)">
              {{ t.label }} ({{ counts()[t.id] }})
            </button>
          }
        </div>
        <div class="field push search">
          <label class="sr-only" for="search">Search my requests</label>
          <input class="input" id="search" placeholder="Search by tracking ID or title" [value]="search()" (input)="setSearch($any($event.target).value)" />
        </div>
      </div>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      } @else if (loading()) {
        <p class="muted" role="status">Loading your requests…</p>
      } @else if (all().length === 0) {
        <app-empty-state title="You haven't submitted any requests yet." message="Report a problem and we'll keep you updated as it's fixed.">
          <a class="btn primary" routerLink="/requests/new">+ New request</a>
        </app-empty-state>
      } @else if (filtered().length === 0) {
        <app-empty-state title="No requests match." message="Try another status tab or search term." />
      } @else {
        <div class="box flush scroll-x">
          <table class="data">
            <caption class="sr-only">My requests, newest first</caption>
            <thead>
              <tr><th scope="col">Tracking ID</th><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col">Last update</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (r of pageItems(); track r.id) {
                <tr>
                  <td class="mono">{{ r.trackingId }}</td>
                  <td class="wrap">{{ r.title }}</td>
                  <td [class.muted]="!r.categoryId">{{ r.categoryId ? lookup.getCategoryName(r.categoryId) : 'Pending review' }}</td>
                  <td>{{ r.createdAt | date: 'd MMM y' }}</td>
                  <td><app-status-chip [status]="r.status" /></td>
                  <td>{{ r.updatedAt | date: 'd MMM, HH:mm' }}</td>
                  <td><a [routerLink]="['/requests', r.id]">View<span class="sr-only"> {{ r.trackingId }}</span></a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="row">
          <span class="muted">Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ filtered().length }} · newest first</span>
          <div class="row-sm push">
            <button type="button" class="btn small" [disabled]="page() === 0" (click)="page.set(page() - 1)">‹ Prev</button>
            <button type="button" class="btn small" [disabled]="rangeEnd() >= filtered().length" (click)="page.set(page() + 1)">Next ›</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `.search { flex: 1 1 260px; max-width: 380px; }`,
})
export class MyRequestsPage implements OnInit {
  private readonly requestApi = inject(RequestApi);
  protected readonly lookup = inject(LookupService);

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'OPEN', label: 'Open' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'CLOSED', label: 'Closed' },
  ];
  protected readonly all = signal<ServiceRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly tab = signal<Tab>('ALL');
  protected readonly search = signal('');
  protected readonly page = signal(0);

  protected readonly counts = computed(() => {
    const items = this.all();
    return {
      ALL: items.length,
      OPEN: items.filter((r) => isOpenStatus(r.status)).length,
      RESOLVED: items.filter((r) => r.status === 'RESOLVED').length,
      CLOSED: items.filter((r) => r.status === 'CLOSED').length,
    };
  });

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.all()
      .filter((r) => {
        switch (this.tab()) {
          case 'OPEN':
            return isOpenStatus(r.status);
          case 'RESOLVED':
            return r.status === 'RESOLVED';
          case 'CLOSED':
            return r.status === 'CLOSED';
          default:
            return true;
        }
      })
      .filter((r) => !term || r.title.toLowerCase().includes(term) || r.trackingId.toLowerCase().includes(term));
  });

  protected readonly pageItems = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));
  protected readonly rangeStart = computed(() => (this.filtered().length ? this.page() * PAGE_SIZE + 1 : 0));
  protected readonly rangeEnd = computed(() => Math.min(this.filtered().length, (this.page() + 1) * PAGE_SIZE));

  ngOnInit(): void {
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

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.page.set(0);
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
  }
}
