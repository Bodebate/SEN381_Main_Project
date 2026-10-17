const router = require('express').Router();
const { authenticate, requireApproved, requireRole } = require('../middleware/authenticate');
const c = require('../controllers/requestController');

const STAFF = ['STAFF', 'MANAGER', 'ADMIN'];

router.use(authenticate, requireApproved);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.post('/', requireRole('REQUESTER'), c.create);
router.post('/:id/comments', requireRole('REQUESTER', ...STAFF), c.addComment);
router.post('/:id/notes', requireRole(...STAFF), c.addNote);
router.put('/:id/triage', requireRole(...STAFF), c.triage);
router.put('/:id/assignee', requireRole('MANAGER', 'ADMIN'), c.assignee);
router.put('/:id/due-date', requireRole(...STAFF), c.dueDate);
router.put('/:id/category', requireRole(...STAFF), c.category);
router.put('/:id/status', requireRole(...STAFF), c.updateStatus);

module.exports = router;
