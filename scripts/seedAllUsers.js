const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function insertAllUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = [
      // EAST RAYALASEEMA
      {
        name: "M.Mahesh",
        username: "Registrar",
        email: "registrar.er@expenses.local",
        password: "9491383584",
        role: "registrar",
        region: "East Rayalaseema",
      },
      {
        name: "Babu",
        username: "Treasurer",
        email: "treasurer.er@expenses.local",
        password: "Babu@87",
        role: "treasurer",
        region: "East Rayalaseema",
      },
      {
        name: "V Victor Paul",
        username: "Chairperson@2026",
        email: "chairperson.er@expenses.local",
        password: "spicon@2026",
        role: "chairperson",
        region: "East Rayalaseema",
      },
      {
        name: "Naresh Behera",
        username: "ER_COORDINATOR",
        email: "coordinator.er@expenses.local",
        password: "Jery@2026",
        role: "coordinator",
        region: "East Rayalaseema",
      },
      {
        name: "Bro. Erri Swamy, Koduru",
        username: "Kathi1699",
        email: "kathi1699.er@expenses.local",
        password: "Kathi@2026",
        role: "lac_convener",
        region: "East Rayalaseema",
      },
      // WEST RAYALASEEMA
      {
        name: "Bro Jayanna, Jmd",
        username: "jayanna",
        email: "jayanna.wr@expenses.local",
        password: "161957",
        role: "chairperson",
        region: "West Rayalaseema",
      },
      {
        name: "SUDHAKAR",
        username: "Persis#321",
        email: "persis321.wr@expenses.local",
        password: "1234",
        role: "registrar",
        region: "West Rayalaseema",
      },
      {
        name: "Bro Murali, Kadapa",
        username: "treasurer",
        email: "treasurer.wr@expenses.local",
        password: "treasurer@123",
        role: "treasurer",
        region: "West Rayalaseema",
      },
      {
        name: "Bro Vinod",
        username: "spicon26",
        email: "spicon26.wr@expenses.local",
        password: "Dvk@s26",
        role: "coordinator",
        region: "West Rayalaseema",
      },
      {
        name: "Bro Prasad, Pld",
        username: "PSJU7679",
        email: "psju7679.wr@expenses.local",
        password: "1979",
        role: "lac_convener",
        region: "West Rayalaseema",
      },
      {
        name: "Bro Ravi Rajendra Pdt",
        username: "trrr",
        email: "trrr.wr@expenses.local",
        password: "191062",
        role: "regional_coordinator",
        region: "West Rayalaseema",
      },
    ];

    for (let user of users) {
      const exists = await User.findOne({ username: user.username });
      if (exists) {
        console.log(`Already exists: ${user.username} (${user.name})`);
        // Update existing user
        const hash = await bcrypt.hash(user.password, 10);
        await User.findByIdAndUpdate(exists._id, {
          name: user.name,
          email: user.email,
          passwordHash: hash,
          role: user.role,
          region: user.region,
        });
        console.log(`Updated: ${user.username}`);
        continue;
      }

      const hash = await bcrypt.hash(user.password, 10);

      await User.create({
        name: user.name,
        username: user.username,
        email: user.email,
        passwordHash: hash,
        role: user.role,
        region: user.region,
      });

      console.log(`Inserted: ${user.username} (${user.name}) - ${user.region}`);
    }

    console.log("\nAll users inserted/updated successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error inserting users:", err);
    process.exit(1);
  }
}

insertAllUsers();

