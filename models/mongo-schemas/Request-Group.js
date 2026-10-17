const mongoose = require('mongoose');
const { Schema } = mongoose;

const requestGroupSchema = new Schema({
    created_at: { type: Date, required: true },
    created_by: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true },
    title: { type: String },
    primary_request_id: { type: Schema.Types.ObjectId },
    notes: [{
        note_id: { type: Schema.Types.ObjectId, required: true },
        details: { type: String, required: true },
        category: { type: String, required: true },
        user_id: { type: Schema.Types.ObjectId, required: true },
        date: { type: Date, required: true },
        visibility: { type: String, enum: ['INTERNAL', 'PUBLIC'], default: 'INTERNAL' }
    }]
}, {
    collection: 'requestGroup',
    timestamps: false
});

const RequestGroup = mongoose.model('RequestGroup', requestGroupSchema);
module.exports = RequestGroup;