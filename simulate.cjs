require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

// Need to use the same schemas/models from the backend
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://isvclub2021:ddtIDjbRII76huv8@ssbwithisvleads.3fu0m.mongodb.net/?appName=SsbWithIsvLeads';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');

const assessmentSchema = new mongoose.Schema({}, { strict: false });
const Assessment = mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema, 'assessments');

const submissionSchema = new mongoose.Schema({}, { strict: false });
const Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema, 'submissions');

const notificationSchema = new mongoose.Schema({}, { strict: false });
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema, 'notifications');

const adminUserSchema = new mongoose.Schema({}, { strict: false });
const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema, 'adminusers');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    // 1. Find the test user
    const user = await User.findOne({ email: 'qcquantumclimb@gmail.com' });
    if (!user) throw new Error("Test user not found");
    console.log(`Found user: ${user.name} (${user._id})`);

    // 2. Find a general assessment (or any active one)
    const assessment = await Assessment.findOne({ active: true });
    if (!assessment) throw new Error("No active assessment found");
    console.log(`Found assessment: ${assessment.title} (${assessment._id})`);

    // 3. Clear any old submissions for this user to ensure a clean slate
    await Submission.deleteMany({ userId: user._id });
    await Notification.deleteMany({ userId: user._id });
    console.log("Cleared old mock submissions and notifications.");

    // 4. Create the new mock submission
    const now = new Date();
    const submission = new Submission({
      userId: user._id,
      assessmentId: assessment._id,
      status: 'REPORT_RELEASED',
      startedAt: new Date(now.getTime() - 86400000), // yesterday
      completedAt: new Date(now.getTime() - 43200000), // half a day ago
      
      // PIQ Files and Data
      piqFiles: ['/uploads/submissions/ANUJ_TEST FOR OCR2.pdf'],
      piqStatus: 'PARSED',
      piqParsedData: `## Candidate Profile Analysis
- **Name**: Anuj Sharma
- **Family**: Middle-class background, supportive parents.
- **Education**: B.Tech in Computer Science.
- **Notable Achievements**: Captain of university debate team, completed NCC C Certificate.`,

      // Dossier Files
      uploadedFiles: ['/uploads/submissions/ANUJ_TEST FOR OCR1.pdf'],

      // Assessor Statuses
      psychStatus: 'COMPLETED',
      ioStatus: 'COMPLETED',
      gtoStatus: 'COMPLETED',
      toStatus: 'NOT_REQUIRED',
      
      // Mock Scores Matrix
      scores: {
        effective_intelligence: 7,
        reasoning_ability: 8,
        organizing_ability: 6,
        power_of_expression: 8,
        social_adaptability: 7,
        cooperation: 8,
        sense_of_responsibility: 9,
        initiative: 7,
        self_confidence: 8,
        speed_of_decision: 6,
        ability_to_influence_the_group: 7,
        liveliness: 8,
        determination: 9,
        courage: 8,
        stamina: 7,
        marks: 85
      },
      score: 85,

      // Isolated Remarks
      psychRemarks: "The candidate demonstrates strong reasoning ability and determination. The TAT stories showed excellent leadership traits. Recommended.",
      ioRemarks: "Very confident during the interview. Shows a clear understanding of current affairs and expresses thoughts coherently. Highly recommended.",
      gtoRemarks: "Good team player. Displayed stamina and cooperation during the group obstacles. Took initiative naturally.",
      
      // Isolated Meeting Links (Mocking 3 different links)
      psychMeetingDate: new Date(now.getTime() + 86400000), // tomorrow
      psychMeetingLink: "https://meet.google.com/psy-chtt-est",
      ioMeetingDate: new Date(now.getTime() + 172800000), // day after tomorrow
      ioMeetingLink: "https://meet.google.com/int-rvi-ewo",
      gtoMeetingDate: new Date(now.getTime() + 259200000), // 3 days from now
      gtoMeetingLink: "https://meet.google.com/gto-test-off",

      // Final Visibility
      workflowStage: 'EVALUATION_COMPLETED',
      reportVisibility: {
        psych: true,
        io: true,
        gto: true,
        to: false
      },
      adminApproval: {
        approvedAt: now,
        remarks: "All evaluations are sound. Broadcasting."
      }
    });

    await submission.save();
    console.log(`Created mock submission: ${submission._id}`);

    // 5. Create Mock Notifications properly for Candidate, Assessors, and Admin
    const notifications = [];

    // Notifications for Candidate
    notifications.push(
      { recipientId: user._id, studentId: user._id, submissionId: submission._id, title: 'PIQ Processed', message: 'Your PIQ document was successfully parsed.', type: 'SYSTEM', read: false, createdAt: new Date(now.getTime() - 80000000) },
      { recipientId: user._id, studentId: user._id, submissionId: submission._id, title: 'Psychologist Evaluation Complete', message: 'The Psychologist has reviewed your dossier.', type: 'SUCCESS', read: false, createdAt: new Date(now.getTime() - 40000000) },
      { recipientId: user._id, studentId: user._id, submissionId: submission._id, title: 'Results Broadcasted', message: 'Your official evaluation report has been broadcasted by the Admin!', type: 'SUCCESS', read: false, createdAt: now }
    );

    // Notifications for Super Admin
    const superAdmins = await AdminUser.find({});
    for (const sa of superAdmins) {
      notifications.push(
        { recipientId: sa._id, studentId: user._id, submissionId: submission._id, title: 'PIQ & Dossier Ready', message: `Candidate ${user.name} has uploaded PIQ and Dossier.`, type: 'INFO', read: false, createdAt: new Date(now.getTime() - 80000000) },
        { recipientId: sa._id, studentId: user._id, submissionId: submission._id, title: 'Assessments Complete', message: `All assigned assessors have completed evaluations for ${user.name}.`, type: 'SUCCESS', read: false, createdAt: new Date(now.getTime() - 10000000) }
      );
    }

    // Notifications for Assessors
    const assessorIds = [user.assignedPsych, user.assignedIO, user.assignedGTO, user.assignedTO].filter(Boolean);
    for (const aid of assessorIds) {
      notifications.push(
        { recipientId: aid, studentId: user._id, submissionId: submission._id, title: 'PIQ & Dossier Ready', message: `Candidate ${user.name} is ready for assessment.`, type: 'INFO', read: false, createdAt: new Date(now.getTime() - 80000000) },
        { recipientId: aid, studentId: user._id, submissionId: submission._id, title: 'Results Broadcasted', message: `The Admin has broadcasted the evaluation for ${user.name}.`, type: 'SUCCESS', read: false, createdAt: now }
      );
    }

    await Notification.insertMany(notifications);
    console.log("Generated mock notifications for Candidate, Assessors, and Super Admins.");

    console.log("\n=========================================");
    console.log("✅ FULL MOCK TEST COMPLETED SUCCESSFULLY!");
    console.log("=========================================\n");

  } catch (error) {
    console.error("Error running simulation:", error);
  } finally {
    mongoose.disconnect();
  }
}

run();
