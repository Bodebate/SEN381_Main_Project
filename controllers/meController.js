const bcrypt = require('bcrypt');
const DBRead = require('../models/DatabaseRead');
const DBUpdateWrite = require('../models/DatabaseWriteUpdate');
const sender = require('../services/twilio');
const mask = require('../services/mask');

const read = new DBRead();
const write = new DBUpdateWrite();

// PUT /me/profile
exports.profile = async (req, res, next) => {
    try {
        const { firstName, lastName } = req.body || {};
        if (!firstName?.trim() || !lastName?.trim())
            return res.status(400).json({ message: 'First and last name are required' });
        res.json(await write.updateUser(req.actor.user_id,
            { firstName: firstName.trim(), lastName: lastName.trim() }, req.actor));
    } catch (err) { next(err); }
};

// PUT /me/password
exports.password = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        const found = await read.findUserForLogin(req.actor.username);
        if (!found || !(await bcrypt.compare(String(currentPassword || ''), found.passwordHash)))
            return res.status(400).json({ message: 'Current password is incorrect' });
        if (!newPassword || newPassword.length < 8)
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        await write.updateUser(req.actor.user_id, { password: newPassword }, req.actor);
        res.status(204).end();
    } catch (err) { next(err); }
};

// PUT /me/contact  -> ContactUpdateResult
exports.contact = async (req, res, next) => {
    try {
        const id = req.actor.user_id;
        const { email, phone, notifyVia, code } = req.body || {};

        // Second call: the code sent to a new phone number
        if (code) {
            const user = await write.confirmPhoneChange(id, code, req.actor);
            return res.json({ status: 'SAVED', user });
        }

        if (notifyVia === 'SMS' && !phone)
            return res.status(400).json({ message: 'Add a phone number to get SMS notifications' });
        if (notifyVia === 'EMAIL' && !email)
            return res.status(400).json({ message: 'Add an email address to get email notifications' });

        const current = await read.findUserById(id);
        const newPhone = phone ? DBUpdateWrite.normalizeToE164(phone) : null;
        const phoneChanged = newPhone && newPhone !== current.phone;

        // Email and notification channel save straight away
        const updates = { email: email || null, notificationPreference: notifyVia };
        if (!newPhone) updates.phone = null;          // removing a phone needs no code
        const user = await write.updateUser(id, updates, req.actor);

        // First call with a new phone number: send a code to that number
        if (phoneChanged) {
            const { code: newCode, phone: to } = await write.startPhoneChange(id, newPhone);
            await sender.sendSMS(`Your CivicConnect code is ${newCode}. It expires in 10 minutes.`, to);
            return res.json({ status: 'CODE_SENT', sentTo: mask(to) });
        }
        res.json({ status: 'SAVED', user });
    } catch (err) { next(err); }
};
