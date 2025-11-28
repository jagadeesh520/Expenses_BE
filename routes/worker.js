const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const WorkerRequest = require("../models/workerRequest");

const router = express.Router();

/** =============================
 *  📌 MULTER STORAGE SETUP
 *  ============================= */
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

/** =========================================
 * 1️⃣ Worker raises request (with image upload)
 * ========================================= */
router.post("/request", upload.array("workerImage", 5), async (req, res) => {
  try {
    const request = new WorkerRequest({
      workerId: req.body.workerId,
      title: req.body.title,
      amount: req.body.amount,
      description: req.body.description,
      workerImages: req.files ? req.files.map(f => f.filename) : [],
      status: "pending",
    });

    await request.save();
    res.json({ success: true, data: request });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit request" });
  }
});



/** =====================================================
 * 2️⃣ Worker sees their own requests
 * ===================================================== */
router.get("/my-requests/:workerId", async (req, res) => {
  const list = await WorkerRequest.find({ workerId: req.params.workerId })
    .sort({ createdAt: -1 });
  res.json(list);
});

/** =====================================================
 * 3️⃣ Worker confirms they received cash
 * ===================================================== */
router.post("/request/:id/received", async (req, res) => {
  try {
    const update = await WorkerRequest.findByIdAndUpdate(
      req.params.id,
      { status: "received", receivedAt: new Date() },
      { new: true }
    );
    res.json(update);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/** =====================================================
 * Extra Request (not used now but kept for reference)
 * ===================================================== */
router.post("/request/:id/extra", async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const request = await WorkerRequest.findById(id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  request.extraRequested = amount;
  request.extraStatus = "pending";
  request.status = "pendingExtra";

  await request.save();
  res.json({ success: true, message: "Extra amount requested", data: request });
});

/** =====================================================
 * Return Request (not used now but kept)
 * ===================================================== */
router.post("/request/:id/return", async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const request = await WorkerRequest.findById(id);
  if (!request) return res.status(404).json({ error: "Request not found" });

  request.returnRequested = amount;
  request.returnStatus = "pending";
  request.status = "pendingReturn";

  await request.save();
  res.json({ success: true, message: "Return request submitted", data: request });
});

module.exports = router;
