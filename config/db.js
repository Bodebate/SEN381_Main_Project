const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || process.env.MONGOURI;
        if (!mongoURI) {
            console.error('FATAL: MONGODB_URI environment variable is not defined.');
            process.exit(1);
        }

        // Configure Mongoose options if needed
        await mongoose.connect(mongoURI);
        console.log('Successfully connected to Atlas DB connection pool');

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });

    } catch (err) {
        console.error('Database connection initialization error:', err);
        process.exit(1); // Stop the server if initial connection fails
    }
};

module.exports = connectDB;