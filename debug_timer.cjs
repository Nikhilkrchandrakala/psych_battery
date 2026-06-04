const mongoose = require('mongoose');
const mongoUrl = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;

    // 1) Get ALL assessments
    const assessments = await db.collection('assessments').find({}).toArray();
    console.log('\n=== ALL ASSESSMENTS ===');
    for (const a of assessments) {
        console.log(`\nAssessment: "${a.title}" (${a._id})`);
        console.log('  active:', a.active);
        console.log('  modules:', JSON.stringify(a.modules, null, 2));

        // 2) For each assessment, show ALL SRT slides with their isInstruction flag
        const srtSlides = await db.collection('slides').find({
            assessmentId: a._id,
            module: 'SRT'
        }).sort({ order: 1 }).toArray();

        if (srtSlides.length > 0) {
            console.log(`  SRT slides (${srtSlides.length} total):`);
            for (const s of srtSlides) {
                console.log(`    order=${s.order}, isInstruction=${s.isInstruction}, displayTime=${s.displayTime}, slideType=${s.slideType}, content_preview="${(s.content || '').substring(0, 60).replace(/\n/g, ' ')}"`);
            }
        } else {
            console.log('  (no SRT slides)');
        }
    }

    mongoose.disconnect();
}).catch(console.error);
