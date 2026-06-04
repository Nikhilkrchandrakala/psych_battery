const mongoose = require('mongoose');
const mongoUrl = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;
    const assessments = await db.collection('assessments').find({}).toArray();
    let updatedCount = 0;
    
    for (const a of assessments) {
        const slides = await db.collection('slides').find({assessmentId: a._id, module: 'SRT'}).sort({order: 1}).limit(2).toArray();
        for (const s of slides) {
            if (s.isInstruction !== true) {
                await db.collection('slides').updateOne(
                    {_id: s._id}, 
                    {$set: {isInstruction: true, displayTime: 30}}
                );
                updatedCount++;
            }
        }
    }
    
    console.log(`Fixed ${updatedCount} SRT slides to be instructions`);
    mongoose.disconnect();
}).catch(console.error);
