import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DashboardData, ExportOptions, OUTCOME_LABEL, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '../../models';
import { daysBetween, isManagerRole, isOpenStatus, isOverdue } from '../../domain/request-rules';
import { ApiError } from '../api-error';
import { ReportApi } from '../contracts';
import { MockDb } from './mock-db';

function average(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Injectable()
export class MockReportApi extends ReportApi {
  private readonly db = inject(MockDb);

  private requireManager(): void {
    if (!isManagerRole(this.db.currentUser())) throw new ApiError(403, 'Only managers can view reports.');
  }

  override getDashboard(fromIso: string, toIso: string, departmentId: string | null): Observable<DashboardData> {
    return this.db.respond((): DashboardData => {
      this.requireManager();
      const all = this.db.requests.filter((r) => !departmentId || r.departmentId === departmentId);
      const inPeriod = (iso: string | null) => !!iso && iso >= fromIso && iso <= toIso;
      const received = all.filter((r) => inPeriod(r.createdAt));
      const resolved = all.filter((r) => inPeriod(r.resolvedAt));
      const open = all.filter((r) => isOpenStatus(r.status));
      const nameOfCategory = (id: string | null) => this.db.categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
      const nameOfDepartment = (id: string | null) => this.db.departments.find((d) => d.id === id)?.name ?? 'Not yet routed';
      const countBy = <K extends string>(items: typeof all, key: (r: (typeof all)[number]) => K) => {
        const map = new Map<K, number>();
        items.forEach((r) => map.set(key(r), (map.get(key(r)) ?? 0) + 1));
        return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
      };
      const staff = this.db.users
        .filter((u) => u.role === 'STAFF' && (!departmentId || u.departmentId === departmentId))
        .map((u) => {
          const mine = all.filter((r) => r.assignedTo === u.id);
          const done = mine.filter((r) => r.resolvedAt && inPeriod(r.resolvedAt));
          return {
            name: `${u.firstName} ${u.lastName}`,
            department: nameOfDepartment(u.departmentId),
            openAssigned: mine.filter((r) => isOpenStatus(r.status)).length,
            resolved: done.length,
            avgResolveDays: average(done.map((r) => daysBetween(r.createdAt, r.resolvedAt!))),
            overdue: mine.filter((r) => isOverdue(r)).length,
          };
        });
      return {
        activeCount: open.length,
        overdueCount: all.filter((r) => isOverdue(r)).length,
        resolvedInPeriod: resolved.length,
        receivedInPeriod: received.length,
        resolutionRate: received.length ? Math.round((resolved.length / received.length) * 100) : 0,
        avgResolveDays: average(resolved.map((r) => daysBetween(r.createdAt, r.resolvedAt!))),
        byStatus: STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], count: all.filter((r) => r.status === s).length })),
        byCategory: countBy(open, (r) => nameOfCategory(r.categoryId)),
        byDepartment: countBy(open, (r) => nameOfDepartment(r.departmentId)).map((d) => ({
          ...d,
          overdue: open.filter((r) => nameOfDepartment(r.departmentId) === d.label && isOverdue(r)).length,
        })),
        staff,
      };
    });
  }

  override getExport(requestIds: string[], options: ExportOptions): Observable<Blob> {
    return this.db.respond(() => {
      this.requireManager();
      const nameOf = (id: string | null) => {
        const u = this.db.users.find((x) => x.id === id);
        return u ? `${u.firstName} ${u.lastName}` : '';
      };
      const header = ['Tracking ID', 'Title', 'Status', 'Priority', 'Category', 'Department', 'Owner', 'Submitted', 'Due', 'Resolved', 'Outcome', 'Closed', 'Overdue'];
      if (options.lifecycle) header.push('Lifecycle');
      if (options.comments) header.push('Comments');
      const rows = this.db.requests
        .filter((r) => requestIds.includes(r.id))
        .map((r) => {
          const row: unknown[] = [
            r.trackingId,
            r.title,
            STATUS_LABEL[r.status],
            r.priority ? PRIORITY_LABEL[r.priority] : '',
            this.db.categories.find((c) => c.id === r.categoryId)?.name ?? 'Uncategorised',
            this.db.departments.find((d) => d.id === r.departmentId)?.name ?? '',
            nameOf(r.assignedTo),
            r.createdAt,
            r.dueAt ?? '',
            r.resolvedAt ?? '',
            r.resolutionOutcome ? OUTCOME_LABEL[r.resolutionOutcome] : '',
            r.closedAt ?? '',
            isOverdue(r) ? 'Yes' : 'No',
          ];
          if (options.lifecycle) {
            row.push(r.statusHistory.map((h) => `${h.at} ${h.from ?? 'NEW'}->${h.to} by ${nameOf(h.by)}: ${h.comment}`).join(' | '));
          }
          if (options.comments) {
            // POPI Act: requester contact details are not exported. [confirm]
            row.push(r.notes.map((n) => `${n.date} ${nameOf(n.userId)} (${n.type}): ${n.details}`).join(' | '));
          }
          return row.map(csvCell).join(',');
        });
      return [header.map(csvCell).join(','), ...rows].join('\n');
    }).pipe(map((csv) => new Blob([csv], { type: 'text/csv;charset=utf-8' })));
  }
}
