const { users, bearer, signInAs } = require('./helpers');
jest.mock('../services/notify', () => ({ sendSMS: jest.fn().mockResolvedValue({}), sendEmail: jest.fn().mockResolvedValue() }));
const request = require('supertest');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const sender = require('../services/notify');
const { createApp } = require('../app');

const app = createApp();
const other = { id: 'r1', trackingId: 'REQ-1', requesterIds: ['64b0000000000000000000ff'], notes: [], groupId: null };
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('GET /api/requests returns the list', async () => {
    // Arrange
    signInAs(users.staff);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([{ id: 'r1', notes: [] }]);
    // Act
    const res = await request(app).get('/api/requests').set(bearer(users.staff));
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'r1', notes: [] }]);
});

test('?mine=true filters on the signed-in requester', async () => {
    // Arrange
    signInAs(users.requester);
    const spy = jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([]);
    // Act
    await request(app).get('/api/requests?mine=true').set(bearer(users.requester));
    // Assert
    expect(String(spy.mock.calls[0][0].requester)).toBe(users.requester._id);
});

test('an unknown request returns 404', async () => {
    // Arrange
    signInAs(users.staff);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([]);
    // Act
    const res = await request(app).get('/api/requests/nope').set(bearer(users.staff));
    // Assert
    expect(res.status).toBe(404);
});

test('a requester creates a request with only the allowed fields', async () => {
    // Arrange
    signInAs(users.requester);
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'createRequest').mockResolvedValue({ id: 'r9', notes: [] });
    // Act
    const res = await request(app).post('/api/requests').set(bearer(users.requester))
        .send({ title: 'Pothole', details: 'Big one', address: '1 Main Rd', contact: { email: null, phone: null }, status: 'CLOSED' });
    // Assert
    expect(res.status).toBe(201);
    expect(spy.mock.calls[0][0]).toEqual({ title: 'Pothole', details: 'Big one', address: '1 Main Rd', contact: { email: null, phone: null } });
});

test('a requester cannot comment on someone else\'s request', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([other]);
    // Act
    const res = await request(app).post('/api/requests/r1/comments').set(bearer(users.requester)).send({ text: 'hello' });
    // Assert
    expect(res.status).toBe(403);
});

test('a requester never sees INTERNAL notes', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([{
        id: 'r1', requesterIds: [users.requester._id],
        notes: [{ id: 'n1', visibility: 'INTERNAL' }, { id: 'n2', visibility: 'PUBLIC' }],
    }]);
    // Act
    const res = await request(app).get('/api/requests/r1').set(bearer(users.requester));
    // Assert
    expect(res.body.notes.map(n => n.id)).toEqual(['n2']);
});

test('triage moves the request to ASSIGNED', async () => {
    // Arrange
    signInAs(users.staff);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([other]);
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateRequest').mockResolvedValue({ id: 'r1', status: 'ASSIGNED' });
    // Act
    const res = await request(app).put('/api/requests/r1/triage').set(bearer(users.staff))
        .send({ categoryId: 'cat-potholes', assigneeId: users.staff._id, dueAt: '2026-11-01', priority: 'HIGH', comment: 'On it' });
    // Assert
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][1]).toMatchObject({ status: 'ASSIGNED', categoryId: 'cat-potholes', priority: 'HIGH' });
});

test('skipping a status step returns 400', async () => {
    // Arrange
    signInAs(users.staff);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([other]);
    jest.spyOn(DBUpdateWrite.prototype, 'updateRequest')
        .mockRejectedValue(new Error('Validation Error: Invalid status transition'));
    // Act
    const res = await request(app).put('/api/requests/r1/status').set(bearer(users.staff)).send({ to: 'RESOLVED', comment: 'done' });
    // Assert
    expect(res.status).toBe(400);
});

test('a status change with notifyRequester sends a message', async () => {
    // Arrange
    signInAs(users.staff);
    jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([other]);
    jest.spyOn(DBUpdateWrite.prototype, 'updateRequest').mockResolvedValue({ ...other, status: 'IN_PROGRESS' });
    jest.spyOn(DBRead.prototype, 'findUserById').mockResolvedValue({ notifyVia: 'EMAIL', email: 'r@x.com' });
    // Act
    await request(app).put('/api/requests/r1/status').set(bearer(users.staff))
        .send({ to: 'IN_PROGRESS', comment: 'Crew sent', notifyRequester: true });
    // Assert
    expect(sender.sendEmail).toHaveBeenCalledWith('r@x.com', expect.any(String), expect.stringContaining('in progress'));
});

test('a requester cannot reassign', async () => {
    // Arrange
    signInAs(users.requester);
    // Act
    const res = await request(app).put('/api/requests/r1/assignee').set(bearer(users.requester)).send({ assigneeId: 'x' });
    // Assert
    expect(res.status).toBe(403);
});
