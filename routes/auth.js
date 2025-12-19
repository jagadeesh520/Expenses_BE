const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// REGISTER USER
router.post('/register', [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['admin','cashier','registrar','worker'])   // <<< registrar added
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;

  try {
    let existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, email, passwordHash, role: role || 'worker' });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGIN USER (supports both username and email)
router.post('/login', [
  body('username').notEmpty(),
  body('password').exists()
], async (req,res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password, role, region } = req.body;

  try {
    // Build query to find user
    let query = {
      $or: [
        { username: username },
        { email: username }
      ]
    };

    // If role is provided, filter by role
    if (role) {
      query.role = role;
    }

    // If region is provided, filter by region
    if (region) {
      query.region = region;
    }

    // Try to find user(s) matching the criteria
    let users = await User.find(query);
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // If multiple users found, try to find one with matching password
    let user = null;
    for (let u of users) {
      const isMatch = await bcrypt.compare(password, u.passwordHash);
      if (isMatch) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, region: user.region }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        username: user.username,
        role: user.role,
        region: user.region
      },
      token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
