const constMongoose = require('mongoose')

const constUser = require('./mongo-schemas/User')
const constRequest = require('./mongo-schemas/Request')
const constRequestGroups = require('./mongo-schemas/Reguest-Group')
const constLog = require('./mongo-schemas/Log')
const constEncryption = require("./Encription");
//const {overwriteMiddlewareResult} = require("mongoose");

const constMongoURI = "load from secrets vault"
let constDB

function encryptText(text) {
        return constEncryption.encryptText(text);
}
function decryptText(text) {
        return constEncryption.decryptText(text);
}


class DBRead {

        async #connect() {
                await constMongoose.connect(constMongoURI).then(() => console.log('Successfully connected to atlas DB')).catch((err) => console.error('Databse connection error:', err));
                constDB = constMongoose.connection;
        }

        #disconnect() {
                constMongoose.disconnect()
        }


        // =========================================================================
        // 1. USER READS
        // =========================================================================
        async findUserByIdentifier({ username, phone, whatsapp, email, firstName, lastName, clearance, inWorkCategories, allWorkCategories }) {
                try {
                        await this.#connect();
                        const query = {};

                        // 1. Plaintext field criteria mappings
                        if (username) query.username = username;
                        if (email) query.email = email;
                        if (clearance !== undefined && clearance !== null) query.clearance = Number(clearance);

                        if (inWorkCategories && inWorkCategories.length > 0) {
                                query.work_categories = { $in: Array.isArray(inWorkCategories) ? inWorkCategories : [inWorkCategories] };
                        } else if (allWorkCategories && allWorkCategories.length > 0) {
                                query.work_categories = { $all: Array.isArray(allWorkCategories) ? allWorkCategories : [allWorkCategories] };
                        }

                        // 2. Encrypt structural lookup targets so they match database cipher signatures
                        if (phone) query.phone = encryptText(phone);
                        if (whatsapp) query.whatsapp = encryptText(whatsapp);

                        // will not evaluate partial text values inside MongoDB. We must match complete names exactly.
                        if (firstName) query.first_name = encryptText(firstName);
                        if (lastName) query.last_name = encryptText(lastName);

                        // Prevent blank criteria executions from dumping full datasets
                        if (Object.keys(query).length === 0) return null;

                        const records = await constUser.find(query).lean();

                        // 3. Process records through post-read translation pipeline to decrypt values
                        const decryptedRecords = records.map(user => {
                                return {
                                        ...user,
                                        phone: decryptText(user.phone),
                                        whatsapp: decryptText(user.whatsapp),
                                        first_name: decryptText(user.first_name),
                                        last_name: decryptText(user.last_name)
                                };
                        });

                        return decryptedRecords;
                } catch (err) {
                        console.error("Error running secure user resolution read operations:", err);
                        throw err;
                } finally {
                        await this.#disconnect();
                }
        }


        // =========================================================================
        // 2. REQUEST READS
        // =========================================================================
        async findRequests({ id, groupId, title, securityLevel, priority, assignedTo, resolved, closed }) {
                try {
                        await this.#connect();
                        const query = {};

                        if (id) query._id = id;
                        if (groupId) query.group_id = groupId;
                        if (title) query.title = { $regex: title, $options: 'i' };
                        if (securityLevel !== undefined && securityLevel !== null) query.security_level = Number(securityLevel);
                        if (priority !== undefined && priority !== null) query.priority = Number(priority);
                        if (assignedTo) query.asigned_to = assignedTo; // Keeps schema typo structure 'asigned_to'
                        if (resolved !== undefined && resolved !== null) query.resolved = Boolean(resolved);
                        if (closed !== undefined && closed !== null) query.closed = Boolean(closed);

                        if (Object.keys(query).length === 0) return [];
                        return await constRequest.find(query).sort({ priority: -1 });
                } catch (err) {
                        console.error("Error finding requests:", err);
                        throw err;
                } finally {
                        await this.#disconnect();
                }
        }

        // =========================================================================
        // 3. REQUEST GROUPS READS
        // =========================================================================
        async findRequestGroups({ id, createdBy, status, primaryRequestId, title }) {
                try {
                        await this.#connect();
                        const query = {};

                        if (id) query._id = id;
                        if (createdBy) query.created_by = createdBy;
                        if (status) query.status = status;
                        if (primaryRequestId) query.primary_request_id = primaryRequestId;
                        if (title) query.title = { $regex: title, $options: 'i' };

                        if (Object.keys(query).length === 0) return [];
                        return await constRequestGroups.find(query);
                } catch (err) {
                        console.error("Error finding request groups:", err);
                        throw err;
                } finally {
                        await this.#disconnect();
                }
        }

        // =========================================================================
        // 4. SYSTEM LOG READS
        // =========================================================================
        async findLogs({ logId, eventType, severity, actorId, username, targetEntityId, targetEntityType }) {
                try {
                        await this.#connect();
                        const query = {};

                        if (logId) query.log_id = logId;
                        if (eventType) query.event_type = eventType;
                        if (severity) query.severity = severity;
                        if (actorId) query['actor.user_id'] = actorId; // Dot notation targets subdocuments
                        if (username) query['actor.username'] = username;
                        if (targetEntityId) query['target_entity.entity_id'] = targetEntityId;
                        if (targetEntityType) query['target_entity.entity_type'] = targetEntityType;

                        if (Object.keys(query).length === 0) return [];
                        return await constLog.find(query).sort({ timestamp: -1 });
                } catch (err) {
                        console.error("Error finding system logs:", err);
                        throw err;
                } finally {
                        await this.#disconnect();
                }
        }

        // =========================================================================
        // 5. USER AUTHORIZATION READS
        // =========================================================================
        async findUserAuthorizations({ clearance, workCategories }) {
                try {
                        await this.#connect();
                        const query = {};

                        if (clearance !== undefined && clearance !== null) query.clearance = Number(clearance);
                        if (workCategories && workCategories.length > 0) {
                                query.work_categories = { $in: Array.isArray(workCategories) ? workCategories : [workCategories] };
                        }

                        if (Object.keys(query).length === 0) return [];
                        // Queries native collections if userAuthorization lacks a custom mongoose file template setup
                        return await constMongoose.connection.collection("userAuthorization").find(query).toArray();
                } catch (err) {
                        console.error("Error finding user authorizations:", err);
                        throw err;
                } finally {
                        await this.#disconnect();
                }
        }
}

