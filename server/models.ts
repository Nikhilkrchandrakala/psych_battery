import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'assessor', 'admin'], default: 'student' },
  profileImage: String,
  assignedAssessor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessorType: { type: String, enum: ['GTO', 'TO', 'Psych', 'IO', null], default: null },
  clinicalStage: { type: String, default: 'full_course' },
  chestNo: { type: String, default: '' },
  assignedGTO: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedTO: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedPsych: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedIO: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAssessments: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }], default: [] },
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

const ModuleConfigSchema = new mongoose.Schema({
  timingMode: { type: String, enum: ['per-slide', 'global'], default: 'per-slide' },
  globalDuration: { type: Number, default: 0 },
  navigable: { type: Boolean, default: false }
}, { _id: false });

const AssessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['TAT', 'WAT', 'SRT', 'SDT', 'GENERAL'], default: 'GENERAL' },
  instructions: String,
  duration: Number,
  active: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  modules: {
    type: Map,
    of: ModuleConfigSchema,
    default: () => new Map([
      ['INTRO',   { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['TAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['WAT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['SRT_INST',{ timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['SRT',     { timingMode: 'global',    globalDuration: 1800, navigable: true }],
      ['SDT_INST',{ timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['SDT',     { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
      ['CLOSING', { timingMode: 'per-slide', globalDuration: 0, navigable: false }],
    ])
  }
}, { timestamps: true });

AssessmentSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Convert modules Map to plain object for JSON
    if (ret.modules instanceof Map) {
      const obj: any = {};
      ret.modules.forEach((val: any, key: string) => { obj[key] = val; });
      ret.modules = obj;
    }
    return ret;
  }
});

const SlideSchema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  slideType: { type: String, required: true },
  module: {
    type: String,
    enum: ['INTRO', 'TAT', 'WAT', 'SRT_INST', 'SRT', 'SDT_INST', 'SDT', 'CLOSING'],
    default: 'INTRO'
  },
  imageUrl: String,
  content: String,
  displayTime: { type: Number, default: 5 },
  order: { type: Number, default: 0 },
  typographyScale: { type: Number, default: 1 },
  inverted: { type: Boolean, default: false },
  isInstruction: { type: Boolean, default: false },
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
  piqFiles: [String],
  piqParsedData: String,
  piqStatus: { type: String, enum: ['PENDING', 'PROCESSING', 'PARSED', 'FAILED'], default: 'PENDING' },
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessorRemarks: String,
  evaluation: String,
  psychScores: Map,
  gtoScores: Map,
  ioScores: Map,
  toScores: Map,
  score: Number,
  meetingDate: Date,
  meetingLink: String,
  psychMeetingDate: Date,
  psychMeetingLink: String,
  ioMeetingDate: Date,
  ioMeetingLink: String,
  gtoMeetingDate: Date,
  gtoMeetingLink: String,
  finalReport: String,
  reviewedAt: Date,
  
  // Isolated Assessor Tracking Fields
  psychRemarks: { type: String, default: '' },
  psychStatus: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'COMPLETED'], default: 'PENDING' },
  gtoRemarks: { type: String, default: '' },
  gtoStatus: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'COMPLETED', 'NOT_REQUIRED'], default: 'PENDING' },
  ioRemarks: { type: String, default: '' },
  ioStatus: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'COMPLETED', 'NOT_REQUIRED'], default: 'PENDING' },
  toRemarks: { type: String, default: '' },
  toStatus: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'COMPLETED', 'NOT_REQUIRED'], default: 'PENDING' },

  workflowStage: { type: String, default: 'PIQ_PENDING' },
  reportVisibility: {
    psych: { type: Boolean, default: false },
    io: { type: Boolean, default: false },
    gto: { type: Boolean, default: false },
    to: { type: Boolean, default: false }
  },
  adminApproval: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    remarks: String
  }
}, { timestamps: true });

SubmissionSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const NotificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  title: { type: String, required: true },
  message: String,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

NotificationSchema.set('toJSON', {
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
export const Notification = mongoose.model('Notification', NotificationSchema);


const AdminUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
}, { collection: 'adminusers', timestamps: true });

AdminUserSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

export const AdminUser = mongoose.model('AdminUser', AdminUserSchema);
