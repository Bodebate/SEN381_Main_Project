const mongoose = require('mongoose');

const constUser = require('./mongo-schemas/User');
const constRequest = require('./mongo-schemas/Request');
const constRequestGroups = require('./mongo-schemas/Request-Group');
const constLog = require('./mongo-schemas/Log');
const constUserAuthorization = require('./mongo-schemas/User-Authorization');
const constEncryption = require("./Encription");

const { categories: CATEGORIES, departments: DEPARTMENTS } = require('../config/lookups');

// Import client DTO mappers
const {
    mapUserToClient,
    mapRequestToClient,
    mapRequestGroupToClient,
    mapLogToClient,
    mapAuthToClient,
    statusToDb
} = require('./utils/Mappers');

function encryptText(text) {
    return constEncryption.encryptText(text);
}

function decryptText(text) {
    if (!text) return null;
    return constEncryption.decryptText(text);
}

const toClientUser = u => u && mapUserToClient({
    ...(u.toObject ? u.toObject() : u),
    first_name: decryptText(u.first_name),
    last_name: decryptText(u.last_name),
    phone: decryptText(u.phone),
    whatsapp: decryptText(u.whatsapp),
});

/**
 * Utility to escape special regex characters to prevent Regex Injection and ReDoS.
 */
function escapeRegex(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[-[\]{}()*+?.^$|\\]/g, '\\$&');
}

/**
 * Parses query parameter values into explicit booleans, handling string representations correctly.
 */
function parseBoolean(val) {
    if (val === true || val === 'true') return true;
    if (val === false || val === 'false') return false;
    return undefined;
}

/**
 * Validates MongoDB ObjectIds and throws a 400 Bad Request error if invalid.
 */
function validateObjectId(id, fieldName = 'ID') {
    if (id !== undefined && id !== null && id !== '') {
        if (!mongoose.isValidObjectId(id)) {
            const err = new Error(`Bad Request: Invalid ${fieldName} format ("${id}").`);
            err.status = 400;
            throw err;
        }
    }
}

/**
 * Builds the MongoDB access control filter based on the actor's clearance, role, and work categories.
 */
function buildRequestAccessFilter(actor) {
    if (!actor) {
        return { _id: { $exists: false } };
    }

    const clearance = Number(actor.clearance) || 0;
    // Item 10.1: Grant managers full access by role
    if (clearance >= 5 || actor.isAdmin === true || actor.role === 'MANAGER' || actor.role === 'ADMIN') {
        return null;
    }

    const userId = actor.user_id ? new mongoose.Types.ObjectId(actor.user_id) : null;
    const workCategories = Array.isArray(actor.work_categories) ? actor.work_categories : [];

    const conditions = [];

    if (userId) {
        conditions.push({ requester: userId });
        conditions.push({ assigned_to: userId });
    }

    conditions.push({
        $and: [
            { security_level: { $lte: clearance } },
            { request_category: { $in: workCategories } }
        ]
    });

    // Item 10.2: Allow staff to see new, uncategorized Submitted requests for triage
    if (clearance >= 1 || ['STAFF', 'MANAGER', 'ADMIN'].includes(actor.role)) {
        conditions.push({
            $and: [
                { status: 'Submitted' },
                { $or: [
                        { request_category: { $exists: false } },
                        { request_category: { $size: 0 } }
                    ]}
            ]
        });
    }

    return { $or: conditions };
}

