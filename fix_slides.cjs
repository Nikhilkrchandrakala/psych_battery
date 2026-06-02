const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;
    
    const result = await db.collection('slides').updateMany(
        { slideType: { $in: ['INSTRUCTIONS', 'SITUATION'] } },
        { $set: { slideType: 'TEXT' } }
    );
    
    console.log('Slides updated:', result.modifiedCount);
    mongoose.connection.close();
}).catch(console.error);
