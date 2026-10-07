export interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

/** Categories are chosen by staff at triage. A category routes a request to its department. */
export interface Category {
  id: string;
  name: string;
  departmentId: string;
  defaultSecurityLevel: number;
  /** Suggested number of days for the due date; staff can override it. */
  slaDays: number;
  isActive: boolean;
}

export interface DashboardData {
  activeCount: number;
  overdueCount: number;
  resolvedInPeriod: number;
  receivedInPeriod: number;
  resolutionRate: number;
  avgResolveDays: number | null;
  byStatus: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
  byDepartment: { label: string; count: number; overdue: number }[];
  staff: { name: string; department: string; openAssigned: number; resolved: number; avgResolveDays: number | null; overdue: number }[];
}

export interface ExportOptions {
  lifecycle: boolean;
  comments: boolean;
  staffMetrics: boolean;
}
