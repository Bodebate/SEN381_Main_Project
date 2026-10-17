const DBRead = require('../models/DatabaseRead');
const { categories, departments } = require('../config/lookups');

const read = new DBRead();
const STATUS_LABEL = { SUBMITTED: 'Submitted', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
const OUTCOME_LABEL = { FIXED: 'Fixed', REJECTED: 'Rejected', DUPLICATE: 'Duplicate' };

const csvCell = v => {
    const s = v == null ? '' : String(v instanceof Date ? v.toISOString() : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const iso = d => (d ? new Date(d).toISOString() : '');

// GET /reports/dashboard?from=...&to=...&departmentId=...
exports.dashboard = async (req, res, next) => {
    try {
        const { from, to, departmentId } = req.query;
        res.json(await read.getDashboard({ from, to, departmentId }, req.actor));
    } catch (err) { next(err); }
};

// POST /reports/export  { requestIds, lifecycle, comments, staffMetrics }
// The CSV columns match the Angular mock export (mock-report-api.ts).
exports.exportCsv = async (req, res, next) => {
    try {
        const { requestIds, lifecycle, comments } = req.body || {};
        if (!Array.isArray(requestIds) || requestIds.length === 0)
            return res.status(400).json({ message: 'Choose at least one request' });

        const rows = (await read.findRequests({}, req.actor)).filter(r => requestIds.includes(r.id));
        const people = await read.findDirectory(req.actor);
        const nameOf = id => people.find(p => p.id === id)?.name ?? '';
        const now = new Date();

        const header = ['Tracking ID', 'Title', 'Status', 'Priority', 'Category', 'Department', 'Owner',
            'Submitted', 'Due', 'Resolved', 'Outcome', 'Closed', 'Overdue'];
        if (lifecycle) header.push('Lifecycle');
        if (comments) header.push('Comments');

        const lines = rows.map(r => {
            const open = !['RESOLVED', 'CLOSED'].includes(r.status);
            const row = [
                r.trackingId, r.title, STATUS_LABEL[r.status], r.priority ? PRIORITY_LABEL[r.priority] : '',
                categories.find(c => c.id === r.categoryId)?.name ?? 'Uncategorised',
                departments.find(d => d.id === r.departmentId)?.name ?? '',
                nameOf(r.assignedTo), iso(r.createdAt), iso(r.dueAt), iso(r.resolvedAt),
                r.resolutionOutcome ? OUTCOME_LABEL[r.resolutionOutcome] : '', iso(r.closedAt),
                open && r.dueAt && new Date(r.dueAt) < now ? 'Yes' : 'No',
            ];
            if (lifecycle) row.push(r.statusHistory
                .map(h => `${iso(h.at)} ${h.from ?? 'NEW'}->${h.to} by ${nameOf(h.by)}: ${h.comment}`).join(' | '));
            if (comments) row.push(r.notes          // POPI: requester contact details are not exported
                .map(n => `${iso(n.date)} ${nameOf(n.userId)} (${n.type}): ${n.details}`).join(' | '));
            return row.map(csvCell).join(',');
        });

        res.attachment('civicconnect-requests.csv')
            .type('text/csv; charset=utf-8')
            .send([header.map(csvCell).join(','), ...lines].join('\n'));
    } catch (err) { next(err); }
};
