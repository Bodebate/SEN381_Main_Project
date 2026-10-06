const constMongoose = require('mongoose');
const { Schema } = constMongoose;

const constRequestGroupSchema = constMongoose.Schema(
    {
        bsonType: "object",
        required: ["created_at", "created_by", "status"],
        properties: {
            created_at: { bsonType: "date" },
            created_by: { bsonType: "objectId" },
            title: { bsonType: "string" },
            primary_request_id: { bsonType: "objectId" }, // The anchor request
            notes: {
                bsonType: "array",
                items: {
                    bsonType: "object",
                    required: ["note_id", "details", "category", "user_id", "date"],
                    properties: {
                        note_id: {bsonType: "objectId"},
                        details: {bsonType: "string"},
                        category: {bsonType: "string"},
                        user_id: {bsonType: "objectId"},
                        date: {bsonType: "date"}
                    }
                }
            }
        }
    }
)

const RequestGroup = constMongoose.model('RequestGroup',constRequestGroupSchema);
