const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// accessible by any authenticated user
router.get('/me', authenticate, async (req, res) => {
  // return basic user info from token
  res.json({ id: req.user.id, role: req.user.role });
});

// admin-only route
router.get('/admin/dashboard', authenticate, authorize(['admin']), (req, res) => {
  res.json({ msg: 'Welcome admin dashboard' });
});

// cashier-only route
router.get('/cashier/dashboard', authenticate, authorize(['cashier']), (req, res) => {
  res.json({ msg: 'Welcome cashier dashboard' });
});

// worker-only route
router.get('/worker/dashboard', authenticate, authorize(['worker']), (req, res) => {
  res.json({ msg: 'Welcome worker dashboard' });
});

module.exports = router;
