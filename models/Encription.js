// Encryption keys configuration (Replace with real values pulled from a secure secrets vault)
require('dotenv').config();
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const FIXED_IV = Buffer.from(process.env.FIXED_IV, "hex")
class Encription {


    encryptText(text) {
        if (!text) return text;
        const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, FIXED_IV);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }



    decryptText(cipherText) {
        if (!cipherText) return cipherText;
        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, FIXED_IV);
        return decipher.update(cipherText, 'hex', 'utf8');
    }
}
module.exports = new Encription();