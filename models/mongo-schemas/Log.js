const mongoose = require('mongoose');
const { Schema } = mongoose;

const logSchema = new Schema({
    log_id: { type: Schema.Types.ObjectId, required: true },
    timestamp: { type: Date, required: true },
    event_type: {
        type: String,
        enum: ["USER_AUTH", "REQUEST_LIFECYCLE", "NOTE_CREATED", "GROUP_ASSIGNED", "SECURITY_CHANGE", "SYSTEM_ERROR"],
        required: true
    },
    severity: {
        type: String,
        enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
        required: true
    },
    actor: {
        type: {
            user_id: { type: Schema.Types.ObjectId, default: null, index: { sparse: true } }, // Made optional for system actions
            username: { type: String, required: true },
            clearance_at_time: { type: Number, required: true, min: 0, max: 5 },
            ip_address: { type: String, default: null }
        },
        required: true
    },
    target_entity: {
        type: {
            entity_type: { type: String, enum: ["REQUEST", "USER", "GROUP", "NOTE"], required: true },
            entity_id: { type: Schema.Types.ObjectId, required: true, index: true }
        },
        required: true
    },
    action: { type: String, required: true },
    changes: {
        type: {
            field: { type: String },
            old_value: { type: Schema.Types.Mixed },
            new_value: { type: Schema.Types.Mixed }
        },
        default: null
    },
    metadata: { type: Schema.Types.Mixed, default: null }
}, {
    collection: 'log',
    timestamps: false
});

// Indexes for log sorting and TTL expiration (1 year retention)
logSchema.index({ timestamp: -1 });
logSchema.index({ "target_entity.entity_id": 1, timestamp: -1 });
logSchema.index({ "actor.user_id": 1, timestamp: -1 });
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

const Log = mongoose.model('Log', logSchema);
module.exports = Log;