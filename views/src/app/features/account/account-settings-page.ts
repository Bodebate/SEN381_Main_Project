import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getErrorMessage } from '../../core/api/api-error';
import { UserApi } from '../../core/api/contracts';
import { SessionService } from '../../core/auth/session.service';
import { LookupService } from '../../core/data/lookup.service';
import { NotifyChannel, ROLE_LABEL } from '../../core/models';

type Section = 'personal' | 'contact' | 'password';

/**
 * Wireframe 12: every role updates their own details here.
 * Role, clearance and department are read-only (set by management on the approvals page).
 * 2FA is only used at sign-up, so there is no 2FA setting here; changing email or mobile
 * still needs a code sent to the new address.
 */
@Component({
  selector: 'app-account-settings-page',
  imports: [FormsModule],
  templateUrl: './account-settings-page.html',
})
export class AccountSettingsPage implements OnInit {
  private readonly userApi = inject(UserApi);
  private readonly session = inject(SessionService);
  protected readonly lookup = inject(LookupService);

  protected readonly user = this.session.user;
  protected readonly roleName = computed(() => (this.user()?.role ? ROLE_LABEL[this.user()!.role!] : 'None'));
  protected readonly messages = signal<Partial<Record<Section, { kind: 'success' | 'error'; text: string }>>>({});
  protected readonly busy = signal<Section | null>(null);
  protected readonly codeSentTo = signal<string | null>(null);

  protected personal = { firstName: '', lastName: '' };
  protected contact = { email: '', phone: '', notifyVia: 'EMAIL' as NotifyChannel, code: '' };
  protected password = { current: '', next: '', confirm: '' };

  ngOnInit(): void {
    this.resetForms();
  }

  private resetForms(): void {
    const u = this.user();
    this.personal = { firstName: u?.firstName ?? '', lastName: u?.lastName ?? '' };
    this.contact = { email: u?.email ?? '', phone: u?.phone ?? '', notifyVia: u?.notifyVia ?? 'EMAIL', code: '' };
  }

  private say(section: Section, kind: 'success' | 'error', text: string): void {
    this.messages.update((m) => ({ ...m, [section]: { kind, text } }));
  }

  protected savePersonal(): void {
    this.busy.set('personal');
    this.userApi.updateProfile(this.personal.firstName, this.personal.lastName).subscribe({
      next: (user) => {
        this.session.updateUser(user);
        this.busy.set(null);
        this.say('personal', 'success', 'Details saved.');
      },
      error: (e) => {
        this.busy.set(null);
        this.say('personal', 'error', getErrorMessage(e));
      },
    });
  }

  protected saveContact(): void {
    if (this.contact.phone && !/^\+[1-9][0-9]{7,14}$/.test(this.contact.phone)) {
      this.say('contact', 'error', 'Use international format for mobile numbers, e.g. +27821234567.');
      return;
    }
    this.busy.set('contact');
    this.userApi
      .updateContact({
        email: this.contact.email || null,
        phone: this.contact.phone || null,
        notifyVia: this.contact.notifyVia,
        code: this.codeSentTo() ? this.contact.code : undefined,
      })
      .subscribe({
        next: (result) => {
          this.busy.set(null);
          if (result.status === 'CODE_SENT') {
            this.codeSentTo.set(result.sentTo);
            this.say('contact', 'success', `We sent a 6-digit code to ${result.sentTo}. Enter it below to confirm the change.`);
            return;
          }
          this.session.updateUser(result.user);
          this.codeSentTo.set(null);
          this.contact.code = '';
          this.say('contact', 'success', 'Contact settings saved.');
        },
        error: (e) => {
          this.busy.set(null);
          this.say('contact', 'error', getErrorMessage(e));
        },
      });
  }

  protected cancelContact(): void {
    this.codeSentTo.set(null);
    this.resetForms();
    this.messages.update((m) => ({ ...m, contact: undefined }));
  }

  protected savePassword(): void {
    if (this.password.next !== this.password.confirm) {
      this.say('password', 'error', "The new passwords don't match.");
      return;
    }
    this.busy.set('password');
    this.userApi.updatePassword(this.password.current, this.password.next).subscribe({
      next: () => {
        this.busy.set(null);
        this.password = { current: '', next: '', confirm: '' };
        this.say('password', 'success', 'Password changed.');
      },
      error: (e) => {
        this.busy.set(null);
        this.say('password', 'error', getErrorMessage(e));
      },
    });
  }
}
