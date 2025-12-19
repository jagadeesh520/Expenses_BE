const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function seedTestUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // All users with username "12" and password "12" (multiple users can have same username)
    const testUsers = [
      // EAST RAYALASEEMA
      {
        name: "Test Chairperson East",
        username: "12",
        email: "chairperson.east@test.local",
        password: "12",
        role: "chairperson",
        region: "East Rayalaseema",
      },
      {
        name: "Test Registrar East",
        username: "12",
        email: "registrar.east@test.local",
        password: "12",
        role: "registrar",
        region: "East Rayalaseema",
      },
      {
        name: "Test Treasurer East",
        username: "12",
        email: "treasurer.east@test.local",
        password: "12",
        role: "treasurer",
        region: "East Rayalaseema",
      },
      {
        name: "Test Coordinator East",
        username: "12",
        email: "coordinator.east@test.local",
        password: "12",
        role: "coordinator",
        region: "East Rayalaseema",
      },
      {
        name: "Test LAC Convener East",
        username: "12",
        email: "lac_convener.east@test.local",
        password: "12",
        role: "lac_convener",
        region: "East Rayalaseema",
      },
      {
        name: "Test Regional Coordinator East",
        username: "12",
        email: "regional_coordinator.east@test.local",
        password: "12",
        role: "regional_coordinator",
        region: "East Rayalaseema",
      },
      // WEST RAYALASEEMA
      {
        name: "Test Chairperson West",
        username: "12",
        email: "chairperson.west@test.local",
        password: "12",
        role: "chairperson",
        region: "West Rayalaseema",
      },
      {
        name: "Test Registrar West",
        username: "12",
        email: "registrar.west@test.local",
        password: "12",
        role: "registrar",
        region: "West Rayalaseema",
      },
      {
        name: "Test Treasurer West",
        username: "12",
        email: "treasurer.west@test.local",
        password: "12",
        role: "treasurer",
        region: "West Rayalaseema",
      },
      {
        name: "Test Coordinator West",
        username: "12",
        email: "coordinator.west@test.local",
        password: "12",
        role: "coordinator",
        region: "West Rayalaseema",
      },
      {
        name: "Test LAC Convener West",
        username: "12",
        email: "lac_convener.west@test.local",
        password: "12",
        role: "lac_convener",
        region: "West Rayalaseema",
      },
      {
        name: "Test Regional Coordinator West",
        username: "12",
        email: "regional_coordinator.west@test.local",
        password: "12",
        role: "regional_coordinator",
        region: "West Rayalaseema",
      },
    ];

    const passwordHash = await bcrypt.hash("12", 10);

    for (let user of testUsers) {
      try {
        // Check if user with same email exists
        const existingByEmail = await User.findOne({ email: user.email });
        if (existingByEmail) {
          // Update existing user
          await User.findByIdAndUpdate(existingByEmail._id, {
            name: user.name,
            username: user.username,
            passwordHash: passwordHash,
            role: user.role,
            region: user.region,
          });
          console.log(`✓ Updated: ${user.name} (${user.role} - ${user.region})`);
          continue;
        }

        // Check if user with same email and role exists
        const existing = await User.findOne({ 
          email: user.email,
          role: user.role,
          region: user.region
        });
        
        if (existing) {
          // Update existing user
          await User.findByIdAndUpdate(existing._id, {
            name: user.name,
            username: user.username,
            passwordHash: passwordHash,
          });
          console.log(`✓ Updated: ${user.name} (${user.role} - ${user.region})`);
        } else {
          // Create new user (username can be duplicate now)
          await User.create({
            name: user.name,
            username: user.username,
            email: user.email,
            passwordHash: passwordHash,
            role: user.role,
            region: user.region,
          });
          console.log(`✓ Created: ${user.name} (${user.role} - ${user.region})`);
        }
      } catch (err) {
        console.error(`✗ Error creating ${user.name}:`, err.message);
      }
    }

    console.log("\n✅ Test users seeding completed!");
    console.log("\n📝 Login Credentials:");
    console.log("   Username: 12");
    console.log("   Password: 12");
    console.log("\n💡 Note: You can optionally specify role and region in login request:");
    console.log("   { username: '12', password: '12', role: 'registrar', region: 'West Rayalaseema' }");
    console.log("\n👥 All roles available for both East and West Rayalaseema");
    
    process.exit(0);
  } catch (err) {
    console.error("Error seeding test users:", err);
    process.exit(1);
  }
}

seedTestUsers();

