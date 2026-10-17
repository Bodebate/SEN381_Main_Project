const router = require('express').Router();
const { authenticate, requireApproved, requireRole } = require('../middleware/authenticate');
const c = require('../controllers/userController');

router.use(authenticate, requireApproved);
router.get('/', requireRole('MANAGER', 'ADMIN'), c.list);
router.get('/directory', c.directory);
router.get('/assignable', requireRole('STAFF', 'MANAGER', 'ADMIN'), c.assignable);   // staff triage needs it
router.put('/:id/approval', requireRole('MANAGER', 'ADMIN'), c.decide);

module.exports = router;
