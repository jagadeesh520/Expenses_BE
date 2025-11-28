require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Load routes FIRST
const cashierRoutes = require('./routes/cashier');     // <-- Important
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const workerRoutes = require("./routes/worker");
const adminRoutes = require("./routes/admin");
const adminSummaryRoutes = require("./routes/adminSummary");
app.use("/uploads", express.static("uploads"));

// ✅ Register routes — correct order
app.use('/api/cashier', cashierRoutes);   // <-- Must be BEFORE protectedRoutes
app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);         // <-- This should be AFTER cashier
app.use('/api/worker', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminSummaryRoutes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
