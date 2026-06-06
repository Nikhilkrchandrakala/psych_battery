require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');

const submissionSchema = new mongoose.Schema({}, { strict: false });
const Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema, 'submissions');

const notificationSchema = new mongoose.Schema({}, { strict: false });
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema, 'notifications');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const user = await User.findOne({ email: 'qcquantumclimb@gmail.com' });
    if (!user) throw new Error("Test user not found");
    console.log(`Found user: ${user.email} (${user._id})`);

    const delSub = await Submission.deleteMany({ userId: user._id });
    console.log(`Deleted ${delSub.deletedCount} submissions for user.`);

    const delNotif = await Notification.deleteMany({ 
      $or: [
        { userId: user._id },
        { recipientId: user._id },
        { studentId: user._id }
      ]
    });
    console.log(`Deleted ${delNotif.deletedCount} notifications for user.`);

    await User.updateOne({ _id: user._id }, {
        $set: { assignedGTO: null, assignedTO: null, assignedPsych: null, assignedIO: null, assignedAssessments: [] }
    });
    console.log("Cleared assessor allotments.");

    console.log("✅ Successfully reset evaluation for qcquantumclimb@gmail.com");

  } catch (error) {
    console.error("Error running reset:", error);
  } finally {
    mongoose.disconnect();
  }
}

run();
