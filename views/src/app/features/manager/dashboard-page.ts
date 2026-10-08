import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { getErrorMessage } from '../../core/api/api-error';
import { ReportApi, RequestApi } from '../../core/api/contracts';
import { LookupService } from '../../core/data/lookup.service';
import { daysBetween, isOverdue } from '../../core/domain/request-rules';
import { DashboardData, ServiceRequest } from '../../core/models';
import { BarList } from '../../shared/bar-list';
import { KpiTile } from '../../shared/kpi-tile';

/** Wireframe 07 (FR-MNG-001): service activity summary. Updates on refresh. */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, FormsModule, RouterLink, KpiTile, BarList],
  template: `
    <div class="page">
      <div class="row">
        <h1>Service activity</h1>
        <div class="row-sm push">
          <label class="sr-only" for="range">Date range</label>
          <select class="input" id="range" style="width: 160px" [ngModel]="rangeDays()" (ngModelChange)="rangeDays.set(+$event); getData()">
            <option [value]="7">Last 7 days</option>
            <option [value]="30">Last 30 days</option>
            <option [value]="90">Last 90 days</option>
          </select>
          <label class="sr-only" for="dept">Department</label>
          <select class="input" id="dept" style="width: 180px" [ngModel]="departmentId()" (ngModelChange)="departmentId.set($event); getData()">
            <option value="">All departments</option>
            @for (d of lookup.departments(); track d.id) {
              <option [value]="d.id">{{ d.name }}</option>
            }
          </select>
          <button type="button" class="btn" (click)="getData()">↻ Refresh</button>
        </div>
      </div>
      <span class="small muted" role="status">Last updated {{ updatedAt() | date: 'd MMM y, HH:mm:ss' }}</span>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }
      @if (data(); as d) {
        <div class="grid-auto">
          <app-kpi-tile label="Active requests" [value]="d.activeCount">Submitted → In progress</app-kpi-tile>
          <app-kpi-tile label="Overdue" [value]="d.overdueCount" [emphasis]="d.overdueCount > 0"><a routerLink="/manage/track" [queryParams]="{ tab: 'OVERDUE' }">View overdue →</a></app-kpi-tile>
          <app-kpi-tile label="Resolved (period)" [value]="d.resolvedInPeriod">of {{ d.receivedInPeriod }} received</app-kpi-tile>
          <app-kpi-tile label="Resolution rate" [value]="d.resolutionRate + '%'">resolved ÷ received</app-kpi-tile>
          <app-kpi-tile label="Avg. time to resolve" [value]="d.avgResolveDays === null ? '—' : d.avgResolveDays + 'd'">submitted → resolved</app-kpi-tile>
        </div>

        <div class="grid-wide">
          <section class="box stack-sm"><h2>Requests by status</h2><app-bar-list [rows]="d.byStatus" /></section>
          <section class="box stack-sm">
            <h2>Received vs resolved over time</h2>
            <div class="placeholder">Line chart placeholder. Add a chart library once the real API supplies daily counts.</div>
          </section>
          <section class="box stack-sm"><h2>Open backlog by category</h2><app-bar-list [rows]="d.byCategory" /></section>
          <section class="box stack-sm"><h2>Open backlog by department</h2><app-bar-list [rows]="d.byDepartment" /></section>
        </div>

        <section class="stack-sm">
          <h2>Staff performance</h2>
          <div class="box flush scroll-x">
            <table class="data">
              <thead><tr><th scope="col">Staff member</th><th scope="col">Department</th><th scope="col">Open assigned</th><th scope="col">Resolved (period)</th><th scope="col">Avg. resolve time</th><th scope="col">Overdue</th></tr></thead>
              <tbody>
                @for (s of d.staff; track s.name) {
                  <tr>
                    <td>{{ s.name }}</td><td>{{ s.department }}</td><td class="mono">{{ s.openAssigned }}</td><td class="mono">{{ s.resolved }}</td>
                    <td class="mono">{{ s.avgResolveDays === null ? '—' : s.avgResolveDays + 'd' }}</td><td class="mono">{{ s.overdue }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <section class="stack-sm">
        <div class="row"><h2>Most overdue</h2><a class="push" routerLink="/manage/track" [queryParams]="{ tab: 'OVERDUE' }">See all</a></div>
        @if (mostOverdue().length === 0) {
          <p class="muted">Nothing is overdue.</p>
        } @else {
          <div class="box flush scroll-x">
            <table class="data">
              <thead><tr><th scope="col">ID</th><th scope="col">Title</th><th scope="col">Department</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Days over</th></tr></thead>
              <tbody>
                @for (o of mostOverdue(); track o.request.id) {
                  <tr>
                    <td class="mono"><a [routerLink]="['/staff/requests', o.request.id]">{{ o.request.trackingId }}</a></td>
                    <td class="wrap">{{ o.request.title }}</td>
                    <td>{{ lookup.getDepartmentName(o.request.departmentId) }}</td>
                    <td>{{ lookup.getUserName(o.request.assignedTo) }}</td>
                    <td>{{ o.request.dueAt | date: 'd MMM' }}</td>
                    <td><span class="badge-overdue">{{ o.days }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private readonly reportApi = inject(ReportApi);
  private readonly requestApi = inject(RequestApi);
  protected readonly lookup = inject(LookupService);

  protected readonly rangeDays = signal(30);
  protected readonly departmentId = signal('');
  protected readonly data = signal<DashboardData | null>(null);
  protected readonly requests = signal<ServiceRequest[]>([]);
  protected readonly updatedAt = signal(new Date());
  protected readonly error = signal('');

  protected readonly mostOverdue = computed(() => {
    const now = new Date().toISOString();
    return this.requests()
      .filter((r) => isOverdue(r) && (!this.departmentId() || r.departmentId === this.departmentId()))
      .map((r) => ({ request: r, days: Math.floor(daysBetween(r.dueAt!, now)) }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.getData();
  }

  protected getData(): void {
    const to = new Date();
    const from = new Date(to.getTime() - this.rangeDays() * 86_400_000);
    forkJoin({
      dashboard: this.reportApi.getDashboard(from.toISOString(), to.toISOString(), this.departmentId() || null),
      requests: this.requestApi.getRequests(),
    }).subscribe({
      next: ({ dashboard, requests }) => {
        this.data.set(dashboard);
        this.requests.set(requests);
        this.updatedAt.set(new Date());
        this.error.set('');
      },
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }
}
