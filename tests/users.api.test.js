const { users, bearer, signInAs } = require('./helpers');
const request = require('supertest');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const { createApp } = require('../app');

const app = createApp();
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a requester gets 403 on GET /api/users', async () => {
    // Arrange
    signInAs(users.requester);
    // Act
    const res = await request(app).get('/api/users').set(bearer(users.requester));
    // Assert
    expect(res.status).toBe(403);
});

test('a manager can list users', async () => {
    // Arrange
    signInAs(users.manager);
    jest.spyOn(DBRead.prototype, 'listUsers').mockResolvedValue([{ id: 'u5' }]);
    // Act
    const res = await request(app).get('/api/users').set(bearer(users.manager));
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'u5' }]);
});

test('the directory is open to any approved user', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findDirectory').mockResolvedValue([{ id: 'u1', name: 'A B', role: 'STAFF' }]);
    // Act
    const res = await request(app).get('/api/users/directory').set(bearer(users.requester));
    // Assert
    expect(res.status).toBe(200);
});

test('assignable passes departmentId through', async () => {
    // Arrange
    signInAs(users.staff);
    const spy = jest.spyOn(DBRead.prototype, 'findAssignableStaff').mockResolvedValue([]);
    // Act
    await request(app).get('/api/users/assignable?departmentId=dep-roads').set(bearer(users.staff));
    // Assert
    expect(spy.mock.calls[0][0]).toBe('dep-roads');
});

test('approving sends APPROVED and the chosen role to updateUser', async () => {
    // Arrange
    signInAs(users.manager);
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateUser').mockResolvedValue({ id: 'u5', approval: 'APPROVED' });
    // Act
    const res = await request(app).put('/api/users/u5/approval').set(bearer(users.manager))
        .send({ decision: 'APPROVE', role: 'STAFF', clearance: 2, departmentId: 'dep-roads', workCategoryIds: ['cat-potholes'], note: '' });
    // Assert
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][1]).toMatchObject({ approvalStatus: 'APPROVED', role: 'STAFF', department: 'dep-roads' });
});

test('declining sends REJECTED', async () => {
    // Arrange
    signInAs(users.manager);
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateUser').mockResolvedValue({ id: 'u5', approval: 'DECLINED' });
    // Act
    await request(app).put('/api/users/u5/approval').set(bearer(users.manager)).send({ decision: 'DECLINE', note: 'Duplicate' });
    // Assert
    expect(spy.mock.calls[0][1]).toEqual({ approvalStatus: 'REJECTED', decisionNote: 'Duplicate' });
});

test('an unknown decision returns 400', async () => {
    // Arrange
    signInAs(users.manager);
    // Act
    const res = await request(app).put('/api/users/u5/approval').set(bearer(users.manager)).send({ decision: 'MAYBE' });
    // Assert
    expect(res.status).toBe(400);
});
