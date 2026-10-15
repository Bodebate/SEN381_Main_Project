const DBRead = require('../models/DatabaseRead');
const DBWrite = require('../models/DatabaseWriteUpdate');
const read = new DBRead();
const write = new DBWrite();

exports.list = async (req, res, next) => {
    try {
        const filters = {};
        if (req.query.status) filters.status = req.query.status; // findRequests converts with statusToDb
        res.json(await read.findRequests(filters, req.actor));
    } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
    try {
        const [found] = await read.findRequests({ id: req.params.id }, req.actor);
        if (!found) return res.status(404).json({ message: 'Request not found' });
        res.json(found);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const data = { ...req.body, requesterId: req.actor.user_id };
        res.status(201).json(await write.createRequest(data, req.actor));
    } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { to, comment } = req.body;
        res.json(await write.updateRequest(req.params.id, { status: to, comment }, req.actor));
    } catch (err) { next(err); }
};

exports.addNote = async (req, res, next) => {
    try {
        const { details } = req.body;
        const note = { details, category: 'INTERNAL', user_id: req.actor.user_id };
        res.json(await write.addNoteToRequest(req.params.id, note, req.actor));
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        res.status(201).json(await write.createRequest(req.body, req.actor));
    } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
    try {
        // Front end sends { to: 'ASSIGNED', comment: '...' }; the DB layer converts the status
        const { to, comment } = req.body;
        res.json(await write.updateRequest(req.params.id, { status: to, comment }, req.actor));
    } catch (err) { next(err); }
};

exports.addNote = async (req, res, next) => {
    try {
        res.json(await write.addNoteToRequest(req.params.id, { details: req.body.details, category: 'WORK', userId: req.actor.user_id }, req.actor));
    } catch (err) { next(err); }
};