module.exports = (err, req, res, next) => {
    const msg = err.message || 'Server error';
    let status = err.status; // the DB layer already sets 401 in some places
    if (!status) {
        if (/^(Invalid|Validation)/i.test(msg)) status = 400;
        else if (/^Unauthorized/i.test(msg)) status = 403;
        else if (/not found/i.test(msg)) status = 404;
        else status = 500;
    }
    if (status === 500) console.error(err);
    res.status(status).json({ message: status === 500 ? 'Server error' : msg });
};