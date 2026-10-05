const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const app = express();
app.use(express.urlencoded({ extended: false }));


app.post('/sms', (req, res) => {
    const twiml = new MessagingResponse();

    // Access data sent by Twilio (e.g., sender's number and message text)
    const fromNumber = req.body.From;
    const messageBody = req.body.Body;
})