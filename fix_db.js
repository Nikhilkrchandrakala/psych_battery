import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.MONGODB_URI) { console.error('MONGODB_URI env var is required'); process.exit(1); }

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection('assessments');
  const doc = await col.findOne({});
  console.log('Original SRT:', doc.modules.SRT);
  
  await col.updateOne({ _id: doc._id }, { $set: { 'modules.SRT.timerStartSlide': 3, 'modules.SRT.instructionDuration': 10 } });
  
  console.log('Updated DB manually.');
  process.exit(0);
});
