const mongoose = require("mongoose");

const PaymentRequestSchema = new mongoose.Schema({
  // Request creator details
  requestedBy: {
    type: String, // User ID
    required: true
  },
  requestedByName: {
    type: String,
    required: true
  },
  requesterRole: {
    type: String,
    enum: ['coordinator', 'lac_convener'],
    required: true
  },
  region: {
    type: String,
    enum: ['East Rayalaseema', 'West Rayalaseema'],
    required: true
  },

  // Request details
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requestedAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Request images (supporting documents)
  requestImages: [String],

  // Approval workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'completed'],
    default: 'pending'
  },
  
  // Registrar approval
  approvedBy: {
    type: String, // Registrar user ID
  },
  approvedByName: {
    type: String,
  },
  approvedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  rejectedAt: {
    type: Date,
  },

  // Cashier payment details
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentProofImages: [String],
  paidBy: {
    type: String, // Cashier user ID
  },
  paidByName: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
  paymentNote: {
    type: String,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
PaymentRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("PaymentRequest", PaymentRequestSchema);


