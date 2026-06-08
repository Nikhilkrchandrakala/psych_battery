require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const assessments = await mongoose.connection.db.collection('assessments').find({}).toArray();
  console.log('--- ALL ASSESSMENTS ---');
  assessments.forEach((a, i) => {
    console.log(`${i+1}. Title: "${a.title}" | ID: ${a._id} | Active: ${a.active} | Type: ${a.type}`);
  });
  process.exit(0);
}
check();