class DBRead {
    // =========================================================================
    // 1. USER READS
    // =========================================================================
    async findUserByIdentifier({ username, phone, whatsapp, email, firstName, lastName, clearance, inWorkCategories, allWorkCategories }, actor) {
        try {
            // Item 10.4: Require an actor and limit PII access to self or clearance >= 4
            if (!actor) {
                const err = new Error("Unauthorized: Actor authentication required to search user records.");
                err.status = 401;
                throw err;
            }

            const query = {};
            const actorClearance = Number(actor.clearance) || 0;

            if (actorClearance < 4) {
                const actorUserId = actor.user_id ? actor.user_id.toString() : null;
                if (!actorUserId) return [];
                query._id = new mongoose.Types.ObjectId(actorUserId);
            } else {
                if (username) query.username = username;
                if (email) query.email = email;
                if (clearance !== undefined && clearance !== null) query.clearance = Number(clearance);

                if (inWorkCategories && inWorkCategories.length > 0) {
                    query.work_categories = { $in: Array.isArray(inWorkCategories) ? inWorkCategories : [inWorkCategories] };
                } else if (allWorkCategories && allWorkCategories.length > 0) {
                    query.work_categories = { $all: Array.isArray(allWorkCategories) ? allWorkCategories : [allWorkCategories] };
                }

                if (phone) query.phone = encryptText(phone);
                if (whatsapp) query.whatsapp = encryptText(whatsapp);
                if (firstName) query.first_name = encryptText(firstName);
                if (lastName) query.last_name = encryptText(lastName);
            }

            if (Object.keys(query).length === 0) return null;

            const records = await constUser.find(query).lean();

            // Decrypt PII and map to client DTO format
            return records.map(toClientUser);
        } catch (err) {
            console.error("Error running secure user resolution read operations:", err);
            throw err;
        }
    }

    // =========================================================================
    // 2. REQUEST READS (Enforces Visibility Rules & Maps to Client DTO)
    // =========================================================================
    async findRequests({ id, groupId, title, securityLevel, priority, assignedTo, status, isOpen, requester }, actor) {
        try {
            validateObjectId(id, 'Request ID');
            validateObjectId(groupId, 'Group ID');
            validateObjectId(assignedTo, 'AssignedTo ID');
            validateObjectId(requester, 'Requester ID');

            const query = {};

            if (id) query._id = id;
            if (groupId) query.group_id = groupId;
            if (requester) query.requester = requester;
            if (title) query.title = { $regex: escapeRegex(title),$options: 'i' };
            if (securityLevel !== undefined && securityLevel !== null) query.security_level = Number(securityLevel);
            if (priority !== undefined && priority !== null) query.priority = Number(priority);
            if (assignedTo) query.assigned_to = assignedTo;
            if (status) query.status = statusToDb(status);

            const parsedIsOpen = parseBoolean(isOpen);
            if (parsedIsOpen !== undefined) {
                if (parsedIsOpen) {
                    query.status = { $nin: ['Resolved', 'Closed'] };
                } else {
                    query.status = { $in: ['Resolved', 'Closed'] };
                }
            }

            // Enforce D9 Visibility Rules
            const accessFilter = buildRequestAccessFilter(actor);
            if (accessFilter) {
                query.$and = query.$and ? [...query.$and, accessFilter] : [accessFilter];
            }

            const records = await constRequest.find(query).sort({ priority: -1, createdAt: -1 });

            // Map database records to camelCase client format
            return records.map(mapRequestToClient);
        } catch (err) {
            console.error("Error finding requests:", err);
            throw err;
        }
    }

    // =========================================================================
    // 3. REQUEST GROUPS READS (Enforces Group & Note Visibility Rules)
    // =========================================================================
    async findRequestGroups({ id, createdBy, status, primaryRequestId, title }, actor) {
        try {
            validateObjectId(id, 'Request Group ID');
            validateObjectId(createdBy, 'CreatedBy ID');
            validateObjectId(primaryRequestId, 'Primary Request ID');

            const query = {};

            if (id) query._id = id;
            if (createdBy) query.created_by = createdBy;
            if (status) query.status = status;
            if (primaryRequestId) query.primary_request_id = primaryRequestId;
            if (title) query.title = { $regex: escapeRegex(title),$options: 'i' };

            const clearance = Number(actor?.clearance) || 0;
            // Item 10.3: Tie request group visibility to the visibility of its primary request instead of blanket $exists check
            if (clearance < 5 && !actor?.isAdmin && !['MANAGER', 'ADMIN'].includes(actor?.role)) {
                const userId = actor?.user_id ? new mongoose.Types.ObjectId(actor.user_id) : null;
                if (userId) {
                    const accessFilter = buildRequestAccessFilter(actor);
                    let accessibleRequestIds = [];
                    if (accessFilter) {
                        const allowedRequests = await constRequest.find(accessFilter).select('_id').lean();
                        accessibleRequestIds = allowedRequests.map(r => r._id);
                    }
                    query.$or = [
                        { created_by: userId },
                        { primary_request_id: { $in: accessibleRequestIds } }
                    ];
                } else {
                    return [];
                }
            }

            const groups = await constRequestGroups.find(query);

            // Map database group documents to client DTO format
            return groups.map(mapRequestGroupToClient);
        } catch (err) {
            console.error("Error finding request groups:", err);
            throw err;
        }
    }

