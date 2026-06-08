require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = "teststudent@example.com";
  const hashedPassword = await bcrypt.hash("Password123!", 10);
  const assessmentId = new mongoose.Types.ObjectId("6a1eabbc919f540ff6e7ba54");

  const updateResult = await mongoose.connection.db.collection('users').updateOne(
    { email: email },
    {
      $set: {
        name: "Test Student",
        email: email,
        phone: "9876543210",
        password: hashedPassword,
        role: "student",
        emailVerified: true,
        phoneVerified: true,
        assignedAssessments: [assessmentId]
      }
    },
    { upsert: true }
  );

  console.log("Setup result:", updateResult);
  process.exit(0);
}
setup();
