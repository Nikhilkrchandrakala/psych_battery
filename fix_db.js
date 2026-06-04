import mongoose from 'mongoose';

mongoose.connect('mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads').then(async () => {
  const db = mongoose.connection.db;
  const col = db.collection('assessments');
  const doc = await col.findOne({});
  console.log('Original SRT:', doc.modules.SRT);
  
  await col.updateOne({ _id: doc._id }, { $set: { 'modules.SRT.timerStartSlide': 3, 'modules.SRT.instructionDuration': 10 } });
  
  console.log('Updated DB manually.');
  process.exit(0);
});
