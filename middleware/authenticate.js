const jwt = require('jsonwebtoken');
const User = require('../models/mongo-schemas/User');

async function authenticate(req,res,next){
    try{
        const token = (req.headers.authorization||'').replace(/^Bearer /,'');
        if (!token) return res.status(401).json({message: 'Not signed in'});

        const {sub} = jwt.verify(token,process.env.JWT_Secret);
        const user = await  User.findById(sub).lean();
        if (!user || !user.is_active) return res.status(401).json({message: 'Account not active'});

        req.actor = {
            user_id: user._id,
            username: user.username,
            role: user.role,
            clearance: user.clearance,
            ip_address: req.ip,
        };
        next();
    } catch {
        res.status(401).json({message: 'Invalid or expired session'});
    }
}

const requireRole = (...roles) => (req,res,next) =>
    roles.includes((req.actor?.role) ? next() : res.status(403).json({message: 'Access denied'}));

module.exports = {authenticate,requireRole};