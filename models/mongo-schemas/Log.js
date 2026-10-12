const constMongoose = require('mongoose');
const { Schema } = constMongoose;

const constLogSchema = new Schema({
    bsonType: "object",
        required: ["log_id", "timestamp", "event_type", "severity", "actor", "action"],
        properties: {
        log_id: { bsonType: "objectId" },
        timestamp: { bsonType: "date" },
        event_type: {
            enum: ["USER_AUTH", "REQUEST_LIFECYCLE", "NOTE_CREATED", "GROUP_ASSIGNED", "SECURITY_CHANGE", "SYSTEM_ERROR"],
                description: "Must be a recognized domain event category"
        },
        severity: {
            enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
                description: "Log urgency level"
        },
        actor: {
            bsonType: "object",
                required: ["user_id", "username", "clearance_at_time"],
                properties: {
                user_id: { bsonType: "objectId" },
                username: { bsonType: "string" },
                clearance_at_time: { bsonType: "int", minimum: 0, maximum: 5 },
                ip_address: { bsonType: ["string", "null"] }
            }
        },
        target_entity: {
            bsonType: "object",
                required: ["entity_type", "entity_id"],
                properties: {
                entity_type: { enum: ["REQUEST", "USER", "GROUP", "NOTE"] },
                entity_id: { bsonType: "objectId" }
            }
        },
        action: { bsonType: "string" },
        changes: {
            bsonType: ["object", "null"],
                description: "Captures before and after states for security or status audits",
                properties: {
                field: { bsonType: "string" },
                old_value: { bsonType: ["string", "int", "bool", "null"] },
                new_value: { bsonType: ["string", "int", "bool", "null"] }
            }
        },
        metadata: {
            bsonType: ["object", "null"],
                description: "Flexible key-value payload for contextual details"
        }
    }
});

const Log = constMongoose.model('Log',constLogSchema);
