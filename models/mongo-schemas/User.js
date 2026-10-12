const constMongoose = require('mongoose');
const { Schema } = constMongoose;

const constUserSchema = new Schema(
    {
        bsonType: "object",
        required: ["username", "password_hash", "first_name", "last_name", "clearance"],
        properties: {
            username: { bsonType: "string" },
            password_hash: { bsonType: "string" },
            first_name: { bsonType: "string" },
            last_name: { bsonType: "string" },
            clearance: { bsonType: "int", minimum: 0, maximum: 5 },
            work_categories: { bsonType: "array", items: { bsonType: "string" } },
            email: { bsonType: ["string", "null"], pattern: "^.+@.+\\..+$" },
            phone: { bsonType: ["string", "null"], pattern: "^[0-9]{10}$" },
            whatsapp: { bsonType: ["string", "null"], pattern: "^[0-9]{10}$" }

        }
    }
);

const User = constMongoose.model('User',constUserSchema);