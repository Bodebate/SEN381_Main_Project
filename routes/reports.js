const router = require('express').Router();
const { authenticate, requireApproved, requireRole } = require('../middleware/authenticate');
const c = require('../controllers/reportController');

router.use(authenticate, requireApproved, requireRole('MANAGER', 'ADMIN'));
router.get('/dashboard', c.dashboard);
router.post('/export', c.exportCsv);

module.exports = router;
