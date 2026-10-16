const router = require('express').Router();
const { authenticate, requireApproved } = require('../middleware/authenticate');
const { categories, departments } = require('../config/lookups');

// middleware per route, not router.use: this router is mounted at /api
router.get('/categories', authenticate, requireApproved, (req, res) => res.json(categories));
router.get('/departments', authenticate, requireApproved, (req, res) => res.json(departments));

module.exports = router;
