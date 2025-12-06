require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function insertUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    const users = [
      {
        name: "Admin User",
        email: "admin@system.com",
        password: "Admin@123",
        role: "admin",
      },
      {
        name: "Registrar User",
        email: "registrar@system.com",
        password: "Registrar@123",
        role: "registrar",
      },
      {
        name: "Cashier User",
        email: "cashier@system.com",
        password: "Cashier@123",
        role: "cashier",
      },
      {
        name: "Worker User",
        email: "worker@system.com",
        password: "Worker@123",
        role: "worker",
      }
    ];

    for (let user of users) {
      const exists = await User.findOne({ email: user.email });
      if (exists) {
        console.log(`Already exists: ${user.email}`);
        continue;
      }

      const hash = await bcrypt.hash(user.password, 10);

      await User.create({
        name: user.name,
        email: user.email,
        passwordHash: hash,
        role: user.role,
      });

      console.log(`Inserted: ${user.email}`);
    }

    console.log("All users inserted.");
    process.exit(0);
  } catch (err) {
    console.error("Error inserting users:", err);
    process.exit(1);
  }
}

insertUsers();
