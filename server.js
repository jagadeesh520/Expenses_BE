require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// configure CORS once
app.use(cors({
  origin: "*", // for testing. Replace with your Vercel URL for production: "https://your-app.vercel.app"
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// routes (same order as you had)
const cashierRoutes = require('./routes/cashier');
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const workerRoutes = require("./routes/worker");
const adminRoutes = require("./routes/admin");
const adminSummaryRoutes = require("./routes/adminSummary");

app.use('/api/cashier', cashierRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminSummaryRoutes);

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
