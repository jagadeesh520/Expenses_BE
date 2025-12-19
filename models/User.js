const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: false },
  username: { type: String, required: true }, // Removed unique constraint to allow multiple users with same username
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['chairperson', 'treasurer', 'registrar', 'coordinator', 'lac_convener', 'regional_coordinator'],
    required: true
  },
  region: {
    type: String,
    enum: ['East Rayalaseema', 'West Rayalaseema'],
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
