const { categories: CATEGORIES } = require('../../config/lookups');

/**
 * Maps database User document (snake_case) to client DTO (camelCase).
 */
const APPROVAL_TO_CLIENT = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'DECLINED' };
const APPROVAL_TO_DB = { APPROVE: 'APPROVED', DECLINE: 'REJECTED' };

function mapUserToClient(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : user;
    return {
        id: String(obj._id),
        username: obj.username,
        firstName: obj.first_name,
        lastName: obj.last_name,
        role: obj.role ?? null,
        clearance: obj.clearance ?? 0,
        departmentId: obj.department ?? null,
        workCategoryIds: obj.work_categories || [],
        email: obj.email ?? null,
        phone: obj.phone ?? null,
        notifyVia: obj.notification_preference || 'EMAIL',
        verified: Boolean(obj.verified),
        approval: APPROVAL_TO_CLIENT[obj.approval_status] || 'PENDING',
        approvedBy: obj.approved_by ? String(obj.approved_by) : null,
        approvedAt: obj.approved_at ?? null,
        decisionNote: obj.decision_note ?? null,
        isActive: obj.is_active !== false,
        createdAt: obj.createdAt,
    };
}

/**
 * Helper to map database status to front-end uppercase status enums.
 */
function statusToClient(status) {
    if (!status) return 'SUBMITTED';
    const map = {
        'Submitted': 'SUBMITTED',
        'Assigned': 'ASSIGNED',
        'In progress': 'IN_PROGRESS',
        'Resolved': 'RESOLVED',
        'Closed': 'CLOSED'
    };
    return map[status] || status.toUpperCase().replace(/\s+/g, '_');
}

/**
 * Helper to map front-end uppercase status enums to database status format.
 */
function statusToDb(status) {
    if (!status) return 'Submitted';
    const map = {
        'SUBMITTED': 'Submitted',
        'ASSIGNED': 'Assigned',
        'IN_PROGRESS': 'In progress',
        'RESOLVED': 'Resolved',
        'CLOSED': 'Closed'
    };
    return map[status] || status;
}

/**
 * Helper to map database numeric priority to front-end string priority enums.
 */
function priorityToClient(priority) {
    if (priority === 0 || priority === '0' || priority === 'LOW') return 'LOW';
    if (priority === 1 || priority === '1' || priority === 'MEDIUM') return 'MEDIUM';
    if (priority === 2 || priority === '2' || priority === 'HIGH') return 'HIGH';
    return priority !== undefined && priority !== null ? String(priority).toUpperCase() : null;
}

/**
 * Helper to map front-end string priority enums to database numeric format.
 */
function priorityToDb(priority) {
    if (priority === 'LOW') return 0;
    if (priority === 'MEDIUM') return 1;
    if (priority === 'HIGH') return 2;
    return priority !== undefined && priority !== null ? Number(priority) : 0;
}

/**
 * Maps client Request payload (camelCase) to database schema format (snake_case).
 */
function mapRequestToDb(data) {
    if (!data) return {};
    const dbData = {};

    if (data.trackingId !== undefined) dbData.tracking_id = data.trackingId;
    if (data.groupId !== undefined) dbData.group_id = data.groupId;
    if (data.title !== undefined) dbData.title = data.title;
    if (data.details !== undefined) dbData.details = data.details;

    if (data.requester !== undefined) dbData.requester = data.requester;
    if (data.requesterId !== undefined) dbData.requester = data.requesterId;

    if (data.securityLevel !== undefined) dbData.security_level = data.securityLevel;

    if (data.requestCategory !== undefined) {
        dbData.request_category = data.requestCategory;
    } else if (data.categoryId !== undefined) {
        dbData.request_category = data.categoryId ? [data.categoryId] : [];
    }

    if (data.priority !== undefined) dbData.priority = priorityToDb(data.priority);
    if (data.dueAt !== undefined) dbData.due_date = data.dueAt;
    if (data.dueDate !== undefined) dbData.due_date = data.dueDate;

    if (data.assigneeId !== undefined) dbData.assigned_to = data.assigneeId;
    if (data.assignedTo !== undefined) dbData.assigned_to = data.assignedTo;

    if (data.address !== undefined) dbData.address = data.address;
    if (data.contact !== undefined) {
        dbData.contact_email = data.contact?.email ?? null;
        dbData.contact_phone = data.contact?.phone ?? null;
    }
    if (data.resolutionOutcome !== undefined) dbData.resolution_outcome = data.resolutionOutcome;
    if (data.active !== undefined) dbData.active = data.active;
    if (data.status !== undefined) dbData.status = statusToDb(data.status);
    if (data.notes !== undefined) dbData.notes = data.notes;

    return dbData;
}

