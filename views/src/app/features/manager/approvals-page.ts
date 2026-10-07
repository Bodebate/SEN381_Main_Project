import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getErrorMessage } from '../../core/api/api-error';
import { UserApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { LookupService } from '../../core/data/lookup.service';
import { ApprovalState, ROLE_LABEL, Role, User } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';

/**
 * Wireframe 11: manager sign-off for new accounts (no abuse of role-based access).
 * New accounts arrive verified with role = null and clearance 0; the manager sets their boundaries.
 */
@Component({
  selector: 'app-approvals-page',
  imports: [DatePipe, FormsModule, EmptyState],
  templateUrl: './approvals-page.html',
})
export class ApprovalsPage implements OnInit {
  private readonly userApi = inject(UserApi);
  private readonly session = inject(SessionService);
  protected readonly lookup = inject(LookupService);

  protected readonly roleLabel = ROLE_LABEL;
  protected readonly roles: Role[] = ['REQUESTER', 'STAFF', 'MANAGER', 'ADMIN'];
  protected readonly clearances = [0, 1, 2, 3, 4, 5];
  protected readonly users = signal<User[]>([]);
  protected readonly tab = signal<ApprovalState>('PENDING');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected form = { role: '' as Role | '', clearance: 0, departmentId: '', workCategoryIds: [] as string[], note: '' };

  protected readonly isAdmin = computed(() => this.session.user()?.role === 'ADMIN');
  /** Only verified accounts can be approved; unverified ones never finished sign-up. */
  protected readonly listed = computed(() =>
    this.users().filter((u) => u.approval === this.tab() && (this.tab() !== 'PENDING' || u.verified)),
  );
  protected readonly counts = computed(() => ({
    PENDING: this.users().filter((u) => u.approval === 'PENDING' && u.verified).length,
    APPROVED: this.users().filter((u) => u.approval === 'APPROVED').length,
    DECLINED: this.users().filter((u) => u.approval === 'DECLINED').length,
  }));
  protected readonly selected = computed(() => this.users().find((u) => u.id === this.selectedId()) ?? null);
  protected readonly categoriesForDepartment = computed(() =>
    this.lookup.categories().filter((c) => !this.formDepartment() || c.departmentId === this.formDepartment()),
  );
  private readonly formDepartment = signal('');

  ngOnInit(): void {
    this.getUsers();
  }

  private getUsers(): void {
    this.userApi.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        if (!this.selected()) this.select(this.listed()[0] ?? null);
      },
      error: (e) => this.error.set(getErrorMessage(e)),
    });
  }

  protected setTab(tab: ApprovalState): void {
    this.tab.set(tab);
    this.select(this.listed()[0] ?? null);
  }

  protected select(user: User | null): void {
    this.selectedId.set(user?.id ?? null);
    this.form = {
      role: user?.role ?? '',
      clearance: user?.clearance ?? 0,
      departmentId: user?.departmentId ?? '',
      workCategoryIds: [...(user?.workCategoryIds ?? [])],
      note: '',
    };
    this.formDepartment.set(this.form.departmentId);
    this.error.set('');
  }

  protected onDepartment(id: string): void {
    this.form.departmentId = id;
    this.formDepartment.set(id);
    this.form.workCategoryIds = this.form.workCategoryIds.filter((c) => this.lookup.getCategory(c)?.departmentId === id);
  }

  protected toggleCategory(id: string, on: boolean): void {
    this.form.workCategoryIds = on ? [...this.form.workCategoryIds, id] : this.form.workCategoryIds.filter((c) => c !== id);
  }

  protected canGrant(role: Role): boolean {
    return role === 'REQUESTER' || role === 'STAFF' || this.isAdmin();
  }

  protected decide(decision: 'APPROVE' | 'DECLINE'): void {
    const user = this.selected();
    if (!user) return;
    if (decision === 'APPROVE' && !this.form.role) {
      this.error.set('Choose a role before approving.');
      return;
    }
    if (decision === 'APPROVE' && this.form.role === 'STAFF' && !this.form.departmentId) {
      this.error.set('Staff need a department.');
      return;
    }
    if (decision === 'DECLINE' && !this.form.note.trim()) {
      this.error.set('Add a note explaining why the account is declined.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.userApi
      .updateApproval(user.id, {
        decision,
        role: this.form.role || null,
        clearance: this.form.clearance,
        departmentId: this.form.departmentId || null,
        workCategoryIds: this.form.workCategoryIds,
        note: this.form.note,
      })
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          const verb = decision === 'DECLINE' ? 'declined' : user.approval === 'APPROVED' ? 'updated' : 'approved';
          this.notice.set(`${updated.firstName} ${updated.lastName} ${verb}. The change is logged as SECURITY_CHANGE.`);
          this.selectedId.set(null);
          this.getUsers();
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(getErrorMessage(e));
        },
      });
  }
}
