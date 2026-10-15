require('dotenv').config({quiet:true});
const connectDB = require("./config/db");
const DBConnect = require("./models/DBConnect");
const {createApp} =require("./app");

const port = Number(process.env.PORT) || 3000;
(async () => {
    await connectDB();
    await new DBConnect().createDB();
    createApp().listen(port,() => console.log(`CivivConnect API on http://localhost:${port}/api`));
})();