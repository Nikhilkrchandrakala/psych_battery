require('dotenv').config();
const mongoose = require('mongoose');

async function find() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await mongoose.connection.db.collection('users').find({ role: 'student' }).toArray();
  console.log('--- STUDENT USERS ---');
  users.forEach((u) => {
    console.log(`Name: ${u.name} | Email: ${u.email} | Phone: ${u.phoneNumber} | Password Hash: ${u.password}`);
  });
  process.exit(0);
}
find();
