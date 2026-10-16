const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const c = require('../controllers/authController');

router.post('/login', c.login);
router.post('/register', c.register);
router.post('/verify', c.verify);
router.post('/resend-code', c.resendCode);
router.get('/me', authenticate, c.me);          // pending users allowed: no requireApproved
router.post('/logout', authenticate, c.logout);

module.exports = router;
