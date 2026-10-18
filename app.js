const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandle');

function createApp() {
    const app = express();
    app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
    app.use(express.json());
    app.use(require('./middleware/rejectOperators'));   // MongoDB operator injection guard (CodeQL js/sql-injection)

    app.get('/api/health', (req, res) => res.json({ ok: true }));
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/requests', require('./routes/requests'));
    app.use('/api/request-groups', require('./routes/request-groups'));
    app.use('/api/users', require('./routes/users'));
    app.use('/api/me', require('./routes/me'));
    app.use('/api/reports', require('./routes/reports'));
    app.use('/api', require('./routes/lookups'));      // /api/categories, /api/departments

    app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
    app.use(express.static(path.join(__dirname, 'views', 'dist', 'civicconnect','browser')));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, 'views', 'dist', 'civicconnect','browser', 'index.html'));
    });


    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
