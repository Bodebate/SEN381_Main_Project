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
        // 1. Create a clean plain-text fallback string by stripping HTML tags
        const textFallback = htmlBody.replace(/<[^>]*>/g, ' ');

        const response = await fetch("https://twilio.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + Buffer.from(
                    process.env.TWILIO_accountSid + ":" + process.env.TWILIO_authToken
                ).toString("base64"),
            },
            body: JSON.stringify({
                from: { address: process.env.TWILIO_email, name: "CivicConnect" },
                to: [{ address: emailaddress }],
                content: {
                    subject: subject,
                    html: htmlBody,
                    text: textFallback // Add plain text content to satisfy validation
                }
            })
        });

        if (!response.ok) {
            let errorDetails = "";
            try {
                // Catch the specific validation error body sent back by your server
                errorDetails = await response.text();
            } catch (e) {
                errorDetails = "Could not parse response body.";
            }

            console.error(`Email 422 Validation Error Details: ${errorDetails}`);
            throw new Error(`Email send failed (${response.status}): ${errorDetails}`);
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
