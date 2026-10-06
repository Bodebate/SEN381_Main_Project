const constMongoose = require('mongoose')

const constUser = require('./mongo-schemas/User')
const constRequest = require('./mongo-schemas/Request')
const constRequestGroups = require('./mongo-schemas/Reguest-Group')
const constLog = require('./mongo-schemas/Log')



const constMongoURI = "load from secrets vault"

constMongoose.connect(constMongoURI,
    {useNewUrlParser:true,
             useUnifiedTopology:true})
.then(()=> console.log('Successfully connected to atlas DB'))
.catch((err)=> console.error('Databse connection error:',err));

const constDB = constMongoose.connection;



//enforce document/collection validation
db.createCollection("requestGroup", {
    validator: {
        $jsonSchema: {
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
    }
}).then(()=> console.log('reqestGroup created successfully'))
    .catch((err)=> console.log('requestGroup failed to be created',err));

db.createCollection("log", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["log_id", "timestamp", "event_type", "severity", "actor", "action"],
            properties: {
                log_id: { bsonType: "objectId" },
                timestamp: { bsonType: "date" },
                event_type: {
                    enum: ["USER_AUTH", "REQUEST_LIFECYCLE", "NOTE_CREATED", "GROUP_ASSIGNED", "SECURITY_CHANGE", "SYSTEM_ERROR"],
                    description: "Must be a recognized domain event category"
                },
                severity: {
                    enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
                    description: "Log urgency level"
                },
                actor: {
                    bsonType: "object",
                    required: ["user_id", "username", "clearance_at_time"],
                    properties: {
                        user_id: { bsonType: "objectId" },
                        username: { bsonType: "string" },
                        clearance_at_time: { bsonType: "int", minimum: 0, maximum: 5 },
                        ip_address: { bsonType: ["string", "null"] }
                    }
                },
                target_entity: {
                    bsonType: "object",
                    required: ["entity_type", "entity_id"],
                    properties: {
                        entity_type: { enum: ["REQUEST", "USER", "GROUP", "NOTE"] },
                        entity_id: { bsonType: "objectId" }
                    }
                },
                action: { bsonType: "string" },
                changes: {
                    bsonType: ["object", "null"],
                    description: "Captures before and after states for security or status audits",
                    properties: {
                        field: { bsonType: "string" },
                        old_value: { bsonType: ["string", "int", "bool", "null"] },
                        new_value: { bsonType: ["string", "int", "bool", "null"] }
                    }
                },
                metadata: {
                    bsonType: ["object", "null"],
                    description: "Flexible key-value payload for contextual details"
                }
            }
        }
    }
}).then(()=> console.log('Log created successfully'))
    .catch((err)=> console.log('Log failed to be created',err));

db.createCollection("user", {
    validator: {
        $jsonSchema: {
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
    }
}).then(()=> console.log('User created successfully'))
  .catch((err)=> console.log('User failed to be created',err));

db.createCollection("request", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["details", "requesters", "security_level", "address", "active"],
            properties: {
                group_id: {bsonType: ["objectId", "null"]},
                title: {bsonTyppe: "string"},
                details: {bsonType: "string"},
                requesters: {
                    bsonType: "array",
                    items: {bsonType: "objectId"},
                    description: "Array of ObjectIds referencing the users collection"
                },
                security_level: {bsonType: "int", minimum: 0, maximum: 5},
                request_category: {bsonType: "array", items: {bsonType: "string"}},
                asigned_to: {bsonType: "objectId"},
                address: {bsonType: "string"},
                resolved: {bsonType: "bool"},
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
        }
    }
}).then(()=> console.log('Request created successfully'))
    .catch((err)=> console.log('Request failed to be created',err));

db.createCollection("UserAutherization",{
    Validator:{
        $jsonSchema:   {
            bsonType: "object",
            required: ["clearance","work_categories"],
            properties: {
                clearance: { bsonType: "int", minimum: 0, maximum: 5 },
                work_categories: { bsonType: "array", items: { bsonType: "string" } },
                reviewed_by:{bsonType: "objectId"},
                AcceptedDate: {bsonType: "date"}
            }
        }
    }
}).then(()=> console.log('UserAutherization created successfully'))
    .catch((err)=> console.log('UserAutherization failed to be created',err));
//Indexes:

db.log.createIndex({ timestamp: -1 });
db.log.createIndex({ "target_entity.entity_id": 1, timestamp: -1 });
db.log.createIndex({ "actor.user_id": 1, timestamp: -1 });
db.log.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000 });
db.request.createIndex({ active: 1, security_level: 1 });
db.request.createIndex({ group_id: 1 }, { sparse: true });
db.request.createIndex({ requesters: 1 });
db.user.createIndex({ username: 1 }, { unique: true });
db.user.createIndex({ email: 1 }, { unique: true, sparse: true });




