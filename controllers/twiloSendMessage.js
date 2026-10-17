class TwiloSendMessage {
    // Required internally so the module load doesn't crash if variables are missing during testing
    twilio = require("twilio");

    // Lazy initialization getter for safer testing and environment decoupled initialization
    get client() {
        if (!this._client) {
            this._client = this.twilio(process.env.TWILIO_accountSid, process.env.TWILIO_authToken);
        }
        return this._client;
    }

    // FIXED: Added async/await and return keyword to trace delivery state
    async sendSMS(message, phoneNumber) {
        try {
            return await this.client.messages.create({
                body: message,
                from: process.env.TWILIO_phonenumber,
                to: phoneNumber,
            });
        } catch (error) {
            throw new Error(`Twilio SMS failed: ${error.message}`);
        }
    }

    // FIXED: Added async/await, returned response, and added verification status checks
    async sendEmail(emailaddress, subject, htmlBody) {
        const response = await fetch("https://comms.twilio.com/v1/Emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Basic " + Buffer.from(
                    process.env.TWILIO_accountSid + ":" + process.env.TWILIO_authToken
                ).toString("base64"),
            },
            body: JSON.stringify({
                from: { address: process.env.TWILIO_email, name: "CivicConnect" },
                to: [{ address: emailaddress }],
                content: {
                    subject: subject,
                    html: htmlBody,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Email gateway rejected request with status (${response.status})`);
        }
        return response;
    }

    // FIXED: Changed 'content' to 'body' parameter and added safety check for 'whatsapp:' prefix
    async sendWhatsApp(message, whatsappNumber) {
        try {
            const formattedTo = whatsappNumber.startsWith("whatsapp:") ? whatsappNumber : `whatsapp:${whatsappNumber}`;

            return await this.client.messages.create({
                body: message, // FIXED: Changed from content to body
                from: process.env.TWILIO_whatsapp,
                to: formattedTo,
            });
        } catch (error) {
            throw new Error(`Twilio WhatsApp failed: ${error.message}`);
        }
    }
}

module.exports = TwiloSendMessage;
