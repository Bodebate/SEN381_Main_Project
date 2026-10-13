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
    if (data.securityLevel !== undefined) dbData.security_level = data.securityLevel;
    if (data.requestCategory !== undefined) dbData.request_category = data.requestCategory;
    if (data.priority !== undefined) dbData.priority = data.priority;
    if (data.dueAt !== undefined) dbData.due_date = data.dueAt;
    if (data.dueDate !== undefined) dbData.due_date = data.dueDate; // Fallback alias
    if (data.assigneeId !== undefined) dbData.assigned_to = data.assigneeId;
    if (data.assignedTo !== undefined) dbData.assigned_to = data.assignedTo; // Fallback alias
    if (data.address !== undefined) dbData.address = data.address;
    if (data.active !== undefined) dbData.active = data.active;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.notes !== undefined) dbData.notes = data.notes;

    return dbData;
}

/**
 * Maps database Request document (snake_case) to client DTO (camelCase).
 */
function mapRequestToClient(req) {
    if (!req) return null;
    const obj = req.toObject ? req.toObject() : req;

    return {
        id: obj._id,
        trackingId: obj.tracking_id,
        groupId: obj.group_id,
        title: obj.title,
        details: obj.details,
        requester: obj.requester,
        securityLevel: obj.security_level,
        requestCategory: obj.request_category || [],
        priority: obj.priority,
        dueAt: obj.due_date,
        assigneeId: obj.assigned_to,
        address: obj.address,
        active: obj.active,
        resolved: obj.resolved,
        closed: obj.closed,
        status: obj.status,
        statusHistory: (obj.status_history || []).map(h => ({
            from: h.from,
            to: h.to,
            comment: h.comment,
            by: h.by,
            at: h.at
        })),
        notes: (obj.notes || []).map(n => ({
            noteId: n.note_id,
            details: n.details,
            category: n.category,
            userId: n.user_id,
            date: n.date
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
            details: n.details,
            category: n.category,
            userId: n.user_id,
            date: n.date
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
    mapUserToClient,
    mapRequestToDb,
    mapRequestToClient,
    mapRequestGroupToClient,
    mapLogToClient,
    mapAuthToClient
};