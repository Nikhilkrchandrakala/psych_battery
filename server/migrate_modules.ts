import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Assessment, Slide } from './models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

/**
 * Determines the module a slide belongs to based on content-based boundary detection.
 * Walks through slides sorted by order and detects known title markers.
 */
function detectModule(slide: any, currentModule: string): string {
  const content = (slide.content || '').toUpperCase().replace(/'/g, '');

  // Detect module boundary markers from known title slides
  if (content.includes('INSTRUCTIONS FOR THE PSYCH TEST') || 
      (content.includes('INSTRUCTIONS') && slide.order <= 1)) {
    return 'INTRO';
  }
  if (content.includes('THEMATIC APPERCEPTION TEST') || content.includes('INSTRUCTIONS FOR TAT')) {
    return 'TAT';
  }
  if (content.includes('WORD ASSOCIATION TEST') || content.includes('INSTRUCTIONS FOR WAT')) {
    return 'WAT';
  }
  if (content.includes('SITUATION REACTION TEST') || content.includes('INSTRUCTIONS FOR SRT')) {
    return 'SRT';
  }
  if (content.includes('SELF DESCRIPTION TEST') || content.includes('INSTRUCTIONS FOR SD')) {
    return 'SDT';
  }
  if (content.includes('THANK YOU') || content.includes('PLEASE SCAN YOUR DOSSIER')) {
    return 'CLOSING';
  }

  // Stay in current module
  return currentModule;
}

async function migrate() {
  console.log('Connecting to database...');
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected to MongoDB successfully.');
  } catch (err) {
    console.error('Database connection failure:', err);
    process.exit(1);
  }

  // Process all assessments
  const assessments = await Assessment.find({});
  console.log(`Found ${assessments.length} assessments to migrate.`);

  for (const assessment of assessments) {
    console.log(`\n--- Migrating: ${assessment.title} ---`);

    // Update modules config on assessment
    const modulesConfig = new Map([
      ['INTRO',   { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['TAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['WAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['SRT',     { timingMode: 'global',    globalDuration: 1800, navigable: true }],
      ['SDT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['CLOSING', { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
    ]);

    await Assessment.findByIdAndUpdate(assessment._id, { modules: modulesConfig });
    console.log(`  Updated modules config on assessment.`);

    // Get all slides sorted by order
    const slides = await Slide.find({ assessmentId: assessment._id }).sort('order');
    console.log(`  Found ${slides.length} slides.`);

    let currentModule = 'INTRO';
    const moduleCounts: Record<string, number> = {};

    for (const slide of slides) {
      const slideObj = slide.toObject();
      const detectedModule = detectModule(slideObj, currentModule);
      
      // Module transitions are sticky — once we enter a module, we stay until the next marker
      if (detectedModule !== currentModule) {
        currentModule = detectedModule;
      }

      // Special case: BREAK slides between modules should belong to the module they're closing
      // The 10-min break between WAT and SRT belongs to WAT
      // The 2-min break between SRT and SDT belongs to SRT
      let assignedModule = currentModule;

      // Handle SITUATION slides — they're always SRT
      if (slideObj.slideType === 'SITUATION') {
        assignedModule = 'SRT';
        currentModule = 'SRT';
      }

      // Handle IMAGE slides during TAT section — always TAT
      if (slideObj.slideType === 'IMAGE' && currentModule === 'TAT') {
        assignedModule = 'TAT';
      }

      // Handle WORD slides — always WAT
      if (slideObj.slideType === 'WORD') {
        assignedModule = 'WAT';
        currentModule = 'WAT';
      }

      // Handle BLACKOUT slides — belong to current module
      if (slideObj.slideType === 'BLACKOUT') {
        assignedModule = currentModule;
      }

      await Slide.findByIdAndUpdate(slide._id, { module: assignedModule });
      moduleCounts[assignedModule] = (moduleCounts[assignedModule] || 0) + 1;
    }

    console.log(`  Module distribution:`, moduleCounts);
  }

  console.log(`\n--- Migration complete ---`);
  await mongoose.disconnect();
  console.log('Database disconnected.');
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
