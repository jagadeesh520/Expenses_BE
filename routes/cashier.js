const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const Payment = require("../models/Payment");
const WorkerRequest = require("../models/workerRequest");

const router = express.Router();

// ==== Multer Storage ====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });


// ============================================================
// 1) UPLOAD EXCEL — CREATE or UPDATE CUSTOMERS
// ============================================================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const results = [];

    for (const row of rows) {
      const name = row.Name || row.name;
      if (!name) continue;

      const phone = row.phoneNum || row.Phone || row.phone || "";
      const totalAmount = Number(row.TotalAmount || row.Amount || 0) || 0;
      const paidAmount = Number(row.PaidAmount || row.paid || 0) || 0;

      let existing = phone
        ? await Payment.findOne({ phone })
        : await Payment.findOne({ name });

      if (existing) {
        if (paidAmount > 0) {
          existing.transactions.push({ amount: paidAmount });
        }

        if (totalAmount) existing.totalAmount = totalAmount;

        existing.recalculate();
        await existing.save();

        results.push({ action: "updated", id: existing._id, name: existing.name });
      } else {
        const p = new Payment({
          name,
          address: row.Address || "",
          phone,
          profession: row.Profession || "",
          totalAmount,
          transactions: paidAmount > 0 ? [{ amount: paidAmount }] : []
        });

        p.recalculate();
        await p.save();

        results.push({ action: "created", id: p._id, name: p.name });
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({ success: true, results });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});


// ============================================================
// 2) REGISTER CUSTOMER FROM SPICON FRONTEND FORM
// ============================================================
router.post(
  "/registerCustomer",
  upload.single("screenshot"),
  async (req, res) => {
    try {
      const customer = new Payment({
        // ========================
        // BASIC & PERSONAL DETAILS
        // ========================
        email: req.body.email,
        title: req.body.title,
        fullName: req.body.fullName,
        surname: req.body.surname,

        name: req.body.fullName + " " + req.body.surname, // Combined for display
        phone: req.body.mobileNumber,
        district: req.body.district,
        iceuEgf: req.body.iceuEgf,

        // DT CAMP (spiritual requirement)
        attendedDtCamp: req.body.attendedDtCamp,
        dtCampYear: req.body.dtCampYear,
        dtCampPlace: req.body.dtCampPlace,

        // ========================
        // FAMILY DETAILS
        // ========================
        groupType: req.body.groupType, // Family, employed, unemployed, volunteer, etc.
        gender: req.body.gender,
        age: req.body.age,

        spouseAttending: req.body.spouseAttending,
        spouseName: req.body.spouseName,

        // Children below 10
        childrenBelow10Count: req.body.childrenBelow10Count,
        childrenBelow10Names: req.body.childrenBelow10Names,

        // Children 10–14
        children10to14Count: req.body.children10to14Count,
        children10to14Names: req.body.children10to14Names,

        // Total family members
        familyMemberCount: req.body.familyMemberCount,

        // Delegates other than family
        otherDelegates: req.body.otherDelegates,

        // ========================
        // RECOMMENDATION DETAILS
        // ========================
        recommendedBy: req.body.recommendedBy,
        recommenderName: req.body.recommenderName,
        recommenderMobile: req.body.recommenderMobile,

        // ========================
        // PAYMENT DETAILS
        // ========================
        registrationCategory: req.body.registrationCategory, 
        totalAmount: Number(req.body.totalAmount) || 0,
        amountPaid: Number(req.body.amountPaid) || 0,
        dateOfPayment: req.body.dateOfPayment,
        transactionId: req.body.transactionId,
        modeOfPayment: req.body.modeOfPayment,

        transactions: req.body.amountPaid
          ? [
              {
                amount: Number(req.body.amountPaid),
                note: `Txn: ${req.body.transactionId}`,
                date: new Date(req.body.dateOfPayment),
              },
            ]
          : [],

        // ========================
        // ARRIVAL DETAILS
        // ========================
        arrivalDay: req.body.arrivalDay,
        arrivalTime: req.body.arrivalTime,

        // ========================
        // FILE UPLOAD
        // ========================
        paymentScreenshot: req.file ? req.file.filename : "",
      });

      customer.recalculate();
      await customer.save();

      res.json({ success: true, data: customer });
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);



// ============================================================
// 3) LIST ALL CUSTOMERS (FOR MOBILE APP)
// ============================================================
router.get("/list", async (req, res) => {
  try {
    const list = await Payment.find().sort({ name: 1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE CUSTOMER DETAILS
router.get("/customer/:id", async (req, res) => {
  try {
    const customer = await Payment.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 3) Get summary
router.get("/summary", async (req, res) => {
  try {
    const payments = await Payment.find();
    const totalAmount = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const balance = totalAmount - totalPaid;
    res.json({ totalAmount, totalPaid, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4) Add transaction (installment) to a payment record
router.post("/:id/transaction", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "Invalid amount" });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: "Not found" });

    payment.transactions.push({ amount: Number(amount), note: note || "" });
    payment.recalculate();
    await payment.save();

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5) Update customer data (edit total or name etc)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body || {};
    const p = await Payment.findById(id);
    if (!p) return res.status(404).json({ error: "Not found" });

    // allow editing name, address, profession, totalAmount
    if (update.name) p.name = update.name;
    if (update.address) p.address = update.address;
    if (update.profession) p.profession = update.profession;
    if (typeof update.totalAmount !== "undefined") p.totalAmount = Number(update.totalAmount);

    p.recalculate();
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6) Delete record (optional)
router.delete("/:id", async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cashier marks payment + uploads screenshot
router.post("/pay/:id", upload.any(), async (req, res) => {
  console.log("✔ FILES RECEIVED:", req.files);
    console.log("✔ BODY:", req.body);
  try {
    const updated = await WorkerRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: "paid",
        cashierPaidAt: new Date(),
        $push: { cashierImages: { $each: req.files.map(f => f.filename) } }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cashier payment failed" });
  }
});





module.exports = router;
