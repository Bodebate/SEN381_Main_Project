module.exports = (err, req, res, next) => {
    let status = err.status;
    if (!status) {
        if (err.code === 11000) status = 409;                                   // duplicate username or email
        else if (err.name === 'ValidationError' || err.name === 'CastError') status = 400;
        else if (/^(Validation Error|Invalid|Bad Request)/.test(err.message)) status = 400;
        else if (/^Unauthorized/.test(err.message)) status = 403;
        else if (/not found/i.test(err.message)) status = 404;
        else status = 500;
    }
    if (status === 500) console.error(err);
    const message = status === 500 ? 'Something went wrong'
        : status === 409 ? 'That username or email is already in use' : err.message;
    res.status(status).json({ message });
};
