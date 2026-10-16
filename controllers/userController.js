const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const { APPROVAL_TO_DB } = require('../models/utils/Mappers');

const read = new DBRead();
const write = new DBUpdateWrite();
const ROLES = ['REQUESTER', 'STAFF', 'MANAGER', 'ADMIN'];

// GET /users
exports.list = async (req, res, next) => {
    try { res.json(await read.listUsers({ approval: req.query.approval }, req.actor)); }
    catch (err) { next(err); }
};

// GET /users/directory
exports.directory = async (req, res, next) => {
    try { res.json(await read.findDirectory(req.actor)); } catch (err) { next(err); }
};

// GET /users/assignable?departmentId=dep-roads
exports.assignable = async (req, res, next) => {
    try { res.json(await read.findAssignableStaff(req.query.departmentId, req.actor)); }
    catch (err) { next(err); }
};

// PUT /users/:id/approval  (ApprovalDecision)
exports.decide = async (req, res, next) => {
    try {
        const { decision, role, clearance, departmentId, workCategoryIds, note } = req.body || {};
        const approvalStatus = APPROVAL_TO_DB[decision];
        if (!approvalStatus)
            return res.status(400).json({ message: 'decision must be APPROVE or DECLINE' });
        if (decision === 'APPROVE' && !ROLES.includes(role))
            return res.status(400).json({ message: 'Choose a role when approving' });

        const update = decision === 'APPROVE'
            ? { approvalStatus, role, clearance: Number(clearance) || 0, department: departmentId ?? null,
                workCategories: workCategoryIds || [], decisionNote: note || null }
            : { approvalStatus, decisionNote: note || null };

        res.json(await write.updateUser(req.params.id, update, req.actor));
    } catch (err) { next(err); }
};
