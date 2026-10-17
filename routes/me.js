const router = require('express').Router();
const { authenticate, requireApproved } = require('../middleware/authenticate');
const c = require('../controllers/meController');

router.use(authenticate, requireApproved);
router.put('/profile', c.profile);
router.put('/contact', c.contact);
router.put('/password', c.password);

module.exports = router;
