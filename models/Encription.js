// Encryption keys configuration (Replace with real values pulled from a secure secrets vault)
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6", "utf-8"); // Must be exactly 32 bytes
const FIXED_IV = Buffer.from("static_iv_bytes", "utf-8"); // Must be exactly 12 bytes to preserve query consistency

function encryptText(text) {
    if (!text) return text;
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, FIXED_IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptText(cipherText) {
    if (!cipherText) return cipherText;
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, FIXED_IV);
    let decrypted = decipher.update(cipherText, 'hex', 'utf8'); 
    return decrypted;
}