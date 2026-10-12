import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiError, getErrorMessage } from '../../core/api/api-error';
import { RequestApi, UserApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { LookupService } from '../../core/data/lookup.service';
import { getNextStatus, isOverdue, validateCanResolveOrClose } from '../../core/domain/request-rules';
import {
  OUTCOME_LABEL,
  PRIORITY_LABEL,
  Priority,
  RequestGroup,
  ResolutionOutcome,
  STATUS_LABEL,
  STATUS_ORDER,
  ServiceRequest,
  User,
} from '../../core/models';
import { ActivityLog } from '../../shared/activity-log';
import { StatusChip } from '../../shared/status-chip';

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
function fromDateInput(value: string): string {
  return new Date(`${value}T17:00:00`).toISOString();
}

/**
 * Wireframe 06: full request detail for staff.
 * FR-STF-003 (details), FR-STF-004 (triage/assignment), FR-STF-005/006/007 (status changes), FR-MNG-002 (due date).
 */
@Component({
  selector: 'app-staff-request-page',
  imports: [RouterLink, DatePipe, FormsModule, StatusChip, ActivityLog],
  templateUrl: './staff-request-page.html',
})
export class StaffRequestPage implements OnInit {
  private readonly requestApi = inject(RequestApi);
  private readonly userApi = inject(UserApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly lookup = inject(LookupService);

  readonly id = input.required<string>();

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly priorityLabel = PRIORITY_LABEL;
  protected readonly outcomes = Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value: value as ResolutionOutcome, label }));
  protected readonly request = signal<ServiceRequest | null>(null);
  protected readonly groups = signal<RequestGroup[]>([]);
  protected readonly staffOptions = signal<User[]>([]);
  protected readonly loadError = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);

  // Triage form
  protected triage = { categoryId: '', assigneeId: '', dueDate: '', priority: 'MEDIUM' as Priority, comment: '' };
  // Other forms
  protected reassignTo = '';
  protected due = { date: '', reason: '' };
  protected categoryChange = { open: false, categoryId: '', reason: '' };
  protected note = { details: '', applyToGroup: false };
  protected statusForm = { comment: '', notify: true, outcome: 'FIXED' as ResolutionOutcome };

  protected readonly overdue = computed(() => {
    const r = this.request();
    return !!r && isOverdue(r);
  });
  protected readonly nextStatus = computed(() => {
    const r = this.request();
    return r && r.status !== 'SUBMITTED' ? getNextStatus(r.status) : null;
  });
  protected readonly canFinish = computed(() => {
    const r = this.request();
    return !!r && validateCanResolveOrClose(this.session.user(), r);
  });
  protected readonly nextAllowed = computed(() => {
    const next = this.nextStatus();
    if (!next) return false;
    return next === 'RESOLVED' || next === 'CLOSED' ? this.canFinish() : true;
  });
  protected readonly statusButtons = computed(() => {
    const r = this.request();
    const next = this.nextStatus();
    return STATUS_ORDER.map((s) => ({ status: s, label: STATUS_LABEL[s], isNext: s === next, isCurrent: s === r?.status }));
  });
  protected readonly groupTitle = computed(() => {
    const r = this.request();
    return r?.groupId ? (this.groups().find((g) => g.id === r.groupId)?.title ?? 'Group') : null;
  });

  ngOnInit(): void {
    this.getRequest();
    this.requestApi.getGroups().subscribe({ next: (g) => this.groups.set(g) });
  }

  private getRequest(): void {
    this.requestApi.getRequest(this.id()).subscribe({
      next: (r) => this.setRequest(r),
      error: (e) => {
        if (e instanceof ApiError && e.status === 403) void this.router.navigate(['/403']);
        else this.loadError.set(getErrorMessage(e));
      },
    });
  }

  private setRequest(r: ServiceRequest): void {
    this.request.set(r);
    this.due = { date: toDateInput(r.dueAt), reason: '' };
    this.reassignTo = r.assignedTo ?? '';
    this.categoryChange = { open: false, categoryId: r.categoryId ?? '', reason: '' };
    this.getStaffOptions(r.departmentId);
  }

  private getStaffOptions(departmentId: string | null): void {
    this.userApi.getAssignableStaff(departmentId).subscribe({ next: (staff) => this.staffOptions.set(staff) });
  }

  /** Triage: choosing a category suggests a due date from its SLA and lists that department's staff. */
  protected onTriageCategory(categoryId: string): void {
    this.triage.categoryId = categoryId;
    const category = this.lookup.getCategory(categoryId);
    if (!category) return;
    const suggested = new Date(Date.now() + category.slaDays * 86_400_000).toISOString();
    this.triage.dueDate = toDateInput(suggested);
    const me = this.session.user();
    this.triage.assigneeId = me?.role === 'STAFF' && me.departmentId === category.departmentId ? me.id : '';
    this.getStaffOptions(category.departmentId);
  }

  /** Runs an API action, then refreshes the page state and shows a confirmation. */
  private run(action: Observable<ServiceRequest>, message: string): void {
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    action.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.setRequest(r);
        this.notice.set(message);
      },
      error: (e) => {
        this.busy.set(false);
        this.actionError.set(getErrorMessage(e));
      },
    });
  }

  protected submitTriage(): void {
    const t = this.triage;
    if (!t.categoryId || !t.assigneeId || !t.dueDate || !t.comment.trim()) {
      this.actionError.set('Triage needs a category, an owner, a due date and a comment.');
      return;
    }
    this.run(
      this.requestApi.updateTriage(this.id(), { categoryId: t.categoryId, assigneeId: t.assigneeId, dueAt: fromDateInput(t.dueDate), priority: t.priority, comment: t.comment }),
      'Categorised and assigned. The requester has been notified.',
    );
  }

  protected submitReassign(): void {
    if (!this.reassignTo || this.reassignTo === this.request()?.assignedTo) {
      this.actionError.set('Choose a different team member.');
      return;
    }
    this.run(this.requestApi.updateAssignee(this.id(), this.reassignTo), 'Owner updated.');
  }

  protected submitDueDate(): void {
    if (!this.due.date || !this.due.reason.trim()) {
      this.actionError.set('Choose a new due date and give a reason.');
      return;
    }
    this.run(this.requestApi.updateDueDate(this.id(), fromDateInput(this.due.date), this.due.reason), 'Due date updated.');
  }

  protected submitCategory(): void {
    if (!this.categoryChange.categoryId || !this.categoryChange.reason.trim()) {
      this.actionError.set('Choose a category and give a reason.');
      return;
    }
    this.run(this.requestApi.updateCategory(this.id(), this.categoryChange.categoryId, this.categoryChange.reason), 'Category updated.');
  }

  protected submitNote(): void {
    if (!this.note.details.trim()) {
      this.actionError.set('Write the note first.');
      return;
    }
    const toGroup = this.note.applyToGroup;
    this.run(this.requestApi.postNote(this.id(), this.note.details, toGroup), toGroup ? 'Note added to every request in the group.' : 'Note saved.');
    this.note = { details: '', applyToGroup: false };
  }

  protected submitStatus(): void {
    const next = this.nextStatus();
    if (!next || !this.nextAllowed()) return;
    if (!this.statusForm.comment.trim()) {
      this.actionError.set('A comment is required for every status change (FR-STF-006).');
      return;
    }
    this.run(
      this.requestApi.updateStatus(this.id(), {
        to: next,
        comment: this.statusForm.comment,
        notifyRequester: this.statusForm.notify,
        resolutionOutcome: next === 'RESOLVED' ? this.statusForm.outcome : undefined,
      }),
      `Status changed to ${STATUS_LABEL[next]}.${this.statusForm.notify ? ' The requester has been notified.' : ''}`,
    );
    this.statusForm = { comment: '', notify: true, outcome: 'FIXED' };
  }

  protected requesterNames(r: ServiceRequest): string {
    return r.requesterIds.map((id) => this.lookup.getUserName(id)).join(', ');
  }
}
