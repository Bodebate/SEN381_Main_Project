const twilio = require('twilio');

// NOTIFY_MODE=console prints messages in the server terminal instead of sending them.
// Useful in development and with Twilio trial accounts (which only reach verified numbers).
const consoleMode = () => process.env.NOTIFY_MODE === 'console';

class TwilioSender {
    // Created on first use, so requiring this file never fails when Twilio isn't configured (e.g. in tests)

    get client() {
        if (consoleMode){return null}
            if (!this._client) this._client = twilio(process.env.TWILIO_accountSid, process.env.TWILIO_authToken);
            return this._client;

    }

    async sendSMS(message, to) {
        if (consoleMode()) return console.log(`[SMS to ${to}] ${message}`);
        return this.client.messages.create({ body: message, from: process.env.TWILIO_phonenumber, to });
    }

    async sendWhatsApp(message, to) {
        if (consoleMode()) return console.log(`[WhatsApp to ${to}] ${message}`);
        // TWILIO_whatsapp already holds the 'whatsapp:+...' sender
        return this.client.messages.create({ body: message, from: process.env.TWILIO_whatsapp, to: `whatsapp:${to}` });
    }

    async sendEmail(to, subject, html) {
        if (consoleMode()) return console.log(`[Email to ${to}] ${subject}: ${html}`);
        const res = await fetch('https://comms.twilio.com/v1/Emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Basic ' + Buffer.from(
                    `${process.env.TWILIO_accountSid}:${process.env.TWILIO_authToken}`).toString('base64'),
            },
            body: JSON.stringify({
                from: { address: process.env.TWILIO_email, name: 'CivicConnect' },
                to: [{ address: to }],
                content: { subject, html },
            }),
        });
        if (!res.ok) throw new Error(`Email send failed (${res.status})`);
    }
}

module.exports = new TwilioSender();
