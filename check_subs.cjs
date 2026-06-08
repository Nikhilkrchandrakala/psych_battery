require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');
  
  const assessors = await mongoose.connection.db.collection('users').find({ role: 'assessor' }).toArray();
  console.log(`Found ${assessors.length} assessors:`);
  for (const a of assessors) {
    console.log(`Name: ${a.name} | Email: ${a.email} | AssessorType: ${a.assessorType} | ID: ${a._id}`);
  }
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
