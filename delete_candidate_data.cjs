require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const email = 'ayushtripathi2326@gmail.com';
  
  // Find user
  const user = await mongoose.connection.db.collection('users').findOne({ email });
  if (!user) {
    console.log(`No user found with email ${email}`);
    process.exit(0);
  }
  
  const userId = user._id;
  console.log(`Found user: ${user.name} (${user.email}) | ID: ${userId}`);
  
  // 1. Delete submissions
  const subDel = await mongoose.connection.db.collection('submissions').deleteMany({ userId: userId });
  console.log(`Deleted ${subDel.deletedCount} submissions.`);
  
  // 2. Delete notifications
  const notifDel = await mongoose.connection.db.collection('notifications').deleteMany({
    $or: [
      { studentId: userId },
      { recipientId: userId }
    ]
  });
  console.log(`Deleted ${notifDel.deletedCount} notifications.`);
  
  // 3. Delete user document
  const userDel = await mongoose.connection.db.collection('users').deleteOne({ _id: userId });
  console.log(`Deleted user document: ${userDel.deletedCount}`);
  
  console.log('Successfully cleared all candidate data!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
