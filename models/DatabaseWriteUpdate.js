const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const constEncryption = require('./Encription');

// Imported models
const constUser = require('./mongo-schemas/User');
const constRequest = require('./mongo-schemas/Request');
const constRequestGroups = require('./mongo-schemas/Request-Group');
const constLog = require('./mongo-schemas/Log');
const constUserAuthorization = require('./mongo-schemas/User-Authorization');

// Client DTO Mappers
const {
    mapUserToClient,
    mapRequestToDb,
    mapRequestToClient,
    mapRequestGroupToClient,
    mapAuthToClient
} = require('./utils/Mappers');

function encryptText(text) {
    return constEncryption.encryptText(text);
}
function decryptText(text){
    if(!text) return null;
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
 * Validates and normalizes a phone number to E.164 format.
 */
function normalizeToE164(phoneInput) {
    if (!phoneInput) return null;
    let cleaned = String(phoneInput).trim().replace(/[\s()-]/g, '');

    if (/^0[1-9][0-9]{8}$/.test(cleaned)) {
        cleaned = '+27' + cleaned.substring(1);
    }

    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(cleaned)) {
        throw new Error(`Invalid phone format: "${phoneInput}". Must be in valid E.164 format (e.g., +27821234567).`);
    }

    return cleaned;
}

// Request status progression sequence rule (FR-STF-005)
const REQUEST_STATUS_SEQUENCE = ['Submitted', 'Assigned', 'In progress', 'Resolved', 'Closed'];

function validateStatusTransition(currentStatus, nextStatus) {
    if (!nextStatus || currentStatus === nextStatus) return true;
    const currentIndex = REQUEST_STATUS_SEQUENCE.indexOf(currentStatus);
    const nextIndex = REQUEST_STATUS_SEQUENCE.indexOf(nextStatus);
    return nextIndex === currentIndex + 1;
}

