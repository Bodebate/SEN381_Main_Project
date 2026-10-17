import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Category, Department, DirectoryEntry } from '../models';
import { RequestApi, UserApi } from '../api/contracts';

/** Caches reference data (categories, departments, display names) used across pages. */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly requestApi = inject(RequestApi);
  private readonly userApi = inject(UserApi);

  readonly categories = signal<Category[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly directory = signal<DirectoryEntry[]>([]);

  private readonly categoryMap = computed(() => new Map(this.categories().map((c) => [c.id, c])));
  private readonly departmentMap = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly nameMap = computed(() => new Map(this.directory().map((d) => [d.id, d.name])));

  /** Loads (or reloads) everything. Safe to call on every page that needs names. */
  getAll(): void {
    forkJoin({
      categories: this.requestApi.getCategories(),
      departments: this.requestApi.getDepartments(),
      directory: this.userApi.getDirectory(),
    }).subscribe({
      next: (data) => {
        this.categories.set(data.categories);
        this.departments.set(data.departments);
        this.directory.set(data.directory);
      },
      error: () => {
        /* reference data is optional for rendering; pages show ids as a fallback */
      },
    });
  }

  getCategory(id: string | null): Category | undefined {
    return id ? this.categoryMap().get(id) : undefined;
  }

  getCategoryName(id: string | null): string {
    return id ? (this.categoryMap().get(id)?.name ?? '—') : 'Uncategorised';
  }

  getDepartmentName(id: string | null): string {
    return id ? (this.departmentMap().get(id)?.name ?? '—') : '—';
  }

  getUserName(id: string | null): string {
    return id ? (this.nameMap().get(id) ?? 'Unknown user') : '—';
  }
}
