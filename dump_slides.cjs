require('dotenv').config();
const mongoose = require('mongoose');

async function dump() {
  await mongoose.connect(process.env.MONGODB_URI);
  const assessmentIdStr = "6a1eabbc919f540ff6e7ba54";
  const slides = await mongoose.connection.db.collection('slides')
    .find({ assessmentId: new mongoose.Types.ObjectId(assessmentIdStr) })
    .sort({ order: 1 })
    .toArray();

  console.log(`--- SLIDES FOR ASSESSMENT ${assessmentIdStr} ---`);
  slides.forEach((s) => {
    console.log(`[Order ${s.order}] Module: ${s.module} | Type: ${s.slideType} | ID: ${s._id}`);
    if (s.slideType === 'TEXT') {
      console.log(`  Content Preview: ${s.content.substring(0, 300)}...`);
    }
  });
  process.exit(0);
}
dump();
