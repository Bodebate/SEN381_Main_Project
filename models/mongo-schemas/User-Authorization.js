const mongoose = require('mongoose');
const { Schema } = mongoose;

const userAuthorizationSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clearance: { type: Number, required: true, min: 0, max: 5, index: true },
    work_categories: [{ type: String, required: true }],
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    AcceptedDate: { type: Date }
}, {
    collection: 'userAuthorization',
    timestamps: false
});

const UserAuthorization = mongoose.model('UserAuthorization', userAuthorizationSchema);
module.exports = UserAuthorization;