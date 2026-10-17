// Import all models so Mongoose registers them and syncs their indexes
require('./mongo-schemas/User');
require('./mongo-schemas/Request');
require('./mongo-schemas/Request-Group');
require('./mongo-schemas/Log');
require('./mongo-schemas/User-Authorization');

const mongoose = require('mongoose');

class DBConnect {
    /**
     * Ensures all Mongoose models are compiled and index definitions are synchronized with Atlas.
     */
    async createDB() {
        try {
            if (mongoose.connection.readyState !== 1) {
                throw new Error("Database connection is not established. Connect via config/db.js first.");
            }

            // Instruct Mongoose to ensure all model indexes are created
            await mongoose.connection.syncIndexes();
            console.log('All Mongoose schemas and indexes synchronized successfully.');
        } catch (err) {
            console.error('Error synchronizing database indexes:', err);
            throw err;
        }
    }
}

module.exports = DBConnect;