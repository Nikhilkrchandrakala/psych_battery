const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({}, { strict: false });
const SubmissionSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', UserSchema, 'users');
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

async function main() {
  console.log('Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');

  const psychAssessorId = '6a114eac60e4edbacc3aff6b';
  const gtoAssessorId = '6a114eac60e4edbacc3aff61';
  const toAssessorId = '6a114eac60e4edbacc3aff66';
  const ioAssessorId = '6a114ead60e4edbacc3aff70';

  console.log('\n--- Updating Abhishek Singh ---');
  const abhishek = await User.findOne({ name: /Abhishek Singh/i });
  if (abhishek) {
    abhishek.set('assignedPsych', new mongoose.Types.ObjectId(psychAssessorId));
    abhishek.set('assignedGTO', new mongoose.Types.ObjectId(gtoAssessorId));
    abhishek.set('assignedTO', new mongoose.Types.ObjectId(toAssessorId));
    abhishek.set('assignedIO', new mongoose.Types.ObjectId(ioAssessorId));
    
    // Also let's set clinicalStage to 'psych' (Stage 2) so he shows up as active in the psychology terminal
    abhishek.set('clinicalStage', 'psych');
    
    await abhishek.save();
    console.log('Successfully updated Abhishek Singh user doc:', JSON.stringify(abhishek, null, 2));
  } else {
    console.log('Abhishek Singh not found!');
  }

  console.log('\n--- Updating Abhishek\'s Submissions ---');
  if (abhishek) {
    const subResult = await Submission.updateMany(
      { userId: abhishek._id },
      { $set: { assessorId: new mongoose.Types.ObjectId(psychAssessorId) } }
    );
    console.log('Updated submissions count:', subResult.modifiedCount);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
