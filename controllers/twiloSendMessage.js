class TwiloSendMessage {
    twilio = require("twilio");

    
    client = this.twilio(process.env.TWILIO_accountSid, process.env.TWILIO_authToken);



    sendSMS(message,phoneNumber){
        const constMessage = this.client.messages.create({
            body: message,
            from: process.env.TWILIO_phonenumber,
            to: phoneNumber,
        });

    }

    sendEmail(emailaddress,subject,htmlBody){
        const response =  fetch("https://comms.twilio.com/v1/Emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization:
                    "Basic " + Buffer.from(process.env.TWILIO_accountSid + ":" + process.env.TWILIO_authToken).toString("base64"),
            },
            body: JSON.stringify({
                from: {address: process.env.TWILIO_email, name: "CivicConnect"},
                to: [{address: emailaddress}],
                content: {
                    subject: subject,
                    html: htmlBody,
                }
            })
        });

    }
    sendWhatsApp(message,whatapp){
        const constMessage =  this.client.messages.create({
            content: message,
            from: process.env.TWILIO_whatsapp,
            to: "whatsapp:"+whatapp,
        });
    }
}






