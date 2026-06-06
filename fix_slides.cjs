const mongoose = require('mongoose');
require('dotenv').config();

const mongoUrl = process.env.MONGODB_URI;
if (!mongoUrl) { console.error('MONGODB_URI env var is required'); process.exit(1); }

mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;
    
    const result = await db.collection('slides').updateMany(
        { slideType: { $in: ['INSTRUCTIONS', 'SITUATION'] } },
        { $set: { slideType: 'TEXT' } }
    );
    
    console.log('Slides updated:', result.modifiedCount);
    mongoose.connection.close();
}).catch(console.error);
