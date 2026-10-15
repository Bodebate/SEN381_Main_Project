const mongoose = require('mongoose');
const { Schema } = mongoose;

const requestSchema = new Schema({
    tracking_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => 'REQ-' + Math.random().toString(36).substring(2, 9).toUpperCase()
    },
    group_id: { type: Schema.Types.ObjectId, ref: 'RequestGroup', default: null, index: { sparse: true } },
    title: { type: String, trim: true },
    details: { type: String, required: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Single requester per request
    security_level: { type: Number, required: true, min: 0, max: 5, default: 0 },
    request_category: [{ type: String }],
    priority: { type: Number, default: 0 },
    due_date: { type: Date, default: null }, // Top-level due date field
    assigned_to: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: { sparse: true } },
    address: { type: String, required: true },
    active: { type: Boolean, required: true, default: true },

    // Five-step status flow (FR-STF-005)
    status: {
        type: String,
        enum: ['SUBMITTED', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'CLOSED'],
        default: 'SUBMITTED',
        required: true,
        index: true
    },
    status_history: [{
        from: { type: String, enum: ['SUBMITTED', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'CLOSED', null], default: null },
        to: { type: String, enum: ['SUBMITTED', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'CLOSED'], required: true },
        comment: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true, default: Date.now }
    }],

    notes: [{
        note_id: { type: Schema.Types.ObjectId, required: true },
        details: { type: String, required: true },
        category: { type: String, required: true },
        user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        date: { type: Date, required: true, default: Date.now }
    }]
}, {
    collection: 'request',
    timestamps: true // Automatically manages createdAt and updatedAt fields
});

// Compound index matching query performance needs
requestSchema.index({ active: 1, security_level: 1, status: 1 });

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;