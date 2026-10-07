class TwiloSendMessage {
    twilio = require("twilio");

    accountSid = "AC09a394a580493f7f551496b4c9acf400";
    authToken = "616af50a77094821950d992337117dc3";
    client = twilio(accountSid, authToken);



    sendSMS(message,phoneNumber){
        const constMessage = this.client.messages.create({
            body: message,
            from: "+17372508034",
            to: phoneNumber,
        });

    }

    sendEmail(emailaddress,subject,htmlBody){
        const response =  fetch("https://comms.twilio.com/v1/Emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization:
                    "Basic " + Buffer.from(accountSid + ":" + authToken).toString("base64"),
            },
            body: JSON.stringify({
                from: {address: "AC09a394a580493f7f551496b4c9acf400@twilio.email", name: "CivicConnect"},
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
            from: "whatsapp:+17372508034",
            to: "whatsapp:"+whatapp,
        });
    }
}






