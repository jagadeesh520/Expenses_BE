const express = require("express");
const WorkerRequest = require("../models/workerRequest");
const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const [stats] = await WorkerRequest.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          totalAmount: { $sum: "$amount" },
          totalPaidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          }
        }
      }
    ]);

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Summary load failed" });
  }
});

module.exports = router;
