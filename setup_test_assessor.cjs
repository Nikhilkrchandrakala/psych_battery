require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function setup() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set!");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");

  const hashedPassword = await bcrypt.hash("Password123!", 10);

  const assessors = [
    {
      name: "Demo Psychologist",
      email: "psychassessor@example.com",
      phone: "9884050901",
      password: hashedPassword,
      role: "assessor",
      assessorType: "Psych",
      emailVerified: true,
      phoneVerified: true
    },
    {
      name: "Demo Technical Officer",
      email: "toassessor@example.com",
      phone: "9884050902",
      password: hashedPassword,
      role: "assessor",
      assessorType: "TO",
      emailVerified: true,
      phoneVerified: true
    },
    {
      name: "Demo Psych Assessor",
      email: "psych@demo.com",
      phone: "9884050903",
      password: hashedPassword,
      role: "assessor",
      assessorType: "Psych",
      emailVerified: true,
      phoneVerified: true
    },
    {
      name: "Demo TO Assessor",
      email: "to@demo.com",
      phone: "9884050904",
      password: hashedPassword,
      role: "assessor",
      assessorType: "TO",
      emailVerified: true,
      phoneVerified: true
    },
    {
      name: "Demo GTO Assessor",
      email: "gto@demo.com",
      phone: "9884050905",
      password: hashedPassword,
      role: "assessor",
      assessorType: "GTO",
      emailVerified: true,
      phoneVerified: true
    },
    {
      name: "Demo IO Assessor",
      email: "io@demo.com",
      phone: "9884050906",
      password: hashedPassword,
      role: "assessor",
      assessorType: "IO",
      emailVerified: true,
      phoneVerified: true
    }
  ];

  for (const assessor of assessors) {
    console.log(`Setting up assessor: ${assessor.email}...`);
    const res = await mongoose.connection.db.collection('users').updateOne(
      { email: assessor.email },
      { $set: assessor },
      { upsert: true }
    );
    console.log(`Result for ${assessor.email}:`, res);
  }

  console.log("Setup complete!");
  process.exit(0);
}

setup().catch(err => {
  console.error("Error setting up assessors:", err);
  process.exit(1);
});
