const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();
const mongoUrl = process.env.MONGODB_URI;
if (!mongoUrl) { console.error('MONGODB_URI env var is required'); process.exit(1); }

function fixQuotes(text) {
    if (!text) return text;
    // Check if the text is wrapped in single quotes character by character (e.g. 'I''t'' ')
    // A heuristic: if it has lots of single quotes.
    const quoteCount = (text.match(/'/g) || []).length;
    if (quoteCount > text.length / 3) {
        return text.replace(/'''/g, "__APOSTROPHE__")
                   .replace(/'/g, "")
                   .replace(/__APOSTROPHE__/g, "'");
    }
    return text;
}

// 1. Fix the JSON files
['male_battery.json', 'female_battery.json'].forEach(file => {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let updated = 0;
    data.forEach(s => {
        if (s.content) {
            const fixed = fixQuotes(s.content);
            if (fixed !== s.content) {
                s.content = fixed;
                updated++;
            }
        }
    });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`Updated ${updated} slides in ${file}`);
});

// 2. Fix the MongoDB
mongoose.connect(mongoUrl).then(async () => {
    const db = mongoose.connection.db;
    const slides = await db.collection('slides').find({}).toArray();
    let dbUpdated = 0;
    
    for (const s of slides) {
        if (s.content) {
            const fixed = fixQuotes(s.content);
            if (fixed !== s.content) {
                await db.collection('slides').updateOne(
                    { _id: s._id },
                    { $set: { content: fixed } }
                );
                dbUpdated++;
            }
        }
    }
    
    console.log(`Updated ${dbUpdated} slides in the database`);
    mongoose.connection.close();
}).catch(console.error);
