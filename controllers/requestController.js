const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const sender = require('../services/twilio');
const textbee = require('../services/textbee');
const read = new DBRead();
const write = new DBUpdateWrite();

// Requesters only ever see PUBLIC notes
const forViewer = (request, actor) => (actor.role === 'REQUESTER'
    ? { ...request, notes: (request.notes || []).filter(n => n.visibility === 'PUBLIC') }
    : request);

// Loads a request through the access filter; 404 when the actor can't see it
async function loadVisible(id, actor) {
    const [found] = await read.findRequests({ id }, actor);
    if (!found) {
        const err = new Error('Request not found.');
        err.status = 404;
        throw err;
    }
    return found;
}

// A failed SMS or email must not undo the change itself
async function notifyRequester(request, text) {
    try {
        const user = await read.findUserById(request.requesterIds[0]);
        if (!user) return;
        if (user.notifyVia === 'SMS' && user.phone) await textbee.sendSMS(user.phone, text);
        else if (user.email) await sender.sendEmail(user.email, 'Update on your CivicConnect request', `<p>${text}</p>`);
    } catch (err) {
        console.error('Notification failed:', err.message);
    }
}

// GET /requests?mine=true&status=IN_PROGRESS&open=true
exports.list = async (req, res, next) => {
    try {
        const filters = { status: req.query.status, isOpen: req.query.open };
        if (req.query.mine === 'true') filters.requester = req.actor.user_id;
        const list = await read.findRequests(filters, req.actor);
        res.json(list.map(r => forViewer(r, req.actor)));
    } catch (err) { next(err); }
};

// GET /requests/:id
exports.getOne = async (req, res, next) => {
    try { res.json(forViewer(await loadVisible(req.params.id, req.actor), req.actor)); }
    catch (err) { next(err); }
};

// POST /requests  (NewRequestData)
exports.create = async (req, res, next) => {
    try {
        const { title, details, address, contact } = req.body || {};
        if (!details?.trim() || !address?.trim())
            return res.status(400).json({ message: 'Details and address are required' });
        const created = await write.createRequest({ title, details, address, contact }, req.actor);
        res.status(201).json(forViewer(created, req.actor));
    } catch (err) { next(err); }
};

// POST /requests/:id/comments  { text }
exports.addComment = async (req, res, next) => {
    try {
        const found = await loadVisible(req.params.id, req.actor);
        if (req.actor.role === 'REQUESTER' && !found.requesterIds.includes(String(req.actor.user_id)))
            return res.status(403).json({ message: 'Access denied' });
        const text = String(req.body?.text || '').trim();
        if (!text) return res.status(400).json({ message: 'Comment text is required' });
        const updated = await write.addNoteToRequest(req.params.id,
            { details: text, category: 'COMMENT', visibility: 'PUBLIC', userId: req.actor.user_id }, req.actor);
        res.json(forViewer(updated, req.actor));
    } catch (err) { next(err); }
};

// POST /requests/:id/notes  { details, applyToGroup }
exports.addNote = async (req, res, next) => {
    try {
        const found = await loadVisible(req.params.id, req.actor);
        const details = String(req.body?.details || '').trim();
        if (!details) return res.status(400).json({ message: 'Note details are required' });
        const note = { details, category: 'WORK', visibility: 'INTERNAL', userId: req.actor.user_id };
        const updated = await write.addNoteToRequest(req.params.id, note, req.actor);
        if (req.body.applyToGroup && found.groupId) {
            await write.addNoteToRequestGroup(found.groupId, note, req.actor);
        }
        res.json(updated);
    } catch (err) { next(err); }
};

// PUT /requests/:id/triage  (TriageData)
exports.triage = async (req, res, next) => {
    try {
        await loadVisible(req.params.id, req.actor);
        const { categoryId, assigneeId, dueAt, priority, comment } = req.body || {};
        if (!categoryId || !assigneeId || !priority)
            return res.status(400).json({ message: 'Category, assignee and priority are required' });
        res.json(await write.updateRequest(req.params.id,
            { categoryId, assigneeId, dueAt, priority, status: 'ASSIGNED', comment }, req.actor));
    } catch (err) { next(err); }
};

// assignee, due date and category: change one field, then log the reason as a SYSTEM note
const changeWithReason = (field, label) => async (req, res, next) => {
    try {
        await loadVisible(req.params.id, req.actor);
        const value = req.body?.[field];
        if (value === undefined) return res.status(400).json({ message: `${field} is required` });
        let updated = await write.updateRequest(req.params.id, { [field]: value }, req.actor);
        const reason = String(req.body.reason || '').trim();
        if (reason) {
            updated = await write.addNoteToRequest(req.params.id,
                { details: `${label} changed: ${reason}`, category: 'SYSTEM', visibility: 'INTERNAL',
                  userId: req.actor.user_id }, req.actor);
        }
        res.json(updated);
    } catch (err) { next(err); }
};
exports.assignee = changeWithReason('assigneeId', 'Assignee');
exports.dueDate = changeWithReason('dueAt', 'Due date');
exports.category = changeWithReason('categoryId', 'Category');

// PUT /requests/:id/status  (StatusUpdate)
exports.updateStatus = async (req, res, next) => {
    try {
        await loadVisible(req.params.id, req.actor);
        const { to, comment, notifyRequester: notify, resolutionOutcome } = req.body || {};
        const updated = await write.updateRequest(req.params.id,
            { status: to, comment, notifyRequester: notify, resolutionOutcome }, req.actor);
        if (notify) {
            const label = String(to).replace('_', ' ').toLowerCase();
            await notifyRequester(updated, `Your request ${updated.trackingId} is now ${label}: ${comment}`);
        }
        res.json(updated);
    } catch (err) { next(err); }
};
