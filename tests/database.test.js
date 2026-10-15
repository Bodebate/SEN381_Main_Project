// Test settings: dummy encryption values (never real secrets)
process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes as hex
process.env.FIXED_IV = '0'.repeat(24);       // 12 bytes as hex

const mongoose = require('mongoose');
const Encryption = require('../models/Encription');
const { mapAuthToClient } = require('../models/utils/Mappers');
const Request = require('../models/mongo-schemas/Request');
const Log = require('../models/mongo-schemas/Log');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');

describe('Encryption', () => {
    it('decrypts what it encrypted', () => {
        // Arrange
        const plain = '+27821234567';

        // Act
        const result = Encryption.decryptText(Encryption.encryptText(plain));

        // Assert
        expect(result).toBe(plain);
    });
});

describe('mapAuthToClient', () => {
    it('maps a plain object returned by .lean()', () => {
        // Arrange
        const auth = { _id: 'a1', user_id: 'u1', clearance: 2, work_categories: ['Water'] };

        // Act
        const result = mapAuthToClient(auth);

        // Assert
        expect(result).toMatchObject({ id: 'a1', userId: 'u1', clearance: 2, workCategories: ['Water'] });
    });
});

describe('Log schema', () => {
    it('accepts LOG as a target entity type (used by deleteLog)', async () => {
        // Arrange
        const log = new Log({
            log_id: new mongoose.Types.ObjectId(), timestamp: new Date(),
            event_type: 'SYSTEM_ERROR', severity: 'CRITICAL', action: 'Purged log',
            actor: { username: 'admin', clearance_at_time: 5 },
            target_entity: { entity_type: 'LOG', entity_id: new mongoose.Types.ObjectId() },
        });

        // Act + Assert
        await expect(log.validate()).resolves.toBeUndefined();
    });
});

describe('updateRequest status changes (FR-STF-005)', () => {
    const requestId = new mongoose.Types.ObjectId();
    const staff = { user_id: new mongoose.Types.ObjectId(), username: 'staff', clearance: 3, role: 'STAFF' };
    const requester = { user_id: new mongoose.Types.ObjectId(), username: 'requester', clearance: 0, role: 'REQUESTER' };
    let writer;

    beforeEach(() => {
        // Arrange (shared): a Submitted request; no real database is used
        jest.spyOn(Request, 'findById').mockReturnValue({ lean: async () => ({ _id: requestId, status: 'Submitted' }) });
        jest.spyOn(Request, 'findByIdAndUpdate').mockImplementation((id, update) => ({
            lean: async () => ({ _id: id, status: update.$set.status, status_history: [] }),
        }));
        writer = new DBUpdateWrite();
        jest.spyOn(writer, 'createAuditLog').mockResolvedValue();
    });

    afterEach(() => jest.restoreAllMocks());

    it('accepts the front-end value ASSIGNED as the next step', async () => {
        // Act
        const result = await writer.updateRequest(requestId, { status: 'ASSIGNED', comment: 'Triaged to Water' }, staff);

        // Assert
        expect(result.status).toBe('ASSIGNED');
        expect(Request.findByIdAndUpdate.mock.calls[0][1].$set.status).toBe('Assigned');
    });

    it('rejects skipping straight to CLOSED (negative)', async () => {
        // Act + Assert
        await expect(writer.updateRequest(requestId, { status: 'CLOSED', comment: 'Done' }, staff))
            .rejects.toThrow('Invalid status transition');
    });

    it('rejects a status change without a comment (negative)', async () => {
        // Act + Assert
        await expect(writer.updateRequest(requestId, { status: 'ASSIGNED' }, staff))
            .rejects.toThrow('mandatory comment');
    });

    it('rejects a status change by a requester (negative)', async () => {
        // Act + Assert
        await expect(writer.updateRequest(requestId, { status: 'ASSIGNED', comment: 'Please hurry' }, requester))
            .rejects.toThrow('Unauthorized');
    });
});