    // =========================================================================
    // 4. SYSTEM LOG READS
    // =========================================================================
    async findLogs({ logId, eventType, severity, actorId, username, targetEntityId, targetEntityType }, actor) {
        try {
            validateObjectId(logId, 'Log ID');
            validateObjectId(actorId, 'Actor ID');
            validateObjectId(targetEntityId, 'Target Entity ID');

            const clearance = Number(actor?.clearance) || 0;
            if (clearance < 4 && actor?.user_id?.toString() !== actorId?.toString()) {
                const err = new Error("Unauthorized: Insufficient clearance to view audit logs.");
                err.status = 403;
                throw err;
            }

            const query = {};

            if (logId) query.log_id = logId;
            if (eventType) query.event_type = eventType;
            if (severity) query.severity = severity;
            if (actorId) query['actor.user_id'] = actorId;
            if (username) query['actor.username'] = username;
            if (targetEntityId) query['target_entity.entity_id'] = targetEntityId;
            if (targetEntityType) query['target_entity.entity_type'] = targetEntityType;

            if (Object.keys(query).length === 0) return [];
            const logs = await constLog.find(query).sort({ timestamp: -1 });

            // Map database log documents to client DTO format
            return logs.map(mapLogToClient);
        } catch (err) {
            console.error("Error finding system logs:", err);
            throw err;
        }
    }

    // =========================================================================
    // 5. USER AUTHORIZATION READS
    // =========================================================================
    async findUserAuthorizations({ clearance, workCategories }, actor) {
        try {
            const clearanceLevel = Number(actor?.clearance) || 0;
            if (clearanceLevel < 4) {
                const err = new Error("Unauthorized: Insufficient clearance to view authorization profiles.");
                err.status = 403;
                throw err;
            }

            const query = {};

            if (clearance !== undefined && clearance !== null) query.clearance = Number(clearance);
            if (workCategories && workCategories.length > 0) {
                query.work_categories = { $in: Array.isArray(workCategories) ? workCategories : [workCategories] };
            }

            if (Object.keys(query).length === 0) return [];

            const auths = await constUserAuthorization.find(query).lean();

            // Map database auth documents to client DTO format
            return auths.map(mapAuthToClient);
        } catch (err) {
            console.error("Error finding user authorizations:", err);
            throw err;
        }
    }
    // =========================================================================
    // 6. ROUTING SUPPORT READS (login, profile, user lists, dashboard)
    // =========================================================================

    // Login runs before there is an actor, so this is the one read without an actor check.
    async findUserForLogin(username) {
        if (typeof username !== 'string' || !username.trim()) return null;
        const user = await constUser.findOne({ username: username.trim() }).lean();
        if (!user) return null;
        return { passwordHash: user.password_hash, user: toClientUser(user) };
    }

    async findUserById(id) {
        validateObjectId(id, 'User ID');
        if (!id) return null;
        return toClientUser(await constUser.findById(id).lean());
    }

    // GET /users (manager or admin)
    async listUsers({ approval } = {}, actor) {
        if (!actor || Number(actor.clearance) < 4) {
            throw new Error('Unauthorized: Clearance 4 is required to list users.');
        }
        const query = approval ? { approval_status: approval === 'DECLINED' ? 'REJECTED' : approval } : {};
        return (await constUser.find(query).sort({ createdAt: -1 }).lean()).map(toClientUser);
    }