const NOTE_TYPES = ['WORK', 'COMMENT', 'ASSIGNMENT', 'SYSTEM'];
const str = v => (v == null ? null : String(v));

/**
 * Maps database Request document (snake_case) to the ServiceRequest model in
 * views/src/app/core/models/request.model.ts.
 */
function mapRequestToClient(req) {
    if (!req) return null;
    const obj = req.toObject ? req.toObject() : req;
    const categoryId = (obj.request_category || [])[0] ?? null;
    const history = obj.status_history || [];
    const lastTo = s => [...history].reverse().find(h => h.to === s);
    const resolved = lastTo('Resolved');
    const closed = lastTo('Closed');

    return {
        id: String(obj._id),
        trackingId: obj.tracking_id,
        title: obj.title ?? '',
        details: obj.details,
        address: obj.address,
        contact: { email: obj.contact_email ?? null, phone: obj.contact_phone ?? null },
        requesterIds: obj.requester ? [String(obj.requester)] : [],
        categoryId,
        departmentId: CATEGORIES.find(c => c.id === categoryId)?.departmentId ?? null,
        securityLevel: obj.security_level ?? null,
        priority: categoryId ? priorityToClient(obj.priority) : null,   // untriaged = no priority yet
        status: statusToClient(obj.status),
        active: obj.active !== false,
        groupId: str(obj.group_id),
        assignedTo: str(obj.assigned_to),
        assignedBy: null,       // not stored yet
        assignedAt: null,
        categorisedBy: null,
        dueAt: obj.due_date ?? null,
        dueSetBy: null,
        resolvedAt: resolved?.at ?? null,
        resolvedBy: str(resolved?.by),
        resolutionOutcome: obj.resolution_outcome ?? null,
        closedAt: closed?.at ?? null,
        closedBy: str(closed?.by),
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        notes: (obj.notes || []).map(n => ({
            id: String(n.note_id),
            type: NOTE_TYPES.includes(n.category) ? n.category : 'WORK',
            visibility: n.visibility || 'INTERNAL',
            details: n.details,
            userId: String(n.user_id),
            date: n.date,
        })),
        statusHistory: history.map(h => ({
            from: h.from ? statusToClient(h.from) : null,
            to: statusToClient(h.to),
            by: String(h.by),
            at: h.at,
            comment: h.comment,
            notifyRequester: Boolean(h.notify_requester),
        })),
    };
}

/**
 * Maps database RequestGroup document to the RequestGroup model.
 */
function mapRequestGroupToClient(group) {
    if (!group) return null;
    const obj = group.toObject ? group.toObject() : group;
    return {
        id: String(obj._id),
        title: obj.title ?? '',
        departmentId: null,                 // groups don't store a department yet
        createdBy: str(obj.created_by),
        createdAt: obj.created_at,
    };
}

/**
 * Maps database Log document to client DTO.
 */
function mapLogToClient(log) {
    if (!log) return null;
    const obj = log.toObject ? log.toObject() : log;

    return {
        id: obj._id,
        logId: obj.log_id,
        timestamp: obj.timestamp,
        eventType: obj.event_type,
        severity: obj.severity,
        actor: obj.actor ? {
            userId: obj.actor.user_id,
            username: obj.actor.username,
            clearanceAtTime: obj.actor.clearance_at_time,
            ipAddress: obj.actor.ip_address
        } : null,
        targetEntity: obj.target_entity ? {
            entityType: obj.target_entity.entity_type,
            entityId: obj.target_entity.entity_id
        } : null,
        action: obj.action,
        changes: obj.changes ? {
            field: obj.changes.field,
            oldValue: obj.changes.old_value,
            newValue: obj.changes.new_value
        } : null,
        metadata: obj.metadata
    };
}

/**
 * Maps database UserAuthorization document to client DTO.
 */
function mapAuthToClient(auth) {
    if (!auth) return null;
    const obj = auth.toObject ? auth.toObject() : auth;

    return {
        id: obj._id,
        userId: obj.user_id,
        clearance: obj.clearance,
        workCategories: obj.work_categories || [],
        reviewedBy: obj.reviewed_by,
        acceptedDate: obj.AcceptedDate
    };
}

module.exports = {
    statusToDb,
    mapUserToClient,
    mapRequestToDb,
    mapRequestToClient,
    mapRequestGroupToClient,
    mapLogToClient,
    mapAuthToClient,
    APPROVAL_TO_DB,
};