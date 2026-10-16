const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    username: { type: String, required: true, unique: true},
    password_hash: { type: String, required: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    clearance: { type: Number, required: true, min: 0, max: 5, default: 0 },
    work_categories: [{ type: String }],
    email: { type: String, match: /^.+@.+\..+$/, unique: true, sparse: true },
    phone: { type: String, default: null },     // Encrypted E.164 format
    whatsapp: { type: String, default: null },  // Encrypted E.164 format

    // A4 Sign-up approval & route guard fields
    role: { type: String,enum: ['REQUESTER', 'STAFF', 'MANAGER', 'ADMIN', null], default: null }, // Null until approved by an administrator
    approval_status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        required: true,
        index: true
    },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approved_at: { type: Date, default: null },
    decision_note: { type: String, default: null, trim: true },
    verified: { type: Boolean, default: false, required: true },
    verification_code_hash: { type: String, default: null },
    verification_expires: { type: Date, default: null },
    verification_attempts: { type: Number, default: 0 },
    pending_phone: { type: String, default: null },   // encrypted, waits for a code (/me/contact)
    notification_preference: {
        type: String,
        enum: ['EMAIL', 'SMS'],
        default: 'EMAIL',
        required: true
    },
    is_active: { type: Boolean, default: true, required: true },
    department: { type: String, default: null, trim: true }
}, {
    collection: 'user',
    timestamps: true // Automatically manages createdAt and updatedAt
});

// Index for filtering pending approval queues
userSchema.index({ approval_status: 1, createdAt: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;