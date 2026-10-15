/**
 * Maps database User document (snake_case) to client DTO (camelCase).
 */
function mapUserToClient(user) {
    if (!user) return null;
    const obj = user.toObject ? user.toObject() : user;

    return {
        id: obj._id,
        username: obj.username,
        firstName: obj.first_name,
        lastName: obj.last_name,
        clearance: obj.clearance,
        workCategories: obj.work_categories || [],
        email: obj.email,
        phone: obj.phone, // decrypted if handled in read layer
        whatsapp: obj.whatsapp,
        role: obj.role,
        approvalStatus: obj.approval_status,
        verified: obj.verified,
        notificationPreference: obj.notification_preference,
        isActive: obj.is_active,
        department: obj.department,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
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
    if (data.active !== undefined) dbData.active = data.active;
    if (data.status !== undefined) dbData.status = statusToDb(data.status);
    if (data.notes !== undefined) dbData.notes = data.notes;

    return dbData;
}

/**
 * Maps database Request document (snake_case) to client DTO (camelCase).
 */
function mapRequestToClient(req) {
    if (!req) return null;
    const obj = req.toObject ? req.toObject() : req;

    const categories = obj.request_category || [];

    return {
        id: obj._id,
        trackingId: obj.tracking_id,
        groupId: obj.group_id,
        title: obj.title,
        details: obj.details,
        requester: obj.requester,
        requesterId: obj.requester,
        securityLevel: obj.security_level,
        categoryId: categories.length > 0 ? categories[0] : null,
        requestCategory: categories,
        priority: priorityToClient(obj.priority),
        dueAt: obj.due_date,
        dueDate: obj.due_date,
        assigneeId: obj.assigned_to,
        assignedTo: obj.assigned_to,
        address: obj.address,
        active: obj.active,
        status: statusToClient(obj.status),
        statusHistory: (obj.status_history || []).map(h => ({
            from: statusToClient(h.from),
            to: statusToClient(h.to),
            comment: h.comment,
            by: h.by,
            at: h.at
        })),
        notes: (obj.notes || []).map(n => ({
            noteId: n.note_id,
            id: n.note_id,
            details: n.details,
            category: n.category,
            userId: n.user_id,
            date: n.date,
            type: n.type || 'GENERAL',
            visibility: n.visibility || 'INTERNAL'
        })),
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
    };
}

/**
 * Maps database RequestGroup document to client DTO.
 */
function mapRequestGroupToClient(group) {
    if (!group) return null;
    const obj = group.toObject ? group.toObject() : group;

    return {
        id: obj._id,
        createdAt: obj.created_at,
        createdBy: obj.created_by,
        status: obj.status,
        title: obj.title,
        primaryRequestId: obj.primary_request_id,
        notes: (obj.notes || []).map(n => ({
            noteId: n.note_id,
            id: n.note_id,
            details: n.details,
            category: n.category,
            userId: n.user_id,
            date: n.date,
            type: n.type || 'GENERAL',
            visibility: n.visibility || 'INTERNAL'
        }))
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
    mapAuthToClient
};