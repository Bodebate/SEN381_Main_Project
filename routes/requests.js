const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/authenticate');
const c = require('../controllers/requestController');

router.use(authenticate);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.put('/:id/status', requireRole('STAFF', 'MANAGER', 'ADMIN'), c.updateStatus);
router.post('/:id/notes', requireRole('STAFF', 'MANAGER', 'ADMIN'), c.addNote);

module.exports = router;