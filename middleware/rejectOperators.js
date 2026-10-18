// Blocks MongoDB operator injection: request data may not contain keys that start with "$" or contain "."
// (e.g. { "username": { "$ne": "" } }). Mongoose already casts ids; this covers every other field in one place.
const hasOperator = v => v !== null && typeof v === 'object' &&
    Object.entries(v).some(([k, x]) => k.startsWith('$') || k.includes('.') || hasOperator(x));

module.exports = (req, res, next) =>
    hasOperator(req.body) || hasOperator(req.query)
        ? res.status(400).json({ message: 'Invalid characters in request' })
        : next();
