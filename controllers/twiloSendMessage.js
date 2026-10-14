class TwiloSendMessage {
    twilio = require("twilio");

    
    client = this.twilio(Process.env.TWILIO_accountSid, Process.env.TWILIO_authToken);



    sendSMS(message,phoneNumber){
        const constMessage = this.client.messages.create({
            body: message,
            from: Process.env.TWILIO_phonenumber,
            to: phoneNumber,
        });

    }

    sendEmail(emailaddress,subject,htmlBody){
        const response =  fetch("https://comms.twilio.com/v1/Emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization:
                    "Basic " + Buffer.from(Process.env.TWILIO_accountSid + ":" + Process.env.TWILIO_authToken).toString("base64"),
            },
            body: JSON.stringify({
                from: {address: Process.env.TWILIO_email, name: "CivicConnect"},
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
            from: Process.env.TWILIO_whatsapp,
            to: "whatsapp:"+whatapp,
        });
    }
}






