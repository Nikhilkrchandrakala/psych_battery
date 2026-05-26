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

export type SlideType = 'IMAGE' | 'WORD' | 'SITUATION' | 'BLACKOUT' | 'BREAK' | 'INSTRUCTIONS';

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
}

export interface AssessmentSlide {
  id: string;
  assessmentId: string;
  slideType: SlideType;
  imageUrl?: string;
  content?: string; // Used for words, situations, or instructions
  displayTime: number; // in seconds
  order: number;
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
