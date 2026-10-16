const jwt = require('jsonwebtoken');
const User = require('../models/mongo-schemas/User');

async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Not signed in' });

        const { sub } = jwt.verify(header.slice(7), process.env.JWT_Secret);
        const user = await User.findById(sub).lean();
        if (!user || !user.is_active) return res.status(401).json({ message: 'Account not active' });

        req.actor = {
            user_id: user._id,
            username: user.username,
            role: user.role,
            clearance: user.clearance,
            work_categories: user.work_categories || [],   // needed by buildRequestAccessFilter
            approval_status: user.approval_status,
            ip_address: req.ip,
        };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired session' });
    }
}

// Blocks PENDING and REJECTED accounts. Used on every route except /auth/me and /auth/logout.
const requireApproved = (req, res, next) =>
    req.actor?.approval_status === 'APPROVED'
        ? next()
        : res.status(403).json({ message: 'Account awaiting approval' });

const requireRole = (...roles) => (req, res, next) =>
    roles.includes(req.actor?.role)
        ? next()
        : res.status(403).json({ message: 'Access denied' });

module.exports = { authenticate, requireApproved, requireRole };
