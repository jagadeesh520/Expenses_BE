const mongoose = require("mongoose");

const WorkerRequestSchema = new mongoose.Schema({
  workerId: String,
  title: String,
  amount: Number,
  description: String,
  status: {
    type: String,
    default: "pending"
  },

  // MULTIPLE IMAGES
  workerImages: [String],
  cashierImages: [String],

  approvedAt: Date,
  cashierPaidAt: Date,
  receivedAt: Date,

}, { timestamps: true });

module.exports = mongoose.model("WorkerRequest", WorkerRequestSchema);