class DBUpdateWrite {
    // =========================================================================
    // HELPER: SYSTEM AUDIT LOGGING ENGINE
    // =========================================================================
    async createAuditLog({ eventType, severity, actor, targetEntity, action, oldFields, newFields }) {
        const trackedFields = [
            'clearance', 'notes', 'security_level', 'priority',
            'assigned_to', 'work_categories', 'status', 'role',
            'approval_status', 'is_active', 'due_date'
        ];

        for (const field of trackedFields) {
            const oldVal = oldFields ? oldFields[field] : undefined;
            const newVal = newFields ? newFields[field] : undefined;

            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                try {
                    let formattedOldVal = null;
                    let formattedNewVal = null;

                    if (field === 'notes') {
                        const formatNotes = (notesArr) => {
                            if (!Array.isArray(notesArr)) return [];
                            return notesArr.map(n => ({
                                note_id: n.note_id,
                                details: n.details
                            }));
                        };
                        formattedOldVal = oldVal ? JSON.stringify(formatNotes(oldVal)) : null;
                        formattedNewVal = newVal ? JSON.stringify(formatNotes(newVal)) : null;
                    } else if (Array.isArray(oldVal) || Array.isArray(newVal) || (typeof oldVal === 'object' && oldVal !== null) || (typeof newVal === 'object' && newVal !== null)) {
                        formattedOldVal = oldVal !== undefined ? JSON.stringify(oldVal) : null;
                        formattedNewVal = newVal !== undefined ? JSON.stringify(newVal) : null;
                    } else {
                        formattedOldVal = oldVal !== undefined ? String(oldVal) : null;
                        formattedNewVal = newVal !== undefined ? String(newVal) : null;
                    }

                    const actorUserId = actor?.user_id ? new mongoose.Types.ObjectId(actor.user_id) : null;

                    await constLog.create({
                        log_id: new mongoose.Types.ObjectId(),
                        timestamp: new Date(),
                        event_type: eventType,
                        severity: severity,
                        actor: {
                            user_id: actorUserId,
                            username: actor?.username || 'SYSTEM',
                            clearance_at_time: actor?.clearance || 0,
                            ip_address: actor?.ip_address || null
                        },
                        target_entity: targetEntity,
                        action: `${action} (Field '${field}' modified)`,
                        changes: {
                            field: field,
                            old_value: formattedOldVal,
                            new_value: formattedNewVal
                        }
                    });
                } catch (logErr) {
                    console.error("Failed to write audit log document:", logErr);
                }
            }
        }
    }

    // =========================================================================
    // 1. USER WRITES & UPDATES
    // =========================================================================
    async createUser(userData, actor) {
        try {
            const firstName = userData.firstName || userData.first_name;
            const lastName = userData.lastName || userData.last_name;

            const allowedData = {
                username: userData.username,
                password: userData.password,
                first_name: firstName,
                last_name: lastName,
                email: userData.email,
                work_categories: userData.workCategories || userData.work_categories || [],
                department: userData.department || null,
                notification_preference: userData.notificationPreference || userData.notification_preference || 'EMAIL',
                role: null,
                approval_status: 'PENDING',
                verified: false,
                is_active: true
            };

            if (userData.phone) allowedData.phone = encryptText(normalizeToE164(userData.phone));
            if (userData.whatsapp) allowedData.whatsapp = encryptText(normalizeToE164(userData.whatsapp));

            const requestedClearance = Number(userData.clearance) || 0;
            if (requestedClearance > 0) {
                if (!actor || actor.clearance < 4) {
                    throw new Error("Unauthorized: Actor lacks administrative clearance to assign user clearance levels.");
                }
                allowedData.clearance = requestedClearance;
            } else {
                allowedData.clearance = 0;
            }

            const securedData = { ...allowedData };
            if (securedData.password) securedData.password_hash = await bcrypt.hash(securedData.password, 12);
            delete securedData.password;

            if (securedData.first_name) securedData.first_name = encryptText(securedData.first_name);
            if (securedData.last_name) securedData.last_name = encryptText(securedData.last_name);

            const newUser = await constUser.create(securedData);

            await this.createAuditLog({
                eventType: "USER_AUTH",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "USER", entity_id: newUser._id },
                action: "User account registered (Pending Approval)",
                oldFields: {},
                newFields: newUser
            });

            return toClientUser(newUser);
        } catch (err) {
            console.error("Error creating user:", err);
            throw err;
        }
    }

    async updateUser(userId, updateData, actor) {
        try {
            const allowedUpdates = {};

            const firstName = updateData.firstName || updateData.first_name;
            const lastName = updateData.lastName || updateData.last_name;

            if (updateData.password !== undefined) allowedUpdates.password = updateData.password;
            if (firstName !== undefined) allowedUpdates.first_name = firstName;
            if (lastName !== undefined) allowedUpdates.last_name = lastName;
            if (updateData.email !== undefined) allowedUpdates.email = updateData.email;
            if (updateData.workCategories !== undefined) allowedUpdates.work_categories = updateData.workCategories;
            if (updateData.work_categories !== undefined) allowedUpdates.work_categories = updateData.work_categories;
            if (updateData.notificationPreference !== undefined) allowedUpdates.notification_preference = updateData.notificationPreference;
            if (updateData.notification_preference !== undefined) allowedUpdates.notification_preference = updateData.notification_preference;
            if (updateData.department !== undefined) allowedUpdates.department = updateData.department;
            if (updateData.isActive !== undefined) allowedUpdates.is_active = updateData.isActive;
            if (updateData.is_active !== undefined) allowedUpdates.is_active = updateData.is_active;

            if (updateData.phone !== undefined) {
                allowedUpdates.phone = updateData.phone ? encryptText(normalizeToE164(updateData.phone)) : null;
            }
            if (updateData.whatsapp !== undefined) {
                allowedUpdates.whatsapp = updateData.whatsapp ? encryptText(normalizeToE164(updateData.whatsapp)) : null;
            }

            const approvalStatus = updateData.approvalStatus || updateData.approval_status;
            const isPrivilegedUpdate =
                updateData.role !== undefined ||
                approvalStatus !== undefined ||
                updateData.clearance !== undefined ||
                updateData.verified !== undefined;

            if (isPrivilegedUpdate) {
                if (!actor || actor.clearance < 4) {
                    throw new Error("Unauthorized: Administrative clearance (>= 4) is required to modify user roles, approval statuses, or clearance tiers.");
                }
                if (updateData.role !== undefined) allowedUpdates.role = updateData.role;
                if (approvalStatus !== undefined) allowedUpdates.approval_status = approvalStatus;
                if (updateData.clearance !== undefined) allowedUpdates.clearance = Number(updateData.clearance);
                if (updateData.verified !== undefined) allowedUpdates.verified = Boolean(updateData.verified);
            }

            const securedUpdates = { ...allowedUpdates };
            if (securedUpdates.password) {
                securedUpdates.password_hash = await bcrypt.hash(securedUpdates.password, 12);
                delete securedUpdates.password;
            }
            if (securedUpdates.first_name) securedUpdates.first_name = encryptText(securedUpdates.first_name);
            if (securedUpdates.last_name) securedUpdates.last_name = encryptText(securedUpdates.last_name);

            const oldUser = await constUser.findById(userId).lean();
            if (!oldUser) throw new Error(`User with ID ${userId} not found.`);

            // FR-STF-005: Pass runValidators: true
            const updatedUser = await constUser.findByIdAndUpdate(userId, securedUpdates, { new: true, runValidators: true }).lean();

            await this.createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "WARNING",
                actor,
                targetEntity: { entity_type: "USER", entity_id: userId },
                action: "User account properties updated",
                oldFields: oldUser,
                newFields: updatedUser
            });

            return toClientUser(updatedUser);
        } catch (err) {
            console.error("Error updating user:", err);
            throw err;
        }
    }

    // =========================================================================
    // 2. REQUEST WRITES & UPDATES
    // =========================================================================
    async createRequest(requestData, actor) {
        try {
            const sanitizedData = mapRequestToDb(requestData);

            const initialComment = requestData.statusComment || requestData.status_comment || requestData.comment || "Initial request submission.";
            const actorId = actor?.user_id ? new mongoose.Types.ObjectId(actor.user_id) : sanitizedData.requester;

            if (!actorId) {
                throw new Error("Validation Error: A user ID or requester ID is required to record request history.");
            }

            // Accept only title, details, address (and contact details); force staff fields to defaults
            const allowedRequest = {
                tracking_id: sanitizedData.tracking_id,
                group_id: null,
                title: sanitizedData.title,
                details: sanitizedData.details,
                requester: actorId,
                security_level: 0,
                request_category: [],
                priority: 0,
                due_date: null,
                assigned_to: null,
                address: sanitizedData.address,
                active: sanitizedData.active !== undefined ? sanitizedData.active : true,
                status: 'Submitted',
                status_history: [{
                    from: null,
                    to: 'Submitted',
                    comment: initialComment,
                    by: actorId,
                    at: new Date()
                }]
            };

            const newRequest = await constRequest.create(allowedRequest);

            await this.createAuditLog({
                eventType: "REQUEST_LIFECYCLE",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "REQUEST", entity_id: newRequest._id },
                action: "New task request initialised with status 'Submitted'",
                oldFields: {},
                newFields: newRequest
            });

            return mapRequestToClient(newRequest);
        } catch (err) {
            console.error("Error creating request:", err);
            throw err;
        }
    }

    async updateRequest(requestId, updateData, actor) {
        try {
            const sanitizedUpdates = mapRequestToDb(updateData);

            const oldRequest = await constRequest.findById(requestId).lean();
            if (!oldRequest) throw new Error(`Request with ID ${requestId} not found.`);

            const allowedUpdates = {};
            // Removed 'requester' and resolved/closed from allowed fields
            const allowedFields = [
                'group_id', 'title', 'details', 'priority',
                'address', 'active'
            ];

            for (const field of allowedFields) {
                if (sanitizedUpdates[field] !== undefined) {
                    allowedUpdates[field] = sanitizedUpdates[field];
                }
            }

            // Handle privileged fields update check (Staff or managers only, clearance >= 1)
            const isPrivilegedRequestUpdate =
                sanitizedUpdates.security_level !== undefined ||
                sanitizedUpdates.assigned_to !== undefined ||
                sanitizedUpdates.due_date !== undefined ||
                sanitizedUpdates.request_category !== undefined;

            if (isPrivilegedRequestUpdate) {
                if (!actor || Number(actor.clearance) < 1) {
                    throw new Error("Unauthorized: Staff or manager clearance is required to modify security level, assignment, due date, or request categories.");
                }
                if (sanitizedUpdates.security_level !== undefined) allowedUpdates.security_level = sanitizedUpdates.security_level;
                if (sanitizedUpdates.assigned_to !== undefined) allowedUpdates.assigned_to = sanitizedUpdates.assigned_to;
                if (sanitizedUpdates.due_date !== undefined) allowedUpdates.due_date = sanitizedUpdates.due_date;
                if (sanitizedUpdates.request_category !== undefined) allowedUpdates.request_category = sanitizedUpdates.request_category;
            }

            // if (updateData.status && updateData.status !== oldRequest.status) {
            //     // Enforce strict next step transition order
            //     if (!validateStatusTransition(oldRequest.status, updateData.status)) {
            //         throw new Error(`Validation Error: Invalid status transition from '${oldRequest.status}' to '${updateData.status}'. Allowed sequence is Submitted → Assigned → In progress → Resolved → Closed.`);
            //     }
            //
            //     const comment = updateData.statusComment || updateData.status_comment || updateData.comment;
            //     if (!comment || typeof comment !== 'string' || comment.trim() === '') {
            //         throw new Error(`Validation Error: A mandatory comment is required when changing request status from '${oldRequest.status}' to '${updateData.status}'.`);
            //     }
            //
            //     const actorId = actor?.user_id ? new mongoose.Types.ObjectId(actor.user_id) : null;
            //     if (!actorId) {
            //         throw new Error("Unauthorized: Actor identification is required to modify request status.");
            //     }
            //
            //     allowedUpdates.status = updateData.status;
            //
            //     const historyEntry = {
            //         from: oldRequest.status,
            //         to: updateData.status,
            //         comment: comment.trim(),
            //         by: actorId,
            //         at: new Date()
            //     };
            //
            //     // FR-STF-005: Pass runValidators: true
            //     const updatedRequest = await constRequest.findByIdAndUpdate(
            //         requestId,
            //         {
            //             $set: allowedUpdates,$push: { status_history: historyEntry }
            //         },
            //         { new: true, runValidators: true }
            //     ).lean();
            //
            //     await this.createAuditLog({
            //         eventType: "REQUEST_LIFECYCLE",
            //         severity: "INFO",
            //         actor,
            //         targetEntity: { entity_type: "REQUEST", entity_id: requestId },
            //         action: `Request status transitioned from '${oldRequest.status}' to '${updateData.status}'`,
            //         oldFields: oldRequest,
            //         newFields: updatedRequest
            //     });
            //
            //     return mapRequestToClient(updatedRequest);
            //}
            // Converted by mapRequestToDb, e.g. 'ASSIGNED' → 'Assigned'
            const newStatus = sanitizedUpdates.status;

            if (newStatus && newStatus !== oldRequest.status) {
                // Only staff, managers and admins may change a request's status (FR-STF-005)
                const isStaffActor = ['STAFF', 'MANAGER', 'ADMIN'].includes(actor?.role) || Number(actor?.clearance) >= 1;
                if (!isStaffActor) {
                    throw new Error("Unauthorized: Only staff or managers can change a request's status.");
                }

                // Enforce strict next step transition order
                if (!validateStatusTransition(oldRequest.status, newStatus)) {
                    throw new Error(`Validation Error: Invalid status transition from '${oldRequest.status}' to '${newStatus}'. Allowed sequence is Submitted → Assigned → In progress → Resolved → Closed.`);
                }

                const comment = updateData.statusComment || updateData.status_comment || updateData.comment;
                if (!comment || typeof comment !== 'string' || comment.trim() === '') {
                    throw new Error(`Validation Error: A mandatory comment is required when changing request status from '${oldRequest.status}' to '${newStatus}'.`);
                }

                const actorId = actor?.user_id ? new mongoose.Types.ObjectId(actor.user_id) : null;
                if (!actorId) {
                    throw new Error("Unauthorized: Actor identification is required to modify request status.");
                }

                allowedUpdates.status = newStatus;

                const historyEntry = {
                    from: oldRequest.status,
                    to: newStatus,
                    comment: comment.trim(),
                    by: actorId,
                    at: new Date()
                };

                // FR-STF-005: Pass runValidators: true
                const updatedRequest = await constRequest.findByIdAndUpdate(
                    requestId,
                    {
                        $set: allowedUpdates,
                        $push: { status_history: historyEntry }
                    },
                    { new: true, runValidators: true }
                ).lean();

                await this.createAuditLog({
                    eventType: "REQUEST_LIFECYCLE",
                    severity: "INFO",
                    actor,
                    targetEntity: { entity_type: "REQUEST", entity_id: requestId },
                    action: `Request status transitioned from '${oldRequest.status}' to '${newStatus}'`,
                    oldFields: oldRequest,
                    newFields: updatedRequest
                });

                return mapRequestToClient(updatedRequest);
            }

            // FR-STF-005: Pass runValidators: true
            const updatedRequest = await constRequest.findByIdAndUpdate(requestId, allowedUpdates, { new: true, runValidators: true }).lean();

            let eventType = "REQUEST_LIFECYCLE";
            if (updateData.notes) eventType = "NOTE_CREATED";

            await this.createAuditLog({
                eventType,
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "REQUEST", entity_id: requestId },
                action: "Task request properties modified",
                oldFields: oldRequest,
                newFields: updatedRequest
            });

            return mapRequestToClient(updatedRequest);
        } catch (err) {
            console.error("Error updating request:", err);
            throw err;
        }
    }

    async addNoteToRequest(requestId, { details, category, userId, user_id }, actor) {
        try {
            const resolvedUserId = user_id || userId;
            const newNote = {
                note_id: new mongoose.Types.ObjectId(),
                details: details,
                category: category,
                user_id: new mongoose.Types.ObjectId(resolvedUserId),
                date: new Date()
            };

            const oldRequest = await constRequest.findById(requestId).lean();
            if (!oldRequest) {
                throw new Error(`Request document with ID ${requestId} not found.`);
            }

            // FR-STF-005: Pass runValidators: true
            const updatedRequest = await constRequest.findByIdAndUpdate(
                requestId,
                { $push: { notes: newNote } },
                { new: true, runValidators: true }
            ).lean();

            await this.createAuditLog({
                eventType: "NOTE_CREATED",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "REQUEST", entity_id: requestId },
                action: "Appended new contextual note item to request file stack",
                oldFields: oldRequest,
                newFields: updatedRequest
            });

            return mapRequestToClient(updatedRequest);
        } catch (err) {
            console.error("Error appending subdocument note to request object:", err);
            throw err;
        }
    }

    // =========================================================================
    // 3. REQUEST GROUPS WRITES & UPDATES
    // =========================================================================
    async addNoteToRequestGroup(groupId, { details, category, userId, user_id }, actor) {
        try {
            const resolvedUserId = user_id || userId;
            const newNote = {
                note_id: new mongoose.Types.ObjectId(),
                details: details,
                category: category,
                user_id: new mongoose.Types.ObjectId(resolvedUserId),
                date: new Date()
            };

            const oldGroup = await constRequestGroups.findById(groupId).lean();
            if (!oldGroup) {
                throw new Error(`Request Group document with ID ${groupId} not found.`);
            }

            // FR-STF-005: Pass runValidators: true
            const updatedGroup = await constRequestGroups.findByIdAndUpdate(
                groupId,
                { $push: { notes: newNote } },
                { new: true, runValidators: true }
            ).lean();

            await this.createAuditLog({
                eventType: "NOTE_CREATED",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "GROUP", entity_id: groupId },
                action: "Appended new contextual note item to request group cluster",
                oldFields: oldGroup,
                newFields: updatedGroup
            });

            return mapRequestGroupToClient(updatedGroup);
        } catch (err) {
            console.error("Error appending subdocument note to request group object:", err);
            throw err;
        }
    }

    async createRequestGroup(groupData, actor) {
        try {
            const createdBy = groupData.createdBy || groupData.created_by;
            const primaryRequestId = groupData.primaryRequestId || groupData.primary_request_id;

            const allowedGroup = {
                created_at: groupData.createdAt || groupData.created_at || new Date(),
                created_by: createdBy,
                status: groupData.status || 'ACTIVE',
                title: groupData.title,
                primary_request_id: primaryRequestId || null
            };

            const newGroup = await constRequestGroups.create(allowedGroup);

            await this.createAuditLog({
                eventType: "GROUP_ASSIGNED",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "GROUP", entity_id: newGroup._id },
                action: "Request pipeline cluster tracking created",
                oldFields: {},
                newFields: newGroup
            });

            return mapRequestGroupToClient(newGroup);
        } catch (err) {
            console.error("Error creating request group:", err);
            throw err;
        }
    }

    async updateRequestGroup(groupId, updateData, actor) {
        try {
            const primaryRequestId = updateData.primaryRequestId || updateData.primary_request_id;

            const allowedUpdates = {};
            if (updateData.title !== undefined) allowedUpdates.title = updateData.title;
            if (updateData.status !== undefined) allowedUpdates.status = updateData.status;
            if (primaryRequestId !== undefined) allowedUpdates.primary_request_id = primaryRequestId;

            const oldGroup = await constRequestGroups.findById(groupId).lean();
            if (!oldGroup) throw new Error(`Request Group with ID ${groupId} not found.`);

            // FR-STF-005: Pass runValidators: true
            const updatedGroup = await constRequestGroups.findByIdAndUpdate(groupId, allowedUpdates, { new: true, runValidators: true }).lean();

            await this.createAuditLog({
                eventType: updateData.notes ? "NOTE_CREATED" : "GROUP_ASSIGNED",
                severity: "INFO",
                actor,
                targetEntity: { entity_type: "GROUP", entity_id: groupId },
                action: "Request structural cluster properties modified",
                oldFields: oldGroup,
                newFields: updatedGroup
            });

            return mapRequestGroupToClient(updatedGroup);
        } catch (err) {
            console.error("Error updating request group:", err);
            throw err;
        }
    }

    // =========================================================================
    // 4. USER AUTHORIZATION WRITES & UPDATES
    // =========================================================================
    async createUserAuthorization(authData, actor) {
        try {
            if (!actor || actor.clearance < 4) {
                throw new Error("Unauthorized: Only high-clearance administrative actors can create authorization profiles.");
            }

            const userId = authData.userId || authData.user_id;
            const workCategories = authData.workCategories || authData.work_categories;

            const allowedAuth = {
                user_id: userId,
                clearance: authData.clearance,
                work_categories: workCategories,
                reviewed_by: actor.user_id,
                AcceptedDate: new Date()
            };

            const newAuth = await constUserAuthorization.create(allowedAuth);

            await this.createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: { entity_type: "USER", entity_id: newAuth._id },
                action: "Global workspace permission profile authorized",
                oldFields: {},
                newFields: newAuth
            });
            return mapAuthToClient(newAuth);
        } catch (err) {
            console.error("Error creating user authorization profile:", err);
            throw err;
        }
    }

    async updateUserAuthorization(clearanceLevel, updateData, actor) {
        try {
            if (!actor || actor.clearance < 4) {
                throw new Error("Unauthorized: Only administrative actors can modify authorization profiles.");
            }

            const workCategories = updateData.workCategories || updateData.work_categories;

            const allowedUpdates = {};
            if (workCategories !== undefined) allowedUpdates.work_categories = workCategories;
            if (updateData.clearance !== undefined) allowedUpdates.clearance = updateData.clearance;
            allowedUpdates.reviewed_by = actor.user_id;
            allowedUpdates.AcceptedDate = new Date();

            const oldAuth = await constUserAuthorization.findOne({ clearance: Number(clearanceLevel) }).lean();
            if (!oldAuth) throw new Error(`Authorization profile for clearance ${clearanceLevel} not found.`);

            // FR-STF-005: Pass runValidators: true
            const updatedAuth = await constUserAuthorization.findOneAndUpdate(
                { clearance: Number(clearanceLevel) },
                allowedUpdates,
                { new: true, runValidators: true }
            ).lean();

            await this.createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: { entity_type: "USER", entity_id: oldAuth?._id || null },
                action: "Global clearance authorization metadata changed",
                oldFields: oldAuth,
                newFields: updatedAuth
            });
            return mapAuthToClient(updatedAuth);
        } catch (err) {
            console.error("Error updating user authorization profile:", err);
            throw err;
        }
    }

    // =========================================================================
    // 5. DELETE USER
    // =========================================================================
    async deleteUser(userId, actor) {
        try {
            if (!actor || actor.clearance < 4) {
                throw new Error("Unauthorized: Insufficient clearance to delete user accounts.");
            }

            const oldUser = await constUser.findById(userId).lean();
            if (!oldUser) throw new Error(`User with ID ${userId} not found.`);

            await constUser.findByIdAndDelete(userId);

            await this.createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "WARNING",
                actor,
                targetEntity: { entity_type: "USER", entity_id: userId },
                action: "Permanently deleted user account mapping",
                oldFields: oldUser,
                newFields: {}
            });

            return { success: true, message: "User deleted successfully." };
        } catch (err) {
            console.error("Error deleting user:", err);
            throw err;
        }
    }

    // =========================================================================
    // 6. DELETE REQUEST
    // =========================================================================
    async deleteRequest(requestId, actor) {
        try {
            const oldRequest = await constRequest.findById(requestId).lean();
            if (!oldRequest) throw new Error(`Request with ID ${requestId} not found.`);

            await constRequest.findByIdAndDelete(requestId);

            await this.createAuditLog({
                eventType: "REQUEST_LIFECYCLE",
                severity: "WARNING",
                actor,
                targetEntity: { entity_type: "REQUEST", entity_id: requestId },
                action: "Permanently deleted individual request profile",
                oldFields: oldRequest,
                newFields: {}
            });

            return { success: true, message: "Request deleted successfully." };
        } catch (err) {
            console.error("Error deleting request:", err);
            throw err;
        }
    }

    // =========================================================================
    // 7. DELETE REQUEST GROUP
    // =========================================================================
    async deleteRequestGroup(groupId, actor) {
        try {
            const groupToDelete = await constRequestGroups.findById(groupId).lean();
            if (!groupToDelete) {
                throw new Error(`Request Group with ID ${groupId} not found.`);
            }

            const groupNotes = groupToDelete.notes || [];

            await constRequest.updateMany(
                { group_id: new mongoose.Types.ObjectId(groupId) },
                {
                    $set: { group_id: null },
                    $push: { notes: {$each: groupNotes } }
                }
            );

            await constRequestGroups.findByIdAndDelete(groupId);

            await this.createAuditLog({
                eventType: "GROUP_ASSIGNED",
                severity: "CRITICAL",
                actor,
                targetEntity: { entity_type: "GROUP", entity_id: groupId },
                action: "Deleted request group cluster. Unlinked child tasks and cascaded text note history feeds.",
                oldFields: groupToDelete,
                newFields: {}
            });

            return {
                success: true,
                message: "Request Group dissolved and deleted successfully. Notes cloned to child requests."
            };
        } catch (err) {
            console.error("Error executing cascading delete operation on request group:", err);
            throw err;
        }
    }

    // =========================================================================
    // 8. DELETE SYSTEM LOG
    // =========================================================================
    async deleteLog(logId, actor) {
        try {
            if (!actor || actor.clearance < 5) {
                throw new Error("Unauthorized: Only highest clearance actors can purge system audit logs.");
            }

            const oldLog = await constLog.findOne({ log_id: logId }).lean();
            if (!oldLog) throw new Error(`Log reference with ID ${logId} not found.`);

            await constLog.deleteOne({ log_id: logId });

            // Fixed: Use deleted log's _id instead of null to satisfy schema requirements
            await this.createAuditLog({
                eventType: "SYSTEM_ERROR",
                severity: "CRITICAL",
                actor,
                targetEntity: { entity_type: "LOG", entity_id: oldLog._id },
                action: `System log trace file manually purged (Purged trace ID: ${logId})`,
                oldFields: oldLog,
                newFields: {}
            });

            return { success: true, message: "System trace entry purged successfully." };
        } catch (err) {
            console.error("Error purging log data entity profile:", err);
            throw err;
        }
    }

    // =========================================================================
    // 9. DELETE USER AUTHORIZATION
    // =========================================================================
    async deleteUserAuthorization(clearanceLevel, actor) {
        try {
            if (!actor || actor.clearance < 5) {
                throw new Error("Unauthorized: Insufficient clearance level to drop authorization clearance tiers.");
            }

            const oldAuth = await constUserAuthorization.findOne({ clearance: Number(clearanceLevel) }).lean();
            if (!oldAuth) throw new Error(`User Authorization profile with clearance tier ${clearanceLevel} not found.`);

            await constUserAuthorization.deleteOne({ clearance: Number(clearanceLevel) });

            await this.createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: { entity_type: "USER", entity_id: oldAuth._id },
                action: `Revoked full global clearance permissions configuration map tier: ${clearanceLevel}`,
                oldFields: oldAuth,
                newFields: {}
            });

            return { success: true, message: "User Authorization clear tier data table dropped successfully." };
        } catch (err) {
            console.error("Error dropping workspace authorization map matrix:", err);
            throw err;
        }
    }
}

module.exports = DBUpdateWrite;