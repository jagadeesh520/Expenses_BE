const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" }
});

const paymentSchema = new mongoose.Schema({

  // BASIC DETAILS
  name: { type: String, required: true },
  age: Number,
  gender: String,
  contactNumber: String,
  phone: String,    // mapping from contactNumber
  address: String,
  profession: String,

  // FAMILY DETAILS
  married: String,
  spouseName: String,
  childrenCount: String,
  child1Name: String,
  child1Age: String,
  child2Name: String,
  child2Age: String,
  child3Name: String,
  child3Age: String,

  // EU/EGF DETAILS
  district: String,
  euEgf: String,
  inLocalCommittee: String,
  localRole: String,

  // RECOMMENDATION
  recommendedByRole: String,
  recommenderName: String,
  recommenderMobile: String,

  // REGISTRATION CATEGORY
  registrationCategory: String,

  // PAYMENT DETAILS
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["paid", "partial"],
    default: "partial"
  },

  modeOfPayment: String,
  dateOfPayment: String,
  transactionId: String,

  paymentScreenshot: String,

  // ALL PAYMENTS
  transactions: [transactionSchema],

  // TIMESTAMP
  createdAt: { type: Date, default: Date.now }
});

// Recalculate
paymentSchema.methods.recalculate = function () {
  this.paidAmount = this.transactions.reduce(
    (sum, t) => sum + (t.amount || 0),
    0
  );

  this.balance = this.totalAmount - this.paidAmount;
  this.status = this.balance <= 0 ? "paid" : "partial";
};

module.exports = mongoose.model("Payment", paymentSchema);
