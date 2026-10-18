class TextBeeService {

    async sendSMS(recipient, message) {
        console.log(`Sending SMS to ${recipient}: ${message}`);
        const res = await fetch(
            'https://api.textbee.dev/api/v1/gateway/send-sms',
            {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.TEXTBEE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceId: process.env.TEXTBEE_API_DeviceID,
                    recipients: [recipient],
                    message: message,
                }),
            }
        );
        
        console.log('TextBee API response status:', res.status);
        console.log(res.json());
    }
}

module.exports = new TextBeeService();

  



