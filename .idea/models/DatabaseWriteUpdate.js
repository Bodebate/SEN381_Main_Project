const constMongoose = require('mongoose');
const constEncryption = require('./Encription')
const constCreateLog = require('./DatabseCreateLog')
// Imported models
const constUser = require('./mongo-schemas/User');
const constRequest = require('./mongo-schemas/Request');
const constRequestGroups = require('./mongo-schemas/Reguest-Group');
const constLog = require('./mongo-schemas/Log');
const bcrypt = require('bcrypt')

const constMongoURI = "load from secrets vault"

/**
 * Utility: Encrypt sensitive plaintext text structures
 */
function encryptText(text) {
    return constEncryption.encryptText(text);
}

class DBUpdateWrite {


    async #connect() {
        await constMongoose.connect(constMongoURI).then(() => console.log('Successfully connected to atlas DB')).catch((err) => console.error('Databse connection error:', err));
        constDB = constMongoose.connection;
    }

    #disconnect() {
        constMongoose.disconnect()
    }


// =========================================================================
// HELPER: SYSTEM AUDIT LOGGING ENGINE
// =========================================================================
    async createAuditLog({eventType, severity, actor, targetEntity, action, oldFields, newFields}) {
        // Monitored target properties across your platform domain
        const trackedFields = [
            'clearance', 'notes', 'security_level', 'priority',
            'resolved', 'closed', 'asigned_to', 'work_categories'
        ];

        for (const field of trackedFields) {
            const oldVal = oldFields ? oldFields[field] : undefined;
            const newVal = newFields ? newFields[field] : undefined;

            // Log if a value has changed or been explicitly assigned during initialization
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                try {
                    await constLog.create({
                        log_id: new constMongoose.Types.ObjectId(),
                        timestamp: new Date(),
                        event_type: eventType,
                        severity: severity,
                        actor: {
                            user_id: actor?.user_id || null,
                            username: actor?.username || 'SYSTEM',
                            clearance_at_time: actor?.clearance || 0,
                            ip_address: actor?.ip_address || null
                        },
                        target_entity: targetEntity,
                        action: `${action} (Field '${field}' modified)`,
                        changes: {
                            field: field,
                            old_value: oldVal !== undefined ? String(oldVal) : null,
                            new_value: newVal !== undefined ? String(newVal) : null
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
            await this.#connect();

            // Secure, hash and encrypt data payloads
            const securedData = {...userData};
            if (securedData.password) securedData.password_hash = await bcrypt.hash(securedData.password, 12);
            if (securedData.phone) securedData.phone = encryptText(securedData.phone);
            if (securedData.whatsapp) securedData.whatsapp = encryptText(securedData.whatsapp);
            if (securedData.first_name) securedData.first_name = encryptText(securedData.first_name);
            if (securedData.last_name) securedData.last_name = encryptText(securedData.last_name);

            const newUser = await constUser.create(securedData);

            // Audit modifications
            await this.#createAuditLog({
                eventType: "USER_AUTH",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "USER", entity_id: newUser._id},
                action: "User account created",
                oldFields: {},
                newFields: newUser
            });

            return newUser;
        } catch (err) {
            console.error("Error creating user:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async updateUser(userId, updateData, actor) {
        try {
            await this.#connect();

            const securedUpdates = {...updateData};
            if (securedUpdates.password) securedUpdates.password_hash = await bcrypt.hash(securedUpdates.password, 12);
            if (securedUpdates.phone) securedUpdates.phone = encryptText(securedUpdates.phone);
            if (securedUpdates.whatsapp) securedUpdates.whatsapp = encryptText(securedUpdates.whatsapp);
            if (securedUpdates.first_name) securedUpdates.first_name = encryptText(securedUpdates.first_name);
            if (securedUpdates.last_name) securedUpdates.last_name = encryptText(securedUpdates.last_name);

            const oldUser = await constUser.findById(userId).lean();
            const updatedUser = await constUser.findByIdAndUpdate(userId, securedUpdates, {new: true}).lean();

            await this.#createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "WARNING",
                actor,
                targetEntity: {entity_type: "USER", entity_id: userId},
                action: "User account properties updated",
                oldFields: oldUser,
                newFields: updatedUser
            });

            return updatedUser;
        } catch (err) {
            console.error("Error updating user:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    // =========================================================================
    // 2. REQUEST WRITES & UPDATES
    // =========================================================================
    async createRequest(requestData, actor) {
        try {
            await this.#connect();
            const newRequest = await constRequest.create(requestData);

            await this.#createAuditLog({
                eventType: "REQUEST_LIFECYCLE",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "REQUEST", entity_id: newRequest._id},
                action: "New task request initialised",
                oldFields: {},
                newFields: newRequest
            });

            return newRequest;
        } catch (err) {
            console.error("Error creating request:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async updateRequest(requestId, updateData, actor) {
        try {
            await this.#connect();

            const oldRequest = await constRequest.findById(requestId).lean();
            const updatedRequest = await constRequest.findByIdAndUpdate(requestId, updateData, {new: true}).lean();

            let eventType = "REQUEST_LIFECYCLE";
            if (updateData.notes) eventType = "NOTE_CREATED";

            await this.#createAuditLog({
                eventType,
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "REQUEST", entity_id: requestId},
                action: "Task request properties modified",
                oldFields: oldRequest,
                newFields: updatedRequest
            });

            return updatedRequest;
        } catch (err) {
            console.error("Error updating request:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async addNoteToRequest(requestId, {details, category, user_id}, actor) {
        try {
            await this.#connect();

            // Construct the standardized internal note subdocument structure
            const newNote = {
                note_id: new constMongoose.Types.ObjectId(), // Generate a unique identifier for the sub-record
                details: details,
                category: category,
                user_id: new constMongoose.Types.ObjectId(user_id),
                date: new Date()
            };

            // Grab the record profile before appending for structural change comparison
            const oldRequest = await constRequest.findById(requestId).lean();
            if (!oldRequest) {
                throw new Error(`Request document with ID ${requestId} not found.`);
            }

            const updatedRequest = await constRequest.findByIdAndUpdate(requestId,
                {$push: {notes: newNote}},
                {new: true}
            ).lean();

            // Publish execution telemetry to the security log engine
            await this.#createAuditLog({
                eventType: "NOTE_CREATED",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "REQUEST", entity_id: requestId},
                action: "Appended new contextual note item to request file stack",
                oldFields: oldRequest,
                newFields: updatedRequest
            });

            return updatedRequest;
        } catch (err) {
            console.error("Error appending subdocument note to request object:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    // =========================================================================
    // 3. REQUEST GROUPS WRITES & UPDATES
    // =========================================================================
    async addNoteToRequestGroup(groupId, {details, category, user_id}, actor) {
        try {
            await this.#connect();

            // Construct the standardized internal note subdocument structure
            const newNote = {
                note_id: new constMongoose.Types.ObjectId(), // Generate a unique identifier for the sub-record
                details: details,
                category: category,
                user_id: new constMongoose.Types.ObjectId(user_id),
                date: new Date()
            };

            // Grab the record profile before appending for structural change comparison
            const oldGroup = await constRequestGroups.findById(groupId).lean();
            if (!oldGroup) {
                throw new Error(`Request Group document with ID ${groupId} not found.`);
            }

            // Atomically update the target document using \$push
            // { new: true } forces MongoDB to return the freshly altered document states
            const updatedGroup = await constRequestGroups.findByIdAndUpdate(
                groupId,
                {$push: {notes: newNote}},
                {new: true}
            ).lean();

            // Publish execution telemetry to the security log engine
            await this.#createAuditLog({
                eventType: "NOTE_CREATED",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "GROUP", entity_id: groupId},
                action: "Appended new contextual note item to request group cluster",
                oldFields: oldGroup,
                newFields: updatedGroup
            });

            return updatedGroup;
        } catch (err) {
            console.error("Error appending subdocument note to request group object:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async createRequestGroup(groupData, actor) {
        try {
            await this.#connect();
            const newGroup = await constRequestGroups.create(groupData);

            await this.#createAuditLog({
                eventType: "GROUP_ASSIGNED",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "GROUP", entity_id: newGroup._id},
                action: "Request pipeline cluster tracking created",
                oldFields: {},
                newFields: newGroup
            });

            return newGroup;
        } catch (err) {
            console.error("Error creating request group:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async updateRequestGroup(groupId, updateData, actor) {
        try {
            await this.#connect();

            const oldGroup = await constRequestGroups.findById(groupId).lean();
            const updatedGroup = await constRequestGroups.findByIdAndUpdate(groupId, updateData, {new: true}).lean();

            await this.#createAuditLog({
                eventType: updateData.notes ? "NOTE_CREATED" : "GROUP_ASSIGNED",
                severity: "INFO",
                actor,
                targetEntity: {entity_type: "GROUP", entity_id: groupId},
                action: "Request structural cluster properties modified",
                oldFields: oldGroup,
                newFields: updatedGroup
            });

            return updatedGroup;
        } catch (err) {
            console.error("Error updating request group:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    //=========================================================================
    // 4. USER AUTHORIZATION WRITES & UPDATES
    // =========================================================================
    async createUserAuthorization(authData, actor) {
        try {
            await this.#connect();
            const col = constMongoose.connection.collection("userAuthorization");
            const result = await col.insertOne(authData);
            await this.#createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: {entity_type: "USER", entity_id: result.insertedId},
                action: "Global workspace permission profile authorized",
                oldFields: {},
                newFields: authData
            });
            return result;
        } catch (err) {
            console.error("Error creating user authorization profile:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    async updateUserAuthorization(clearanceLevel, updateData, actor) {
        try {
            await this.#connect();
            const col = constMongoose.connection.collection("userAuthorization");
            const oldAuth = await col.findOne({clearance: Number(clearanceLevel)});
            await col.updateOne({clearance: Number(clearanceLevel)}, {$set: updateData});
            const updatedAuth = await col.findOne({clearance: Number(clearanceLevel)});
            await this.#createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: {entity_type: "USER", entity_id: oldAuth?._id || null},
                action: "Global clearance authorization metadata changed",
                oldFields: oldAuth,
                newFields: updatedAuth
            });
            return updatedAuth;
        } catch (err) {
            console.error("Error updating user authorization profile:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    // =========================================================================
    // 5. DELETE USER
    // =========================================================================
    async deleteUser(userId, actor) {
        try {
            await this.#connect();

            const oldUser = await constUser.findById(userId).lean();
            if (!oldUser) throw new Error(`User with ID ${userId} not found.`);

            await constUser.findByIdAndDelete(userId);

            // Publish audit telemetry
            await this.#createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "WARNING",
                actor,
                targetEntity: {entity_type: "USER", entity_id: userId},
                action: "Permanently deleted user account mapping",
                oldFields: oldUser,
                newFields: {}
            });

            return {success: true, message: "User deleted successfully."};
        } catch (err) {
            console.error("Error deleting user:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    // =========================================================================
    // 6. DELETE REQUEST
    // =========================================================================
    async deleteRequest(requestId, actor) {
        try {
            await this.#connect();

            const oldRequest = await constRequest.findById(requestId).lean();
            if (!oldRequest) throw new Error(`Request with ID ${requestId} not found.`);

            await constRequest.findByIdAndDelete(requestId);

            await this.#createAuditLog({
                eventType: "REQUEST_LIFECYCLE",
                severity: "WARNING",
                actor,
                targetEntity: {entity_type: "REQUEST", entity_id: requestId},
                action: "Permanently deleted individual request profile",
                oldFields: oldRequest,
                newFields: {}
            });

            return {success: true, message: "Request deleted successfully."};
        } catch (err) {
            console.error("Error deleting request:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

    // =========================================================================
    // 7. DELETE REQUEST GROUP (With Note Cascading & Group Dissolution) - FIXED
    // =========================================================================
    async deleteRequestGroup(groupId, actor) {
        try {
            await this.#connect();

            // 1. Fetch the targeted request group profile
            const groupToDelete = await constRequestGroups.findById(groupId).lean();
            if (!groupToDelete) {
                throw new Error(`Request Group with ID ${groupId} not found.`);
            }

            const groupNotes = groupToDelete.notes || [];

            // 2. Clear out the group assignment and push the notes array down to all child records
            // Natively structured with correct MongoDB update operators (set and push)
            await constRequest.updateMany(
                {group_id: new constMongoose.Types.ObjectId(groupId)},
                {
                    $set: {group_id: null},
                    $push: {notes: {$each: groupNotes}}
                }
            );

            // 3. Permanently remove the main request group container
            await constRequestGroups.findByIdAndDelete(groupId);

            // 4. Log the audit trace safely
            await this.#createAuditLog({
                eventType: "GROUP_ASSIGNED",
                severity: "CRITICAL",
                actor,
                targetEntity: {entity_type: "GROUP", entity_id: groupId},
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
        } finally {
            await this.#disconnect();
        }
    }

// =========================================================================
// 8. DELETE SYSTEM LOG
// =========================================================================
    async deleteLog(logId, actor) {
        try {
            await this.#connect();

            const oldLog = await constLog.findOne({log_id: logId}).lean();
            if (!oldLog) throw new Error(`Log reference with ID ${logId} not found.`);

            await constLog.deleteOne({log_id: logId});

            // Write an explicit system log highlighting audit trace removal items
            await this.#createAuditLog({
                eventType: "SYSTEM_ERROR",
                severity: "CRITICAL",
                actor,
                targetEntity: {entity_type: "NOTE", entity_id: null},
                action: `System log trace file manually purged (Purged trace ID: ${logId})`,
                oldFields: oldLog,
                newFields: {}
            });

            return {success: true, message: "System trace entry purged successfully."};
        } catch (err) {
            console.error("Error purging log data entity profile:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }

// =========================================================================
// 9. DELETE USER AUTHORIZATION
// =========================================================================
    async deleteUserAuthorization(clearanceLevel, actor) {
        try {
            await this.#connect();
            const col = constMongoose.connection.collection("userAuthorization");

            const oldAuth = await col.findOne({clearance: Number(clearanceLevel)});
            if (!oldAuth) throw new Error(`User Authorization profile with clearance tier ${clearanceLevel} not found.`);

            await col.deleteOne({clearance: Number(clearanceLevel)});

            await this.#createAuditLog({
                eventType: "SECURITY_CHANGE",
                severity: "CRITICAL",
                actor,
                targetEntity: {entity_type: "USER", entity_id: oldAuth._id},
                action: `Revoked full global clearance permissions configuration map tier: ${clearanceLevel}`,
                oldFields: oldAuth,
                newFields: {}
            });

            return {success: true, message: "User Authorization clear tier data table dropped successfully."};
        } catch (err) {
            console.error("Error dropping workspace authorization map matrix:", err);
            throw err;
        } finally {
            await this.#disconnect();
        }
    }
}
