const router = require('express').Router();
const { authenticate, requireApproved, requireRole } = require('../middleware/authenticate');
const c = require('../controllers/requestGroupController');

router.use(authenticate, requireApproved, requireRole('STAFF', 'MANAGER', 'ADMIN'));
router.get('/', c.list);
router.post('/', c.create);

module.exports = router;
