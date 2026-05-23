/**
 * Seed Script: Inject test OCR submission for Assessor Dossier Viewer demo
 * 
 * This script:
 * 1. Copies the test PDFs to the public/uploads/assessments folder
 * 2. Finds (or creates) an assessor user
 * 3. Finds (or creates) a student user
 * 4. Creates a Submission with piqFiles, piqParsedData (from the OCR output file), piqStatus = PARSED
 * 5. Creates a Notification for the assessor
 * 
 * Run: node seed-demo-submission.cjs
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const OCR_TEXT = fs.readFileSync(
  path.join('K:/H DRIVE/Quantum Climb/APPS/SSB/DOCS/ANUJ_TEST_FOR_OCR2_OUTPUT.txt'),
  'utf8'
);

// Source PDFs
const PDF1 = 'K:/H DRIVE/Quantum Climb/APPS/SSB/DOCS/ANUJ_TEST FOR OCR1.pdf';
const PDF2 = 'K:/H DRIVE/Quantum Climb/APPS/SSB/DOCS/ANUJ_TEST FOR OCR2.pdf';

// Target uploads dir
const UPLOADS_DIR = path.join(process.cwd(), 'public/uploads/assessments');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('Created uploads directory:', UPLOADS_DIR);
}

// Copy PDFs with clean filenames
const piq1Name = `anuj-piq-ocr1-${Date.now()}.pdf`;
const piq2Name = `anuj-piq-ocr2-${Date.now()}.pdf`;

fs.copyFileSync(PDF1, path.join(UPLOADS_DIR, piq1Name));
fs.copyFileSync(PDF2, path.join(UPLOADS_DIR, piq2Name));
console.log('Copied PDFs to uploads folder');

const piqFilePaths = [
  `/uploads/assessments/${piq1Name}`,
  `/uploads/assessments/${piq2Name}`
];

// ── Schemas (minimal, matching server/models.ts) ─────────────────────────────
const UserSchema = new mongoose.Schema({
  name: String, email: String, password: String,
  role: { type: String, default: 'student' },
  profileImage: String,
  assignedAssessor: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });
UserSchema.set('toJSON', { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } });

const AssessmentSchema = new mongoose.Schema({
  title: String, description: String, type: String, 
  duration: Number, active: Boolean,
}, { timestamps: true });

const SubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
  status: { type: String, default: 'NOT_STARTED' },
  startedAt: Date, completedAt: Date,
  uploadedFiles: [String],
  piqFiles: [String],
  piqParsedData: String,
  piqStatus: { type: String, default: 'PENDING' },
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessorRemarks: String,
  evaluation: String,
  scores: Map,
  meetingDate: Date, meetingLink: String,
}, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  title: String, message: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Assessment = mongoose.model('Assessment', AssessmentSchema);
const Submission = mongoose.model('Submission', SubmissionSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

async function seed() {
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');

  // 1. Find or use existing demo assessor
  let assessor = await User.findOne({ role: 'assessor' });
  if (!assessor) {
    assessor = await User.findOne({ email: 'assessor@ssb.com' });
  }
  if (!assessor) {
    console.log('No assessor found in DB. Creating demo assessor...');
    const bcrypt = require('bcryptjs');
    assessor = await User.create({
      name: 'Demo Assessor',
      email: 'assessor@ssbwithisv.in',
      password: await bcrypt.hash('password123', 10),
      role: 'assessor',
    });
  }
  console.log('Using assessor:', assessor.name, '|', assessor.email, '| ID:', assessor._id);

  // 2. Find or use existing demo student
  let student = await User.findOne({ role: 'student' });
  if (!student) {
    console.log('No student found in DB. Creating demo student...');
    const bcrypt = require('bcryptjs');
    student = await User.create({
      name: 'Anuj Rawat',
      email: 'anuj.rawat@demo.ssb.in',
      password: await bcrypt.hash('password123', 10),
      role: 'student',
      assignedAssessor: assessor._id,
    });
  }
  console.log('Using student:', student.name, '|', student.email, '| ID:', student._id);

  // 3. Find or create an active assessment
  let assessment = await Assessment.findOne({ active: true });
  if (!assessment) {
    assessment = await Assessment.findOne();
  }
  if (!assessment) {
    console.log('No assessment found. Creating demo assessment...');
    assessment = await Assessment.create({
      title: 'SSB Psychological Test Battery',
      description: 'Comprehensive timed evaluation — TAT, WAT, SRT modules.',
      type: 'GENERAL',
      duration: 45,
      active: true,
    });
  }
  console.log('Using assessment:', assessment.title, '| ID:', assessment._id);

  // 4. Create the demo submission with PIQ OCR data
  const now = new Date();
  const startedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const completedAt = new Date(now.getTime() - 90 * 60 * 1000);   // 90 mins ago

  const submission = await Submission.create({
    userId: student._id,
    assessmentId: assessment._id,
    assessorId: assessor._id,
    status: 'UPLOADED',
    startedAt,
    completedAt,
    piqFiles: piqFilePaths,
    piqParsedData: OCR_TEXT,
    piqStatus: 'PARSED',
    uploadedFiles: [], // No handwritten answers in this demo
  });
  console.log('\n✅ Created submission ID:', submission._id);

  // 5. Create a notification for the assessor
  const notification = await Notification.create({
    recipientId: assessor._id,
    studentId: student._id,
    submissionId: submission._id,
    title: 'PIQ & Dossier Ready for Review',
    message: `Candidate ${student.name} has completed their psychological test battery and uploaded PIQ documents. OCR parsed successfully — ready for assessment.`,
    isRead: false,
    createdAt: now,
  });
  console.log('✅ Created notification ID:', notification._id);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('SEED COMPLETE. Summary:');
  console.log('  Assessor : ', assessor.name, '(', assessor.email, ')');
  console.log('  Student  : ', student.name, '(', student.email, ')');
  console.log('  PIQ Files: ', piqFilePaths.join(', '));
  console.log('  OCR Status: PARSED');
  console.log('\nLogin as assessor to see the dossier. Make sure BYPASS_AUTH=false in .env');
  console.log('Or open: http://localhost:5173/?bypass=assessor');
  console.log('═══════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
