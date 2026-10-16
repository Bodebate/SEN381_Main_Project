// Shared test setup. Dummy values only, the same as tests/database.test.js; never real secrets.
process.env.JWT_Secret = 'test-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.FIXED_IV = '0'.repeat(24);

const jwt = require('jsonwebtoken');
const User = require('../models/mongo-schemas/User');

const makeUser = (o = {}) => ({
    _id: '64b000000000000000000001', username: 'req1', role: 'REQUESTER', clearance: 0,
    work_categories: [], approval_status: 'APPROVED', is_active: true, ...o,
});

const users = {
    requester: makeUser(),
    staff: makeUser({ _id: '64b000000000000000000002', username: 'staff1', role: 'STAFF',
        clearance: 2, work_categories: ['cat-potholes'] }),
    manager: makeUser({ _id: '64b000000000000000000003', username: 'mgr1', role: 'MANAGER', clearance: 4 }),
    pending: makeUser({ _id: '64b000000000000000000004', username: 'new1', role: null,
        approval_status: 'PENDING' }),
};

const bearer = u => ({ Authorization: `Bearer ${jwt.sign({ sub: u._id }, process.env.JWT_Secret)}` });
// authenticate() calls User.findById(sub).lean()
const signInAs = u => jest.spyOn(User, 'findById').mockReturnValue({ lean: () => Promise.resolve(u) });

module.exports = { users, bearer, signInAs };
