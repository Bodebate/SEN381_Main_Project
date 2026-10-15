const jwt = require('jsonwebtoken');
const User = require('../models/mongo-schemas/User');

async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ message: 'Not signed in' });

        const { sub } = jwt.verify(token, process.env.JWT_Secret);
        const user = await User.findById(sub)
            .select('role clearance work_categories approval_status is_active')
            .lean();
        if (!user || !user.is_active || user.approval_status !== 'APPROVED') {
            return res.status(401).json({ message: 'Account not active' });
        }

        req.actor = {
            user_id: user._id,
            role: user.role,               // 'REQUESTER' | 'STAFF' | 'MANAGER' | 'ADMIN'
            clearance: user.clearance,
            work_categories: user.work_categories || [],
        };
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}

const requireRole = (...roles) => (req, res, next) =>
    roles.includes(req.actor?.role)
        ? next()
        : res.status(403).json({ message: 'Forbidden' });

module.exports = { authenticate, requireRole };