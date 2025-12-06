const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, default: "" }
});

const paymentSchema = new mongoose.Schema({
  // REGION
  region: {
    type: String,
    required: true,
    enum: ["East Rayalaseema", "West Rayalaseema"]
  },

  // PERSONAL DETAILS
  email: String,
  title: String,
  fullName: String,
  surname: String,
  name: String, // fullName + surname
  gender: String,
  age: Number,
  mobile: String,
  maritalStatus: String,

  // DT CAMP DETAILS
  dtcAttended: String,
  dtcWhen: String,
  dtcWhere: String,

  // DISTRICT + EGF
  district: String,
  iceuEgf: String,

  // RECOMMENDATION
  recommendedByRole: String,
  recommenderContact: String,

  // GROUP TYPE
  groupType: String,

  // FAMILY DETAILS
  spouseAttending: String,
  spouseName: String,

  childBelow10Count: String,
  childBelow10Names: String,

  child10to14Count: String,
  child10to14Names: String,

  totalFamilyMembers: String,
  delegatesOther: String,

  // PAYMENT DETAILS
  amountPaid: { type: Number, default: 0 },
  paymentMode2: String,
  dateOfPayment: String,
  transactionId: String,
  paymentScreenshot: String,

  // ARRIVAL DETAILS
  arrivalDay: String,
  arrivalTime: String,

  // TRANSACTION HISTORY
  transactions: [transactionSchema],

  // AUTO-CALCULATED FIELDS
  totalAmount: { type: Number, default: 0 },   // total fee to be paid
  balance: { type: Number, default: 0 },

  // PAYMENT STATUS (Based on balance)
  status: {
    type: String,
    enum: ["paid", "partial"],
    default: "partial"
  },

  // REGISTRATION APPROVAL STATUS (for Admin Approval)
  registrationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  // UNIQUE REGISTRATION ID
  uniqueId: String,

  // APPROVAL DETAILS
  approvedAt: Date,
  approvedBy: String,

  // REJECTION DETAILS
  rejectedAt: Date,
  rejectedBy: String,
  rejectionReason: String,

  createdAt: { type: Date, default: Date.now }
});


// ================= AUTO RECALCULATE PAYMENT =================
paymentSchema.methods.recalculate = function () {
  const totalPaid = this.transactions.reduce(
    (sum, t) => sum + (t.amount || 0),
    0
  );

  this.amountPaid = totalPaid;
  this.balance = this.totalAmount - totalPaid;
  this.status = this.balance <= 0 ? "paid" : "partial"; // auto update payment status
};

module.exports = mongoose.model("Payment", paymentSchema);