    // GET /users/directory: names and roles only
    async findDirectory(actor) {
        if (!actor) throw new Error('Unauthorized: Sign in required.');
        const users = await constUser.find({ approval_status: 'APPROVED', is_active: true })
            .select('first_name last_name role').lean();
        return users.map(u => ({
            id: String(u._id),
            name: `${decryptText(u.first_name)} ${decryptText(u.last_name)}`,
            role: u.role ?? null,
        }));
    }

    // GET /users/assignable?departmentId=...
    async findAssignableStaff(departmentId, actor) {
        if (!actor) throw new Error('Unauthorized: Sign in required.');
        const query = { role: { $in: ['STAFF', 'MANAGER'] }, approval_status: 'APPROVED', is_active: true };
        if (departmentId) query.department = departmentId;
        return (await constUser.find(query).lean()).map(toClientUser);
    }

    // GET /reports/dashboard: same calculations as the Angular mock report API
    async getDashboard({ from, to, departmentId }, actor) {
        if (!actor || !['MANAGER', 'ADMIN'].includes(actor.role)) {
            throw new Error('Unauthorized: Only managers can view reports.');
        }
        const start = new Date(from);
        const end = new Date(to);
        if (isNaN(start) || isNaN(end)) {
            const err = new Error('Bad Request: from and to must be ISO dates.');
            err.status = 400;
            throw err;
        }

        const categoryOf = r => (r.request_category || [])[0] ?? null;
        const deptOf = r => CATEGORIES.find(c => c.id === categoryOf(r))?.departmentId ?? null;
        const catName = id => CATEGORIES.find(c => c.id === id)?.name ?? 'Uncategorised';
        const depName = id => DEPARTMENTS.find(d => d.id === id)?.name ?? 'Not yet routed';
        const now = new Date();
        const isOpen = r => !['Resolved', 'Closed'].includes(r.status);
        const isOverdue = r => isOpen(r) && r.due_date && r.due_date < now;
        const resolvedAt = r => [...(r.status_history || [])].reverse().find(h => h.to === 'Resolved')?.at ?? null;
        const inPeriod = d => !!d && d >= start && d <= end;
        const days = (a, b) => (b - a) / 864e5;
        const average = xs => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
        const countBy = (items, key) => {
            const m = new Map();
            items.forEach(r => m.set(key(r), (m.get(key(r)) || 0) + 1));
            return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
        };

        const all = (await constRequest.find({}).lean()).filter(r => !departmentId || deptOf(r) === departmentId);
        const received = all.filter(r => inPeriod(r.createdAt));
        const resolved = all.filter(r => inPeriod(resolvedAt(r)));
        const open = all.filter(isOpen);

        const staffUsers = await constUser.find({ role: 'STAFF', ...(departmentId ? { department: departmentId } : {}) }).lean();
        const staff = staffUsers.map(u => {
            const mine = all.filter(r => String(r.assigned_to) === String(u._id));
            const done = mine.filter(r => inPeriod(resolvedAt(r)));
            return {
                name: `${decryptText(u.first_name)} ${decryptText(u.last_name)}`,
                department: depName(u.department),
                openAssigned: mine.filter(isOpen).length,
                resolved: done.length,
                avgResolveDays: average(done.map(r => days(r.createdAt, resolvedAt(r)))),
                overdue: mine.filter(isOverdue).length,
            };
        });

        return {
            activeCount: open.length,
            overdueCount: all.filter(isOverdue).length,
            resolvedInPeriod: resolved.length,
            receivedInPeriod: received.length,
            resolutionRate: received.length ? Math.round((resolved.length / received.length) * 100) : 0,
            avgResolveDays: average(resolved.map(r => days(r.createdAt, resolvedAt(r)))),
            byStatus: ['Submitted', 'Assigned', 'In progress', 'Resolved', 'Closed']
                .map(s => ({ label: s, count: all.filter(r => r.status === s).length })),
            byCategory: countBy(open, r => catName(categoryOf(r))),
            byDepartment: countBy(open, r => depName(deptOf(r))).map(d => ({
                ...d,
                overdue: open.filter(r => depName(deptOf(r)) === d.label && isOverdue(r)).length,
            })),
            staff,
        };
    }
}

module.exports = DBRead;
