const express = require("express");
const WorkerRequest = require("../models/workerRequest");
const router = express.Router();

// 1. Fetch all worker requests
router.get("/requests", async (req, res) => {
  try {
    const list = await WorkerRequest.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Approve a request
router.post("/requests/:id/approve", async (req, res) => {
  try {
    const updated = await WorkerRequest.findByIdAndUpdate(
      req.params.id,
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Reject a request
router.post("/requests/:id/reject", async (req, res) => {
  try {
    const updated = await WorkerRequest.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
