const { users, bearer, signInAs } = require('./helpers');
jest.mock('../services/twilio', () => ({
    sendSMS: jest.fn().mockResolvedValue({}),
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendWhatsApp: jest.fn().mockResolvedValue({}),
}));
const request = require('supertest');
const bcrypt = require('bcrypt');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const { createApp } = require('../app');

const app = createApp();
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('POST /api/auth/login', () => {
    test('returns the user and a token for the right password', async () => {
        // Arrange
        const passwordHash = await bcrypt.hash('secret123', 4);
        jest.spyOn(DBRead.prototype, 'findUserForLogin')
            .mockResolvedValue({ passwordHash, user: { id: 'u1', isActive: true } });
        // Act
        const res = await request(app).post('/api/auth/login').send({ username: 'a', password: 'secret123' });
        // Assert
        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe('u1');
        expect(res.body.token).toEqual(expect.any(String));
    });

    test('wrong password and unknown username give the same 401', async () => {
        // Arrange
        const passwordHash = await bcrypt.hash('secret123', 4);
        const spy = jest.spyOn(DBRead.prototype, 'findUserForLogin');
        spy.mockResolvedValueOnce({ passwordHash, user: { id: 'u1', isActive: true } });
        spy.mockResolvedValueOnce(null);
        // Act
        const wrong = await request(app).post('/api/auth/login').send({ username: 'a', password: 'nope' });
        const unknown = await request(app).post('/api/auth/login').send({ username: 'zz', password: 'nope' });
        // Assert
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body.message).toBe(unknown.body.message);
    });
});

describe('POST /api/auth/register', () => {
    const body = { firstName: 'A', lastName: 'B', username: 'ab', email: 'a@b.com', notifyVia: 'EMAIL', password: 'longenough' };

    test('returns 201 with the new userId', async () => {
        // Arrange
        jest.spyOn(DBUpdateWrite.prototype, 'createUser')
            .mockResolvedValue({ id: 'u9', notifyVia: 'EMAIL', email: 'a@b.com' });
        jest.spyOn(DBUpdateWrite.prototype, 'setVerificationCode').mockResolvedValue('123456');
        // Act
        const res = await request(app).post('/api/auth/register').send(body);
        // Assert
        expect(res.status).toBe(201);
        expect(res.body.userId).toBe('u9');
    });

    test('a duplicate username returns 409', async () => {
        // Arrange
        jest.spyOn(DBUpdateWrite.prototype, 'createUser')
            .mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
        // Act
        const res = await request(app).post('/api/auth/register').send(body);
        // Assert
        expect(res.status).toBe(409);
    });

    test('a short password returns 400', async () => {
        // Arrange / Act
        const res = await request(app).post('/api/auth/register').send({ ...body, password: 'short' });
        // Assert
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/verify', () => {
    test('a wrong code returns 400', async () => {
        // Arrange
        jest.spyOn(DBUpdateWrite.prototype, 'verifyUserCode')
            .mockRejectedValue(new Error('Validation Error: Incorrect code.'));
        // Act
        const res = await request(app).post('/api/auth/verify').send({ userId: 'u9', code: '000000' });
        // Assert
        expect(res.status).toBe(400);
    });

    test('the right code returns user and token', async () => {
        // Arrange
        jest.spyOn(DBUpdateWrite.prototype, 'verifyUserCode').mockResolvedValue({ id: 'u9', verified: true });
        // Act
        const res = await request(app).post('/api/auth/verify').send({ userId: 'u9', code: '123456' });
        // Assert
        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
    });
});

describe('GET /api/auth/me', () => {
    test('returns 401 without a token', async () => {
        // Arrange / Act
        const res = await request(app).get('/api/auth/me');
        // Assert
        expect(res.status).toBe(401);
    });

    test('works for a pending user', async () => {
        // Arrange
        signInAs(users.pending);
        jest.spyOn(DBRead.prototype, 'findUserById').mockResolvedValue({ id: users.pending._id, approval: 'PENDING' });
        // Act
        const res = await request(app).get('/api/auth/me').set(bearer(users.pending));
        // Assert
        expect(res.status).toBe(200);
        expect(res.body.approval).toBe('PENDING');
    });
});

describe('requests routes still guarded', () => {
    test('a pending user gets 403 on /api/requests', async () => {
        // Arrange
        signInAs(users.pending);
        // Act
        const res = await request(app).get('/api/requests').set(bearer(users.pending));
        // Assert
        expect(res.status).toBe(403);
    });

    test('staff cannot create a request (requireRole works)', async () => {
        // Arrange
        signInAs(users.staff);
        // Act
        const res = await request(app).post('/api/requests').set(bearer(users.staff)).send({ details: 'x', address: 'y' });
        // Assert
        expect(res.status).toBe(403);
    });
});
