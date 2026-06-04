const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;
    const slidesCollection = db.collection('slides');
    const assessmentsCollection = db.collection('assessments');

    console.log('\n--- 1. Migrating Slides ---');
    
    // Find all SRT slides that are instructions
    const srtInstSlides = await slidesCollection.find({ module: 'SRT', isInstruction: true }).toArray();
    console.log(`Found ${srtInstSlides.length} SRT instruction slides.`);
    
    if (srtInstSlides.length > 0) {
      await slidesCollection.updateMany(
        { module: 'SRT', isInstruction: true },
        { $set: { module: 'SRT_INST' } }
      );
      console.log('Moved SRT instruction slides to SRT_INST.');
    }

    // Find all SDT slides that are instructions
    const sdtInstSlides = await slidesCollection.find({ module: 'SDT', isInstruction: true }).toArray();
    console.log(`Found ${sdtInstSlides.length} SDT instruction slides.`);
    
    if (sdtInstSlides.length > 0) {
      await slidesCollection.updateMany(
        { module: 'SDT', isInstruction: true },
        { $set: { module: 'SDT_INST' } }
      );
      console.log('Moved SDT instruction slides to SDT_INST.');
    }

    console.log('\n--- 2. Reordering Slides ---');
    // For every assessment, we need to ensure orders are sequential within each module
    const assessments = await assessmentsCollection.find({}).toArray();
    for (const assessment of assessments) {
      const slides = await slidesCollection.find({ assessmentId: assessment._id }).sort({ module: 1, order: 1 }).toArray();
      
      // Group by module
      const moduleGroups = {};
      slides.forEach(s => {
        if (!moduleGroups[s.module]) moduleGroups[s.module] = [];
        moduleGroups[s.module].push(s);
      });

      // Fix order per module
      for (const [mod, modSlides] of Object.entries(moduleGroups)) {
        // Sort by original order to maintain sequence
        modSlides.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        for (let i = 0; i < modSlides.length; i++) {
          if (modSlides[i].order !== i) {
            await slidesCollection.updateOne(
              { _id: modSlides[i]._id },
              { $set: { order: i } }
            );
          }
        }
      }
      
      console.log(`Reordered slides for assessment ${assessment.title} (${assessment._id})`);
      
      // Also ensure the assessment has the new modules in its config
      let updatedModules = false;
      const currentModules = assessment.modules || {};
      
      if (!currentModules['SRT_INST']) {
        currentModules['SRT_INST'] = { timingMode: 'per-slide', globalDuration: 0, navigable: false };
        updatedModules = true;
      }
      if (!currentModules['SDT_INST']) {
        currentModules['SDT_INST'] = { timingMode: 'per-slide', globalDuration: 0, navigable: false };
        updatedModules = true;
      }
      
      if (updatedModules) {
        await assessmentsCollection.updateOne(
          { _id: assessment._id },
          { $set: { modules: currentModules } }
        );
        console.log(`Added SRT_INST/SDT_INST config to assessment ${assessment.title}`);
      }
    }

    console.log('\nMigration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

migrate();
