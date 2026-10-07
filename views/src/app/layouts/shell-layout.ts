import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserApi } from '../core/api/contracts';
import { SessionService } from '../core/auth/session.service';
import { LookupService } from '../core/data/lookup.service';
import { isManagerRole, isStaffRole } from '../core/domain/request-rules';
import { ROLE_LABEL, initials } from '../core/models';

/**
 * Frame for signed-in users. Requesters get a top menu; staff and managers get a sidebar.
 * Account settings uses the same frame for every role.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CdkMenuTrigger, CdkMenu, CdkMenuItem],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.scss',
})
export class ShellLayout implements OnInit {
  private readonly session = inject(SessionService);
  private readonly lookup = inject(LookupService);
  private readonly userApi = inject(UserApi);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;
  protected readonly isStaff = computed(() => isStaffRole(this.user()));
  protected readonly isManager = computed(() => isManagerRole(this.user()));
  protected readonly initials = computed(() => initials(this.user()));
  protected readonly pendingApprovals = signal(0);

  /** e.g. "Staff · Water · Clearance 3" or "Manager · All departments". */
  protected readonly roleChip = computed(() => {
    const u = this.user();
    if (!u?.role) return '';
    if (u.role === 'REQUESTER') return 'Requester';
    if (isManagerRole(u)) return `${ROLE_LABEL[u.role]} · All departments`;
    return `${ROLE_LABEL[u.role]} · ${this.lookup.getDepartmentName(u.departmentId)} · Clearance ${u.clearance}`;
  });

  ngOnInit(): void {
    this.lookup.getAll();
    if (this.isManager()) {
      this.userApi.getUsers().subscribe({
        next: (users) => this.pendingApprovals.set(users.filter((u) => u.verified && u.approval === 'PENDING').length),
      });
    }
  }

  protected signOut(): void {
    this.session.logout().subscribe({ complete: () => void this.router.navigate(['/login']), error: () => void this.router.navigate(['/login']) });
  }
}
