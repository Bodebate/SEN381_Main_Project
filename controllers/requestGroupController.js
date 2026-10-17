const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');

const read = new DBRead();
const write = new DBUpdateWrite();

// GET /request-groups
exports.list = async (req, res, next) => {
    try { res.json(await read.findRequestGroups({}, req.actor)); } catch (err) { next(err); }
};

// POST /request-groups  { requestIds, title }
exports.create = async (req, res, next) => {
    try {
        const { requestIds, title } = req.body || {};
        if (!Array.isArray(requestIds) || requestIds.length < 2)
            return res.status(400).json({ message: 'Choose at least two requests' });
        for (const id of requestIds) {
            const [visible] = await read.findRequests({ id }, req.actor);
            if (!visible) return res.status(404).json({ message: `Request ${id} not found` });
        }
        const group = await write.createRequestGroup(
            { createdBy: req.actor.user_id, title: title?.trim() || 'Grouped requests', primaryRequestId: requestIds[0] },
            req.actor);
        for (const id of requestIds) {
            await write.updateRequest(id, { groupId: group.id }, req.actor);
        }
        res.status(201).json(group);
    } catch (err) { next(err); }
};
