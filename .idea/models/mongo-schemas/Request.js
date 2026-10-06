const constMongoose = require('mongoose');
const { Schema } = constMongoose;

const constRequestSchema = new Schema({
            bsonType: "object",
            required: ["details", "requesters", "security_level", "address", "active"],
            properties: {
                group_id: {bsonType: ["objectId", "null"]},
                title:{bsonTyppe: "string"},
                details: {bsonType: "string"},
                requesters: {
                    bsonType: "array",
                    items: {bsonType: "objectId"},
                    description: "Array of ObjectIds referencing the users collection"
                },
                security_level: {bsonType: "int", minimum: 0, maximum: 5},
                request_category: {bsonType: "array", items: {bsonType: "string"}},
                asigned_to: {bsonType:"objectId"},
                address: {bsonType: "string"},
                resolved:{bsonType:"bool"} ,
                closed: {bsonType: "bool"},
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
        });

const Request = constMongoose.model('Request',constRequestSchema);
