const mongoose = require('mongoose');
const mongoUrl = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;

    // Fix all slides that have isInstruction as undefined/null — set them to false explicitly
    const result1 = await db.collection('slides').updateMany(
        { isInstruction: { $exists: false } },
        { $set: { isInstruction: false } }
    );
    console.log(`Set isInstruction=false on ${result1.modifiedCount} slides where it was missing`);

    const result2 = await db.collection('slides').updateMany(
        { isInstruction: null },
        { $set: { isInstruction: false } }
    );
    console.log(`Set isInstruction=false on ${result2.modifiedCount} slides where it was null`);

    // Also re-normalize the Female assessment SRT slide ordering to start from 0
    const femaleAssessment = await db.collection('assessments').findOne({ title: /Female/i });
    if (femaleAssessment) {
        const srtSlides = await db.collection('slides').find({
            assessmentId: femaleAssessment._id,
            module: 'SRT'
        }).sort({ order: 1 }).toArray();

        console.log(`\nRe-ordering ${srtSlides.length} Female SRT slides (currently start at order=${srtSlides[0]?.order})...`);
        for (let i = 0; i < srtSlides.length; i++) {
            await db.collection('slides').updateOne(
                { _id: srtSlides[i]._id },
                { $set: { order: i } }
            );
        }
        console.log('Female SRT slides re-ordered from 0.');
    }

    // Verify
    console.log('\n=== VERIFICATION ===');
    const assessments = await db.collection('assessments').find({}).toArray();
    for (const a of assessments) {
        const srtSlides = await db.collection('slides').find({
            assessmentId: a._id, module: 'SRT'
        }).sort({ order: 1 }).limit(5).toArray();
        if (srtSlides.length > 0) {
            console.log(`\n"${a.title}" SRT slides (first 5):`);
            for (const s of srtSlides) {
                console.log(`  order=${s.order}, isInstruction=${s.isInstruction}, displayTime=${s.displayTime}`);
            }
        }
    }

    mongoose.disconnect();
}).catch(console.error);
