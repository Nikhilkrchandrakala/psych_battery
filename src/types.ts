export type UserRole = 'student' | 'assessor' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  piqUrl?: string;
  assignedAssessor?: string;
  assessorType?: 'GTO' | 'TO' | 'Psych' | 'IO' | null;
  clinicalStage?: string;
  chestNo?: string;
  assignedGTO?: string | null;
  assignedTO?: string | null;
  assignedPsych?: string | null;
  assignedIO?: string | null;
  createdAt: any;
}

export type SlideType = 'IMAGE' | 'WORD' | 'TEXT' | 'BLACKOUT' | 'BREAK';

export type ModuleId = 'INTRO' | 'TAT' | 'WAT' | 'SRT' | 'SDT' | 'CLOSING';

export interface ModuleConfig {
  timingMode: 'per-slide' | 'global';
  globalDuration: number; // seconds, only used when timingMode='global'
  navigable: boolean;
}

export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'TAT' | 'WAT' | 'SRT' | 'SDT' | 'GENERAL';
  instructions: string;
  duration: number;
  active: boolean;
  createdBy: string;
  createdAt: any;
  modules?: Record<ModuleId, ModuleConfig>;
}

export interface AssessmentSlide {
  id: string;
  assessmentId: string;
  module: ModuleId;
  slideType: SlideType;
  imageUrl?: string;
  content?: string; // Used for words, situations, or instructions
  displayTime: number; // in seconds
  order: number;
  typographyScale?: number; // scale multiplier for text sizing (default 1)
  inverted?: boolean; // whether to invert colors on the slide
}

export type SubmissionStatus = 
  | 'NOT_STARTED' 
  | 'IN_PROGRESS' 
  | 'PENDING_UPLOAD' 
  | 'UPLOADED' 
  | 'ASSIGNED' 
  | 'UNDER_REVIEW' 
  | 'MEETING_SCHEDULED' 
  | 'REPORT_PENDING' 
  | 'COMPLETED';

export interface AssessmentSubmission {
  id: string;
  userId: string;
  assessmentId: string;
  status: SubmissionStatus;
  startedAt?: any;
  completedAt?: any;
  uploadedFiles?: string[];
  assessorId?: string;
  assessorRemarks?: string;
  evaluation?: string;
  scores?: Record<string, number>;
  score?: number;
  meetingDate?: any;
  meetingLink?: string;
  psychMeetingDate?: any;
  psychMeetingLink?: string;
  ioMeetingDate?: any;
  ioMeetingLink?: string;
  gtoMeetingDate?: any;
  gtoMeetingLink?: string;
  finalReport?: string;
  reviewedAt?: any;
}

export interface AssessorNote {
  id: string;
  submissionId: string;
  assessorId: string;
  notes: string;
  createdAt: any;
}
