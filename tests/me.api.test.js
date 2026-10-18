const { users, bearer, signInAs } = require('./helpers');
jest.mock('../services/notify', () => ({ sendSMS: jest.fn().mockResolvedValue({}), sendEmail: jest.fn() }));
const request = require('supertest');
const bcrypt = require('bcrypt');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const sender = require('../services/notify');
const { createApp } = require('../app');

const app = createApp();
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('a wrong current password returns 400', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findUserForLogin')
        .mockResolvedValue({ passwordHash: await bcrypt.hash('right-one', 4), user: {} });
    // Act
    const res = await request(app).put('/api/me/password').set(bearer(users.requester))
        .send({ currentPassword: 'wrong', newPassword: 'newpassword' });
    // Assert
    expect(res.status).toBe(400);
});

test('a correct password change returns 204', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findUserForLogin')
        .mockResolvedValue({ passwordHash: await bcrypt.hash('right-one', 4), user: {} });
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateUser').mockResolvedValue({});
    // Act
    const res = await request(app).put('/api/me/password').set(bearer(users.requester))
        .send({ currentPassword: 'right-one', newPassword: 'newpassword' });
    // Assert
    expect(res.status).toBe(204);
    expect(spy.mock.calls[0][1]).toEqual({ password: 'newpassword' });
});

test('a profile update only ever targets the signed-in user', async () => {
    // Arrange
    signInAs(users.requester);
    const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateUser').mockResolvedValue({ id: users.requester._id });
    // Act
    await request(app).put('/api/me/profile').set(bearer(users.requester))
        .send({ firstName: 'New', lastName: 'Name', id: 'someone-else', role: 'ADMIN' });
    // Assert
    expect(String(spy.mock.calls[0][0])).toBe(users.requester._id);
    expect(spy.mock.calls[0][1]).toEqual({ firstName: 'New', lastName: 'Name' });
});

test('a new phone number sends a code instead of saving it', async () => {
    // Arrange
    signInAs(users.requester);
    jest.spyOn(DBRead.prototype, 'findUserById').mockResolvedValue({ id: users.requester._id, phone: null });
    jest.spyOn(DBUpdateWrite.prototype, 'updateUser').mockResolvedValue({});
    jest.spyOn(DBUpdateWrite.prototype, 'startPhoneChange').mockResolvedValue({ code: '111222', phone: '+27821234567' });
    // Act
    const res = await request(app).put('/api/me/contact').set(bearer(users.requester))
        .send({ email: 'a@b.com', phone: '0821234567', notifyVia: 'EMAIL' });
    // Assert
    expect(res.body.status).toBe('CODE_SENT');
    expect(sender.sendSMS).toHaveBeenCalledWith(expect.stringContaining('111222'), '+27821234567');
});

test('a pending user cannot use /api/me', async () => {
    // Arrange
    signInAs(users.pending);
    // Act
    const res = await request(app).put('/api/me/profile').set(bearer(users.pending)).send({ firstName: 'A', lastName: 'B' });
    // Assert
    expect(res.status).toBe(403);
});
