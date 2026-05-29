import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Assessment, Slide } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

async function seed() {
  console.log('Connecting to database...');
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected to MongoDB successfully.');
  } catch (err) {
    console.error('Database connection failure:', err);
    process.exit(1);
  }

  // --- SEED CONFIGURATION ---
  const batteries = [
    {
      gender: 'male',
      jsonFile: 'male_battery.json',
      title: 'Psychological Test Battery - Male 01',
      description: 'Comprehensive 4-in-1 Psychological Test Series (TAT, WAT, SRT, SDT) tailored with customized Male stimuli and scenarios.',
    },
    {
      gender: 'female',
      jsonFile: 'female_battery.json',
      title: 'Psychological Test Battery - Female 01',
      description: 'Comprehensive 4-in-1 Psychological Test Series (TAT, WAT, SRT, SDT) tailored with customized Female stimuli and scenarios.',
    }
  ];

  for (const bat of batteries) {
    console.log(`\n--------------------------------------------`);
    console.log(`Processing: ${bat.title}`);

    const jsonPath = path.join(process.cwd(), 'server', bat.jsonFile);
    if (!fs.existsSync(jsonPath)) {
      console.error(`ERROR: JSON file not found at ${jsonPath}. Please run the parser first.`);
      continue;
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const slidesData = JSON.parse(rawData);
    console.log(`Loaded ${slidesData.length} slides from JSON.`);

    // 1. Delete existing assessment and slides to allow clean re-runs
    const existing = await Assessment.findOne({ title: bat.title });
    if (existing) {
      console.log(`Found existing assessment "${bat.title}". Cleaning up old records...`);
      await Slide.deleteMany({ assessmentId: existing._id });
      await Assessment.deleteOne({ _id: existing._id });
      console.log('Old records deleted.');
    }

    // 2. Create the Assessment with modules config
    const newAssessment = new Assessment({
      title: bat.title,
      description: bat.description,
      type: 'GENERAL',
      duration: 120, // 2 hours approx
      active: true,
      modules: new Map([
        ['INTRO',   { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
        ['TAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
        ['WAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
        ['SRT',     { timingMode: 'global',    globalDuration: 1800, navigable: true }],
        ['SDT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
        ['CLOSING', { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ]),
    });

    const savedAssessment = await newAssessment.save();
    console.log(`Created new Assessment with ID: ${savedAssessment._id}`);

    // 3. Import slides in sequence (includes module tag from JSON)
    const slidesToInsert = slidesData.map((slide: any) => ({
      assessmentId: savedAssessment._id,
      slideType: slide.slideType,
      module: slide.module || 'INTRO',
      imageUrl: slide.imageUrl || undefined,
      content: slide.content || undefined,
      displayTime: slide.displayTime,
      order: slide.order,
    }));

    const result = await Slide.insertMany(slidesToInsert);
    console.log(`Successfully seeded ${result.length} slides for ${bat.title}.`);
  }

  console.log(`\n--------------------------------------------`);
  console.log('Seeding process completed. Closing database connection.');
  await mongoose.disconnect();
  console.log('Database disconnected successfully.');
}

seed().catch(err => {
  console.error('Unhandled seeding error:', err);
  process.exit(1);
});
