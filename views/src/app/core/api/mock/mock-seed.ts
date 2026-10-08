import { Category, Department, RequestGroup, RequestNote, ServiceRequest, StatusChange, User } from '../../models';

/** Demo data for the mock API. Dates are relative to "now" so overdue items always exist. */

const DAY = 86_400_000;
export function daysAgo(days: number, hour = 9): string {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
export function daysFromNow(days: number): string {
  return daysAgo(-days, 17);
}

export const DEMO_PASSWORD = 'demo';

export const SEED_DEPARTMENTS: Department[] = [
  { id: 'dep-water', name: 'Water', isActive: true },
  { id: 'dep-roads', name: 'Roads', isActive: true },
  { id: 'dep-elec', name: 'Electricity', isActive: true },
  { id: 'dep-parks', name: 'Parks', isActive: true },
  { id: 'dep-waste', name: 'Waste', isActive: true },
];

export const SEED_CATEGORIES: Category[] = [
  { id: 'cat-sanitation', name: 'Water / sanitation', departmentId: 'dep-water', defaultSecurityLevel: 2, slaDays: 3, isActive: true },
  { id: 'cat-supply', name: 'Water supply', departmentId: 'dep-water', defaultSecurityLevel: 1, slaDays: 5, isActive: true },
  { id: 'cat-potholes', name: 'Potholes & road damage', departmentId: 'dep-roads', defaultSecurityLevel: 1, slaDays: 7, isActive: true },
  { id: 'cat-lights', name: 'Streetlights', departmentId: 'dep-elec', defaultSecurityLevel: 1, slaDays: 5, isActive: true },
  { id: 'cat-outage', name: 'Power outage', departmentId: 'dep-elec', defaultSecurityLevel: 2, slaDays: 2, isActive: true },
  { id: 'cat-trees', name: 'Trees & parks', departmentId: 'dep-parks', defaultSecurityLevel: 0, slaDays: 10, isActive: true },
  { id: 'cat-waste', name: 'Waste collection', departmentId: 'dep-waste', defaultSecurityLevel: 0, slaDays: 3, isActive: true },
];

function user(partial: Partial<User> & Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>): User {
  return {
    role: null,
    clearance: 0,
    departmentId: null,
    workCategoryIds: [],
    email: `${partial.username}@example.com`,
    phone: null,
    notifyVia: 'EMAIL',
    verified: true,
    approval: 'APPROVED',
    approvedBy: 'u-admin',
    approvedAt: daysAgo(60),
    decisionNote: null,
    isActive: true,
    createdAt: daysAgo(90),
    ...partial,
  };
}

export const SEED_USERS: User[] = [
  user({ id: 'u-req', username: 'requester', firstName: 'Jordan', lastName: 'Smith', role: 'REQUESTER', phone: '+27820004821' }),
  user({ id: 'u-req2', username: 'requester2', firstName: 'Thabo', lastName: 'Nkosi', role: 'REQUESTER', notifyVia: 'SMS', phone: '+27831112233' }),
  user({ id: 'u-staff', username: 'staff', firstName: 'Sam', lastName: 'Naidoo', role: 'STAFF', clearance: 3, departmentId: 'dep-water', workCategoryIds: ['cat-sanitation', 'cat-supply'] }),
  user({ id: 'u-staff2', username: 'staff2', firstName: 'Lerato', lastName: 'Mokoena', role: 'STAFF', clearance: 2, departmentId: 'dep-water', workCategoryIds: ['cat-sanitation'] }),
  user({ id: 'u-staff3', username: 'staff3', firstName: 'Pieter', lastName: 'van Wyk', role: 'STAFF', clearance: 2, departmentId: 'dep-roads', workCategoryIds: ['cat-potholes'] }),
  user({ id: 'u-staff4', username: 'staff4', firstName: 'Ayesha', lastName: 'Patel', role: 'STAFF', clearance: 3, departmentId: 'dep-elec', workCategoryIds: ['cat-lights', 'cat-outage'] }),
  user({ id: 'u-staff5', username: 'staff5', firstName: 'Musa', lastName: 'Dlamini', role: 'STAFF', clearance: 1, departmentId: 'dep-parks', workCategoryIds: ['cat-trees'] }),
  user({ id: 'u-mgr', username: 'manager', firstName: 'Morgan', lastName: 'Botha', role: 'MANAGER', clearance: 5 }),
  user({ id: 'u-admin', username: 'admin', firstName: 'Alex', lastName: 'Jacobs', role: 'ADMIN', clearance: 5 }),
  // Accounts waiting for manager sign-off (role null, clearance 0).
  user({ id: 'u-pend', username: 'pending', firstName: 'Casey', lastName: 'Fourie', approval: 'PENDING', approvedBy: null, approvedAt: null, isActive: false, createdAt: daysAgo(0, 8) }),
  user({ id: 'u-pend2', username: 'tnkosi', firstName: 'Tumi', lastName: 'Nel', approval: 'PENDING', approvedBy: null, approvedAt: null, isActive: false, notifyVia: 'SMS', phone: '+27845550101', createdAt: daysAgo(1, 9) }),
  user({ id: 'u-pend3', username: 'avanwyk', firstName: 'Anri', lastName: 'du Toit', approval: 'PENDING', approvedBy: null, approvedAt: null, isActive: false, createdAt: daysAgo(2, 16) }),
  // Registered but never entered the code.
  user({ id: 'u-unver', username: 'unverified', firstName: 'Riley', lastName: 'Adams', verified: false, approval: 'PENDING', approvedBy: null, approvedAt: null, isActive: false, createdAt: daysAgo(0, 7) }),
  user({ id: 'u-decl', username: 'declined', firstName: 'Dana', lastName: 'Visser', approval: 'DECLINED', approvedBy: 'u-mgr', approvedAt: daysAgo(5), decisionNote: 'Duplicate of an existing account.', isActive: false, createdAt: daysAgo(6) }),
];

export const SEED_GROUPS: RequestGroup[] = [
  { id: 'grp-31', title: 'GRP-031 · Park St sewer line', departmentId: 'dep-water', createdBy: 'u-staff', createdAt: daysAgo(14) },
];

let noteSeq = 0;
function note(type: RequestNote['type'], visibility: RequestNote['visibility'], userId: string, date: string, details: string): RequestNote {
  noteSeq += 1;
  return { id: `n-${noteSeq}`, type, visibility, userId, date, details };
}
function change(from: StatusChange['from'], to: StatusChange['to'], by: string, at: string, comment: string, notifyRequester = true): StatusChange {
  return { from, to, by, at, comment, notifyRequester };
}

interface SeedInput {
  n: number;
  title: string;
  details: string;
  address: string;
  requester: string;
  created: number;
  category?: string;
  staff?: string;
  priority?: ServiceRequest['priority'];
  status: ServiceRequest['status'];
  due?: string;
  group?: string;
}

function request(s: SeedInput): ServiceRequest {
  const category = SEED_CATEGORIES.find((c) => c.id === s.category) ?? null;
  const requester = SEED_USERS.find((u) => u.id === s.requester)!;
  const created = daysAgo(s.created, 8);
  const history: StatusChange[] = [change(null, 'SUBMITTED', s.requester, created, 'Request submitted.', false)];
  const notes: RequestNote[] = [];
  const steps: ServiceRequest['status'][] = ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const reached = steps.slice(0, Math.max(0, ['SUBMITTED', ...steps].indexOf(s.status)));
  const staff = s.staff ?? 'u-staff';
  reached.forEach((to, i) => {
    const at = daysAgo(Math.max(0, s.created - (i + 1)), 10 + i);
    const from = i === 0 ? 'SUBMITTED' : reached[i - 1];
    const comment = {
      ASSIGNED: `Categorised as ${category?.name ?? 'general'} and assigned.`,
      IN_PROGRESS: 'Crew dispatched to site.',
      RESOLVED: 'Repair completed and tested.',
      CLOSED: 'Confirmed with requester; closing.',
      SUBMITTED: '',
    }[to];
    history.push(change(from, to, to === 'CLOSED' ? 'u-mgr' : staff, at, comment));
  });
  if (reached.length > 0) {
    notes.push(note('WORK', 'INTERNAL', staff, daysAgo(Math.max(0, s.created - 1), 15), 'Checked site access and materials.'));
  }
  if (s.n % 3 === 0) {
    notes.push(note('COMMENT', 'PUBLIC', s.requester, daysAgo(s.created, 18), 'It gets worse in the evenings.'));
  }
  const assignedAt = reached.length ? history[1].at : null;
  const resolved = history.find((h) => h.to === 'RESOLVED');
  const closed = history.find((h) => h.to === 'CLOSED');
  return {
    id: `r-${s.n}`,
    trackingId: `REQ-${new Date().getFullYear()}-${String(s.n).padStart(6, '0')}`,
    title: s.title,
    details: s.details,
    address: s.address,
    contact: { email: requester.email, phone: requester.phone },
    requesterIds: [s.requester],
    categoryId: reached.length ? (category?.id ?? null) : null,
    departmentId: reached.length ? (category?.departmentId ?? null) : null,
    securityLevel: reached.length ? (category?.defaultSecurityLevel ?? 0) : null,
    priority: reached.length ? (s.priority ?? 'MEDIUM') : null,
    status: s.status,
    active: s.status !== 'CLOSED',
    groupId: s.group ?? null,
    assignedTo: reached.length ? staff : null,
    assignedBy: reached.length ? staff : null,
    assignedAt,
    categorisedBy: reached.length ? staff : null,
    dueAt: reached.length ? (s.due ?? daysFromNow(4)) : null,
    dueSetBy: reached.length ? staff : null,
    resolvedAt: resolved?.at ?? null,
    resolvedBy: resolved?.by ?? null,
    resolutionOutcome: resolved ? 'FIXED' : null,
    closedAt: closed?.at ?? null,
    closedBy: closed?.by ?? null,
    createdAt: created,
    updatedAt: history[history.length - 1].at,
    notes,
    statusHistory: history,
  };
}

export function buildSeedRequests(): ServiceRequest[] {
  noteSeq = 0;
  return [
    request({ n: 214, title: 'Burst pipe on Main Rd', details: 'Water is gushing from the pavement outside number 12.', address: '12 Main Rd', requester: 'u-req', created: 0, status: 'SUBMITTED' }),
    request({ n: 213, title: 'Low water pressure, Main Rd', details: 'Very low pressure in the mornings for three days.', address: '40 Main Rd', requester: 'u-req2', created: 0, status: 'SUBMITTED' }),
    request({ n: 212, title: 'Fallen branch on footpath', details: 'Large branch blocking the footpath next to the school.', address: 'Oak Ave, near the school gate', requester: 'u-req2', created: 1, status: 'SUBMITTED' }),
    request({ n: 201, title: 'Leaking meter box', details: 'Meter box leaks constantly; pavement is wet.', address: '7 Church St', requester: 'u-req2', created: 6, category: 'cat-supply', staff: 'u-staff', priority: 'LOW', status: 'ASSIGNED', due: daysFromNow(1) }),
    request({ n: 198, title: 'Streetlight out, corner 5th Ave', details: 'Streetlight on the north-east corner has been off for 4 nights. Area is very dark.', address: 'Cnr 5th Ave & Oak St', requester: 'u-req', created: 8, category: 'cat-lights', staff: 'u-staff4', priority: 'MEDIUM', status: 'IN_PROGRESS', due: daysFromNow(2) }),
    request({ n: 187, title: 'Pothole outside school gate', details: 'Deep pothole; cars swerve into oncoming traffic.', address: 'School Rd', requester: 'u-req', created: 14, category: 'cat-potholes', staff: 'u-staff3', priority: 'HIGH', status: 'ASSIGNED', due: daysAgo(3) }),
    request({ n: 181, title: 'Smell from manhole', details: 'Strong sewage smell from the manhole by the bus stop.', address: 'Park St bus stop', requester: 'u-req2', created: 16, category: 'cat-sanitation', staff: 'u-staff2', priority: 'MEDIUM', status: 'ASSIGNED', due: daysAgo(4), group: 'grp-31' }),
    request({ n: 179, title: 'Blocked drain, Park St', details: 'Storm drain completely blocked with debris.', address: '20 Park St', requester: 'u-req', created: 17, category: 'cat-sanitation', staff: 'u-staff', priority: 'HIGH', status: 'IN_PROGRESS', due: daysAgo(5), group: 'grp-31' }),
    request({ n: 177, title: 'Sewage overflow, Park St', details: 'Manhole overflowing onto the pavement next to the bus stop. Strong smell, spreading toward houses.', address: '14 Park St, Ward 7', requester: 'u-req2', created: 18, category: 'cat-sanitation', staff: 'u-staff', priority: 'HIGH', status: 'IN_PROGRESS', due: daysAgo(6), group: 'grp-31' }),
    request({ n: 165, title: 'Power outage, Block D', details: 'No power in Block D since last night.', address: 'Block D, Hill View flats', requester: 'u-req2', created: 20, category: 'cat-outage', staff: 'u-staff4', priority: 'HIGH', status: 'RESOLVED' }),
    request({ n: 162, title: 'Fallen tree blocking lane', details: 'Tree came down in the storm and blocks the lane.', address: 'Willow Lane', requester: 'u-req', created: 21, category: 'cat-trees', staff: 'u-staff5', priority: 'MEDIUM', status: 'ASSIGNED', due: daysAgo(2) }),
    request({ n: 150, title: 'Overflowing bins in park', details: 'Bins have not been emptied in two weeks.', address: 'Central Park, east gate', requester: 'u-req', created: 26, category: 'cat-waste', staff: 'u-staff5', priority: 'LOW', status: 'RESOLVED' }),
    request({ n: 140, title: 'No water, Block C', details: 'No water supply at all since this morning.', address: 'Block C, Hill View flats', requester: 'u-req2', created: 28, category: 'cat-supply', staff: 'u-staff', priority: 'HIGH', status: 'RESOLVED' }),
    request({ n: 121, title: 'Leaking fire hydrant', details: 'Hydrant leaking steadily onto the road.', address: 'Corner Main Rd & 2nd Ave', requester: 'u-req', created: 35, category: 'cat-supply', staff: 'u-staff2', priority: 'MEDIUM', status: 'CLOSED' }),
    request({ n: 110, title: 'Cracked road surface', details: 'Long crack across both lanes after roadworks.', address: 'Station Rd', requester: 'u-req2', created: 40, category: 'cat-potholes', staff: 'u-staff3', priority: 'LOW', status: 'CLOSED' }),
  ];
}
