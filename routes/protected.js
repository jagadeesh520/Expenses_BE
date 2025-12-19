const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// accessible by any authenticated user
router.get('/me', authenticate, async (req, res) => {
  // return basic user info from token
  res.json({ id: req.user.id, role: req.user.role });
});

// admin/chairperson/registrar/regional_coordinator-only route
router.get('/admin/dashboard', authenticate, authorize(['admin', 'chairperson', 'registrar', 'regional_coordinator']), (req, res) => {
  res.json({ msg: 'Welcome admin dashboard' });
});

// cashier/treasurer-only route
router.get('/cashier/dashboard', authenticate, authorize(['cashier', 'treasurer']), (req, res) => {
  res.json({ msg: 'Welcome cashier dashboard' });
});

// worker/coordinator/lac_convener-only route
router.get('/worker/dashboard', authenticate, authorize(['worker', 'coordinator', 'lac_convener']), (req, res) => {
  res.json({ msg: 'Welcome worker dashboard' });
});

module.exports = router;
