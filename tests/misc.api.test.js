const { users, bearer, signInAs } = require('./helpers');
const request = require('supertest');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const { createApp } = require('../app');

const app = createApp();
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('lookups', () => {
    test('categories and departments return arrays', async () => {
        // Arrange
        signInAs(users.requester);
        // Act
        const cats = await request(app).get('/api/categories').set(bearer(users.requester));
        const deps = await request(app).get('/api/departments').set(bearer(users.requester));
        // Assert
        expect(cats.body.length).toBeGreaterThan(0);
        expect(deps.body.length).toBeGreaterThan(0);
    });

    test('an unknown /api path is still a JSON 404, not a 401', async () => {
        // Arrange / Act
        const res = await request(app).get('/api/nope');
        // Assert
        expect(res.status).toBe(404);
    });
});

describe('request groups', () => {
    test('creating a group links every request to it', async () => {
        // Arrange
        signInAs(users.staff);
        jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([{ id: 'x' }]);
        jest.spyOn(DBUpdateWrite.prototype, 'createRequestGroup').mockResolvedValue({ id: 'g1' });
        const spy = jest.spyOn(DBUpdateWrite.prototype, 'updateRequest').mockResolvedValue({});
        // Act
        const res = await request(app).post('/api/request-groups').set(bearer(users.staff))
            .send({ requestIds: ['a', 'b'], title: 'Same pothole' });
        // Assert
        expect(res.status).toBe(201);
        expect(spy.mock.calls.map(c => [c[0], c[1]])).toEqual([['a', { groupId: 'g1' }], ['b', { groupId: 'g1' }]]);
    });

    test('a requester cannot see groups', async () => {
        // Arrange
        signInAs(users.requester);
        // Act
        const res = await request(app).get('/api/request-groups').set(bearer(users.requester));
        // Assert
        expect(res.status).toBe(403);
    });
});

describe('reports', () => {
    test('staff cannot open the dashboard', async () => {
        // Arrange
        signInAs(users.staff);
        // Act
        const res = await request(app).get('/api/reports/dashboard?from=2026-01-01&to=2026-12-31').set(bearer(users.staff));
        // Assert
        expect(res.status).toBe(403);
    });

    test('the export returns CSV with the header row', async () => {
        // Arrange
        signInAs(users.manager);
        jest.spyOn(DBRead.prototype, 'findRequests').mockResolvedValue([{
            id: 'r1', trackingId: 'REQ-1', title: 'Pothole, big', status: 'SUBMITTED', priority: null,
            categoryId: null, departmentId: null, assignedTo: null, createdAt: '2026-10-01T00:00:00.000Z',
            dueAt: null, resolvedAt: null, resolutionOutcome: null, closedAt: null, statusHistory: [], notes: [],
        }]);
        jest.spyOn(DBRead.prototype, 'findDirectory').mockResolvedValue([]);
        // Act
        const res = await request(app).post('/api/reports/export').set(bearer(users.manager))
            .send({ requestIds: ['r1'], lifecycle: false, comments: false, staffMetrics: false });
        // Assert
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text.split('\n')[0]).toMatch(/^Tracking ID,Title,Status/);
        expect(res.text).toContain('"Pothole, big"');
    });
});
