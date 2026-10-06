const constMongoose = require('mongoose');
const { Schema } = constMongoose;

const constUserAutherizationSchema = new Schema(
    {
        bsonType: "object",
        required: ["clearance","work_categories"],
        properties: {
            clearance: { bsonType: "int", minimum: 0, maximum: 5 },
            work_categories: { bsonType: "array", items: { bsonType: "string" } },
            reviewed_by:{bsonType: "objectId"},
            AcceptedDate: {bsonType: "date"}
        }
    }
);

const UserAutherization = constMongoose.model('UserAutherization',constUserAutherizationSchema);