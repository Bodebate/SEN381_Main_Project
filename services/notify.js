// Notifications via ntfy (https://ntfy.sh) for demonstration.
// ntfy cannot send real SMS: an "SMS" becomes a push notification in the ntfy app,
// on a topic derived from the recipient's phone number. Email is forwarded by ntfy as plain text.
// NOTIFY_MODE=console prints messages in the server terminal instead of sending them.
const consoleMode = () => process.env.NOTIFY_MODE === 'console';
const server = () => (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
const prefix = () => process.env.NTFY_TOPIC_PREFIX || 'civicconnect-demo';
const phoneTopic = (to) => `${prefix()}-${String(to).replace(/\D/g, '')}`;
const stripHtml = (html) => String(html).replace(/<[^>]+>/g, '').trim();

async function publish(topic, message, headers = {}) {
    const auth = process.env.NTFY_TOKEN ? { Authorization: `Bearer ${process.env.NTFY_TOKEN}` } : {};
    let res;
    try {
        res = await fetch(`${server()}/${topic}`, {
            method: 'POST',
            headers: { ...auth, ...headers },
            body: message,
            signal: AbortSignal.timeout(10_000),   // give up after 10 s instead of hanging the request
        });
    } catch (err) {
        // Network errors hide the real reason (DNS, timeout, TLS...) in err.cause
        const reason = err.cause?.code || err.cause?.message || err.message;
        throw new Error(`ntfy unreachable at ${server()}: ${reason}`);
    }
    if (!res.ok) throw new Error(`ntfy publish failed (${res.status}): ${await res.text()}`);
    return res.json();
}

class NtfySender {
    async sendSMS(message, to) {
        if (consoleMode()) return console.log(`[SMS to ${to}] ${message}`);
        return publish(phoneTopic(to), message, { Title: 'CivicConnect' });
    }

    // Kept so existing callers and mocks keep working; delivered the same way as SMS
    async sendWhatsApp(message, to) {
        return this.sendSMS(message, to);
    }

    async sendEmail(to, subject, html) {
        if (consoleMode()) return console.log(`[Email to ${to}] ${subject}: ${html}`);
        return publish(`${prefix()}-email`, stripHtml(html), { Title: subject, Email: to });
    }
}

module.exports = new NtfySender();
