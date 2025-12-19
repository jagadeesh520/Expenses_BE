require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// configure CORS once
app.use(cors({
  origin: "*", // for testing. Replace with your Vercel URL for production: "https://your-app.vercel.app"
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

app.use(express.json());

// Use absolute path for uploads directory to match where files are saved
const fs = require('fs');
const uploadsPath = path.join(__dirname, "uploads");
console.log("📁 Server serving uploads from:", uploadsPath);

// Also check where cashier route saves files (should be the same)
const cashierUploadsPath = path.join(__dirname, "routes", "..", "uploads");
const cashierUploadsResolved = path.resolve(cashierUploadsPath);
console.log("💾 Cashier route saves files to:", cashierUploadsResolved);

if (!fs.existsSync(uploadsPath)) {
  console.warn("⚠️  Uploads directory does not exist! Creating it...");
  fs.mkdirSync(uploadsPath, { recursive: true });
} else {
  const files = fs.readdirSync(uploadsPath);
  console.log(`📸 Found ${files.length} files in uploads directory`);
  if (files.length > 0) {
    console.log("Sample files:", files.slice(0, 10));
    // Check if any of the missing files exist
    const missingFiles = [
      "1764693683080-Screenshot_20251202_221016.jpg",
      "1765299488030-1000071873.jpg",
      "1764740603186-Screenshot_2025-12-03-11-12-21-78_944a2809ea1b4cda6ef12d1db9048ed3.jpg"
    ];
    console.log("\n🔍 Checking for specific missing files:");
    missingFiles.forEach(file => {
      const filePath = path.join(uploadsPath, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ Found: ${file}`);
      } else {
        console.log(`  ❌ Missing: ${file}`);
      }
    });
  }
}
app.use("/uploads", express.static(uploadsPath));

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
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Drop the unique index on username if it exists (to allow multiple users with same username)
    try {
      const User = require('./models/User');
      const collection = User.collection;
      const indexes = await collection.indexes();
      
      // Check if username unique index exists
      const usernameIndex = indexes.find(idx => 
        idx.key && 
        idx.key.username === 1 && 
        idx.unique === true
      );
      
      if (usernameIndex) {
        console.log('Dropping unique index on username to allow multiple users...');
        try {
          if (usernameIndex.name) {
            await collection.dropIndex(usernameIndex.name);
          } else {
            await collection.dropIndex({ username: 1 });
          }
          console.log('Successfully dropped username unique index');
        } catch (dropError) {
          console.log('Note: Could not drop index automatically. You may need to drop it manually.');
          console.log('Run: db.users.dropIndex("username_1") in MongoDB shell');
        }
      }
    } catch (indexError) {
      console.log('Index cleanup completed (or index already removed)');
    }
    
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
