import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'assessor', 'admin'], default: 'student' },
  profileImage: String,
  assignedAssessor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

UserSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

const AssessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['TAT', 'WAT', 'SRT', 'SDT', 'GENERAL'], default: 'GENERAL' },
  instructions: String,
  duration: Number,
  active: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

AssessmentSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const SlideSchema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  slideType: { type: String, required: true },
  imageUrl: String,
  content: String,
  displayTime: { type: Number, default: 5 },
  order: { type: Number, default: 0 },
}, { timestamps: true });

SlideSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const SubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  status: { type: String, default: 'NOT_STARTED' },
  startedAt: Date,
  completedAt: Date,
  uploadedFiles: [String],
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessorRemarks: String,
  evaluation: String,
  scores: Map,
  score: Number,
  meetingDate: Date,
  meetingLink: String,
  finalReport: String,
  reviewedAt: Date,
}, { timestamps: true });

SubmissionSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const User = mongoose.model('User', UserSchema);
export const Assessment = mongoose.model('Assessment', AssessmentSchema);
export const Slide = mongoose.model('Slide', SlideSchema);
export const Submission = mongoose.model('Submission', SubmissionSchema);
