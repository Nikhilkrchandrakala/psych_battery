import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { User } from './server/models.ts';

mongoose.connect(process.env.MONGODB_URI as string).then(async ()=>{
  const students = await User.find({
    $or: [
      { assignedPsych: { $exists: true, $ne: null } },
      { assignedGTO: { $exists: true, $ne: null } },
      { assignedIO: { $exists: true, $ne: null } },
      { assignedTO: { $exists: true, $ne: null } }
    ]
  }).select('name email assignedPsych assignedGTO assignedIO assignedTO batch chestNo').lean();
  
  console.log(JSON.stringify(students, null, 2));
  process.exit(0);
});
