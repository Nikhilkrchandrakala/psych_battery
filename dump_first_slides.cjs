require('dotenv').config();
const mongoose = require('mongoose');

async function dump() {
  await mongoose.connect(process.env.MONGODB_URI);
  const assessmentIdStr = "6a1eabbc919f540ff6e7ba54";
  const slides = await mongoose.connection.db.collection('slides')
    .find({ assessmentId: new mongoose.Types.ObjectId(assessmentIdStr) })
    .sort({ order: 1 })
    .toArray();

  console.log(`--- FIRST 15 SLIDES FOR ASSESSMENT ${assessmentIdStr} ---`);
  slides.slice(0, 15).forEach((s) => {
    console.log(`[Order ${s.order}] Module: ${s.module} | Type: ${s.slideType} | ID: ${s._id} | Duration: ${s.displayTime}`);
    console.log(`  Content: ${JSON.stringify(s.content)}`);
  });
  process.exit(0);
}
dump();
