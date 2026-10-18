const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const sender = require('../services/notify');
const mask = require('../services/mask');

const read = new DBRead();
const write = new DBUpdateWrite();

const signToken = user =>
    jwt.sign({ sub: user.id }, process.env.JWT_Secret, { expiresIn: '8h' });

async function sendCode(user) {
    const code = await write.setVerificationCode(user.id);
    const text = `Your CivicConnect code is ${code}. It expires in 10 minutes.`;
    if (user.notifyVia === 'SMS') {
        await sender.sendSMS(text, user.phone);
        return mask(user.phone);
    }
    await sender.sendEmail(user.email, 'Your CivicConnect code', `<p>${text}</p>`);
    return mask(user.email);
}

// POST /auth/login
exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        const found = await read.findUserForLogin(username);
        const ok = found && await bcrypt.compare(String(password || ''), found.passwordHash);
        if (!ok) return res.status(401).json({ message: 'Invalid username or password' });
        if (!found.user.isActive) return res.status(403).json({ message: 'Account disabled' });
        res.json({ user: found.user, token: signToken(found.user) });
    } catch (err) { next(err); }
};

// GET /auth/me
exports.me = async (req, res, next) => {
    try { res.json(await read.findUserById(req.actor.user_id)); } catch (err) { next(err); }
};

// POST /auth/logout (the client drops the token)
exports.logout = (req, res) => res.status(204).end();

const USERNAME_RULE = /^[A-Za-z0-9._-]{3,15}$/;

// POST /auth/register
exports.register = async (req, res, next) => {
    try {
        const { firstName, lastName, username, email, phone, notifyVia, password } = req.body || {};
        if (!firstName || !lastName || !username)
            return res.status(400).json({ message: 'Name and username are required' });
        if (!USERNAME_RULE.test(username))
            return res.status(400).json({ message: 'Username must be 3–15 letters, numbers, ".", "_" or "-"' });
        if (!password || password.length < 8)
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        if (notifyVia === 'SMS' ? !phone : !email)
            return res.status(400).json({ message: 'Give the contact the code should be sent to' });
        const user = await write.createUser({
            firstName, lastName, username, email: email || undefined, phone: phone || undefined,
            notificationPreference: notifyVia === 'SMS' ? 'SMS' : 'EMAIL', password,
        }, null);
        let sentTo = null;
        try { sentTo = await sendCode(user); }
        catch (err) { console.error('Sign-up code not sent:', err.message); }
        res.status(201).json({ userId: user.id, sentTo, codeSent: sentTo !== null });
    } catch (err) { next(err); }
};

// POST /auth/verify
exports.verify = async (req, res, next) => {
    try {
        const { userId, code } = req.body || {};
        const user = await write.verifyUserCode(userId, code);
        res.json({ user, token: signToken(user) });   // still PENDING approval
    } catch (err) { next(err); }
};

// POST /auth/resend-code
exports.resendCode = async (req, res, next) => {
    try {
        const user = await read.findUserById(req.body?.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.verified) return res.status(400).json({ message: 'Already verified' });
        try { res.json({ sentTo: await sendCode(user) }); }
        catch (err) {
            console.error('Code resend failed:', err.message);
            res.status(502).json({ message: "We couldn't send the code right now. Please try again shortly." });
        }
    } catch (err) { next(err); }
};

exports.signToken = signToken;
