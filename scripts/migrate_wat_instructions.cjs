const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const slideSchema = new mongoose.Schema({}, { strict: false });
const Slide = mongoose.model('Slide', slideSchema);

async function migrate() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("No MONGODB_URI found in .env");
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const slides = await Slide.find({ module: 'WAT' }).sort({ order: 1 });

    // Group by assessmentId
    const groups = {};
    slides.forEach(s => {
      const aId = s.get('assessmentId') ? s.get('assessmentId').toString() : 'unknown';
      if (!groups[aId]) groups[aId] = [];
      groups[aId].push(s);
    });

    let updated = 0;
    for (const aId in groups) {
      const assessmentSlides = groups[aId];
      let textCount = 0;
      for (const slide of assessmentSlides) {
        if (textCount >= 2) break; // we only expect at most 2 TEXT slides for instructions
        if (slide.get('slideType') === 'TEXT') {
          console.log(`Updating slide ${slide._id} to WAT_INST`);
          await Slide.updateOne({ _id: slide._id }, { $set: { module: 'WAT_INST' } });
          updated++;
          textCount++;
        }
      }
    }

    console.log(`Migration complete. Updated ${updated} slides.`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

migrate();
