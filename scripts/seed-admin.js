// Creates the first approved admin so someone can approve other users.
// Usage: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env, then: npm run seed
// To reset an existing admin's password and email from .env: npm run seed -- --reset-password
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/mongo-schemas/User');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');

(async () => {
    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
    if (!email || !password || password.length < 8) {
        console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters) in .env first.');
        process.exit(1);
    }
    await connectDB();
    const write = new DBUpdateWrite();
    const seed = { user_id: null, username: 'seed', role: 'ADMIN', clearance: 5 };
    const existing = await User.findOne({ username: 'admin' }).lean();
    if (existing) {
        if (process.argv.includes('--reset-password')) {
            await write.updateUser(existing._id, { password, email }, seed);
            console.log('Password and email for "admin" reset to SEED_ADMIN_PASSWORD and SEED_ADMIN_EMAIL.');
        } else {
            console.log('User "admin" already exists; nothing to do. Use --reset-password to set its password and email from .env.');
        }
        return mongoose.disconnect();
    }
    const user = await write.createUser({
        username: 'admin', firstName: 'System', lastName: 'Admin', email, password, clearance: 5,
    }, seed);
    await write.updateUser(user.id, { role: 'ADMIN', approvalStatus: 'APPROVED', verified: true }, seed);
    console.log('Admin created. Sign in as "admin" with SEED_ADMIN_PASSWORD.');
    await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
