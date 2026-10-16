// Starts the Express API on a throwaway in-memory MongoDB with the same demo accounts as the
// Angular mock data (password "demo"). Used by the live E2E tests (views: npm run e2e:live)
// and handy for manual testing: npm run api:test. All data is lost when the process stops.
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.E2E_API_PORT || 3100);

const DEMO_USERS = [
    { username: 'requester', firstName: 'Jordan', lastName: 'Smith', role: 'REQUESTER', clearance: 0 },
    { username: 'staff', firstName: 'Sam', lastName: 'Naidoo', role: 'STAFF', clearance: 3,
        department: 'dep-water', workCategories: ['cat-sanitation', 'cat-supply'] },
    { username: 'manager', firstName: 'Morgan', lastName: 'Botha', role: 'MANAGER', clearance: 5 },
    { username: 'admin', firstName: 'Alex', lastName: 'Jacobs', role: 'ADMIN', clearance: 5 },
];

(async () => {
    const mongo = await MongoMemoryServer.create();

    // Set before anything loads dotenv: dotenv never overrides variables that already exist,
    // so these win over a developer's .env (and Atlas is never touched).
    process.env.MONGODB_URI = mongo.getUri('civicconnect-e2e');
    process.env.JWT_Secret = 'e2e-only-secret';
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    process.env.FIXED_IV = '0'.repeat(24);
    process.env.NOTIFY_MODE = 'console';
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4300';

    const connectDB = require('../config/db');
    const DBConnect = require('../models/DBConnect');
    const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
    const { createApp } = require('../app');

    await connectDB();
    await new DBConnect().createDB();

    const write = new DBUpdateWrite();
    const seed = { user_id: null, username: 'e2e-seed', role: 'ADMIN', clearance: 5 };
    for (const u of DEMO_USERS) {
        const created = await write.createUser({
            username: u.username, firstName: u.firstName, lastName: u.lastName,
            email: `${u.username}@example.com`, password: 'demo', clearance: u.clearance,
        }, seed);
        await write.updateUser(created.id, {
            role: u.role, approvalStatus: 'APPROVED', verified: true,
            department: u.department ?? null, workCategories: u.workCategories ?? [],
        }, seed);
    }

    const server = createApp().listen(PORT, () =>
        console.log(`Test API on http://localhost:${PORT}/api (in-memory DB, demo password "demo")`));

    const stop = async () => {
        server.close();
        await require('mongoose').disconnect();
        await mongo.stop();
        process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
})().catch(err => { console.error(err); process.exit(1); });
