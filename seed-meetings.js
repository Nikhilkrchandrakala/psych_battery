const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const SubmissionSchema = new mongoose.Schema({}, { strict: false });
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const submissions = await Submission.find({}).limit(5);
    if (submissions.length === 0) {
      console.log('No submissions found to seed meetings into.');
      process.exit(0);
    }

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    let count = 0;
    for (const sub of submissions) {
      sub.set('psychMeetingDate', nextWeek);
      sub.set('psychMeetingLink', 'https://meet.google.com/abc-defg-hij');
      sub.set('psychMeetingCompleted', false);

      sub.set('ioMeetingDate', nextWeek);
      sub.set('ioMeetingLink', 'https://meet.google.com/abc-defg-hij');
      sub.set('ioMeetingCompleted', false);

      sub.set('toMeetingDate', nextWeek);
      sub.set('toMeetingLink', 'https://meet.google.com/abc-defg-hij');
      sub.set('toMeetingCompleted', false);

      sub.set('gtoMeetingDate', nextWeek);
      sub.set('gtoMeetingLink', 'https://meet.google.com/abc-defg-hij');
      sub.set('gtoMeetingCompleted', false);

      await sub.save();
      count++;
    }

    console.log(`Seeded ${count} submissions with mock meetings for all assessors.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
