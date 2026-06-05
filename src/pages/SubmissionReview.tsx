import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, Assessment, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import {
  ArrowLeft, FileText, Calendar, MessageSquare,
  User as UserIcon, Clock, ShieldCheck,
  CheckCircle2, Sparkles, AlertCircle, Maximize2,
  FileSearch, Layers, ChevronLeft, ChevronRight,
  Loader2, Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AssessmentPresenter } from './AssessmentPresenter';

// Base URL for serving uploaded files from the PsychBattery server
// The PsychBattery server (tsx server.ts) serves /uploads at the same port as the Vite dev server (5173)
const SERVER_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5173'
  : 'https://psych.ssbwithisv.in';

const PIQ_STATUS_STYLES: Record<string, string> = {
  PENDING:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
  PARSED:     'bg-green-500/10 text-green-400 border-green-500/20',
  FAILED:     'bg-red-500/10 text-red-400 border-red-500/20',
};

const PSYCH_TRAITS = {
  'Factor I: Planning & Organizing': {
    effective_intelligence: 'Effective Intelligence',
    reasoning_ability: 'Reasoning Ability',
    organizing_ability: 'Organizing Ability',
    power_of_expression: 'Power of Expression'
  },
  'Factor II: Social Adjustment': {
    social_adaptability: 'Social Adaptability',
    cooperation: 'Cooperation',
    sense_of_responsibility: 'Sense of Responsibility'
  },
  'Factor III: Social Effectiveness': {
    initiative: 'Initiative',
    self_confidence: 'Self Confidence',
    speed_of_decision: 'Speed of Decision',
    ability_to_influence_the_group: 'Influence the Group',
    liveliness: 'Liveliness'
  },
  'Factor IV: Dynamic': {
    determination: 'Determination',
    courage: 'Courage',
    stamina: 'Stamina'
  }
};

const SPECIALIZED_TRAITS = {
  Psych: PSYCH_TRAITS,
  GTO: PSYCH_TRAITS,
  IO: PSYCH_TRAITS,
  TO: PSYCH_TRAITS
};

const PSYCH_GRID_CONFIG = {
  factors: [
    { label: 'Factor I: Planning & Organizing', colSpan: 4 },
    { label: 'Factor II: Social Adjustment', colSpan: 3 },
    { label: 'Factor III: Social Effectiveness', colSpan: 5 },
    { label: 'Factor IV: Dynamic', colSpan: 3 }
  ],
  traits: [
    { id: 'effective_intelligence', code: 'EI', num: 1, name: 'Effective Intelligence', factor: 'Factor I' },
    { id: 'reasoning_ability', code: 'RA', num: 2, name: 'Reasoning Ability', factor: 'Factor I' },
    { id: 'organizing_ability', code: 'OA', num: 3, name: 'Organizing Ability', factor: 'Factor I' },
    { id: 'power_of_expression', code: 'POE', num: 4, name: 'Power of Expression', factor: 'Factor I' },
    
    { id: 'social_adaptability', code: 'SA', num: 5, name: 'Social Adaptability', factor: 'Factor II' },
    { id: 'cooperation', code: 'COOP', num: 6, name: 'Cooperation', factor: 'Factor II' },
    { id: 'sense_of_responsibility', code: 'SOR', num: 7, name: 'Sense of Responsibility', factor: 'Factor II' },
    
    { id: 'initiative', code: 'INIT', num: 8, name: 'Initiative', factor: 'Factor III' },
    { id: 'self_confidence', code: 'SC', num: 9, name: 'Self Confidence', factor: 'Factor III' },
    { id: 'speed_of_decision', code: 'SOD', num: 10, name: 'Speed of Decision', factor: 'Factor III' },
    { id: 'ability_to_influence_the_group', code: 'AIG', num: 11, name: 'Influence Group', factor: 'Factor III' },
    { id: 'liveliness', code: 'LIV', num: 12, name: 'Liveliness', factor: 'Factor III' },
    
    { id: 'determination', code: 'D', num: 13, name: 'Determination', factor: 'Factor IV' },
    { id: 'courage', code: 'C', num: 14, name: 'Courage', factor: 'Factor IV' },
    { id: 'stamina', code: 'S', num: 15, name: 'Stamina', factor: 'Factor IV' }
  ]
};

const ASSESSOR_GRID_CONFIG = {
  Psych: PSYCH_GRID_CONFIG,
  GTO: PSYCH_GRID_CONFIG,
  IO: PSYCH_GRID_CONFIG,
  TO: PSYCH_GRID_CONFIG
};

const SubmissionReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'evaluation' | 'meeting' | 'feedback'>('dossier');
  const [showEthicsModal, setShowEthicsModal] = useState(true);
  
  // Attempted Psych Battery details state
  const [loadingSlides, setLoadingSlides] = useState(false);

  // Dossier viewer state
  const [activePiqIndex, setActivePiqIndex] = useState(0);
  const [activeAnswerIndex, setActiveAnswerIndex] = useState(0);

  // Form states
  const [remarks, setRemarks] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  const [activeAssessorType, setActiveAssessorType] = useState<'Psych' | 'GTO' | 'TO' | 'IO'>('Psych');

  useEffect(() => {
    if (profile?.assessorType) {
      setActiveAssessorType(profile.assessorType);
    }
  }, [profile]);

  // Tab and index redirection based on assessor role
  useEffect(() => {
    if (activeAssessorType === 'GTO') {
      setActiveTab('evaluation');
    } else {
      setActiveTab('dossier');
    }
  }, [activeAssessorType]);

  useEffect(() => {
    const piqCount = submission?.piqFiles?.length || 0;
    if (activeAssessorType === 'IO' && piqCount > 1) {
      setActivePiqIndex(1); // Default exclusively to PIQ document
    } else {
      setActivePiqIndex(0); // Default to Dossier
    }
  }, [activeAssessorType, submission?.piqFiles?.length]);

  const showRoleToggle = !profile?.assessorType;

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const subData = await api.submissions.get(id);

        // The server populates userId → { name, email } and assessmentId → { title, duration }
        // Extract the embedded objects directly — no separate API calls needed
        const populatedStudent = subData.userId && typeof subData.userId === 'object'
          ? subData.userId
          : null;
        const populatedAssessment = subData.assessmentId && typeof subData.assessmentId === 'object'
          ? subData.assessmentId
          : null;

        // Normalize the submission: replace populated objects with their IDs for state
        const normalizedSub = {
          ...subData,
          userId: populatedStudent?._id || populatedStudent?.id || subData.userId,
          assessmentId: populatedAssessment?._id || populatedAssessment?.id || subData.assessmentId,
        };

        setSubmission(normalizedSub);
        setRemarks(subData.assessorRemarks || '');
        const roleScoresField = `${activeAssessorType.toLowerCase()}Scores`;
        const roleScores = (subData as any)[roleScoresField];
        if (roleScores && Object.keys(roleScores).length > 0) {
          setScores(roleScores);
        } else {
          const initialScores: Record<string, number> = {};
          Object.values(SPECIALIZED_TRAITS).forEach(groups => {
            Object.values(groups).forEach(traits => {
              Object.keys(traits).forEach(k => {
                initialScores[k] = 0;
              });
            });
          });
          setScores(initialScores);
        }
        // Use populated data directly — avoids permission errors and wrong ID lookups
        if (populatedStudent) {
          setStudent(populatedStudent);
        }
        if (populatedAssessment) {
          setAssessment(populatedAssessment);
        }
      } catch (error) {
        console.error('Failed to fetch review data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!submission) return;
    if (activeAssessorType === 'Psych') {
      setRemarks(submission.psychRemarks || submission.assessorRemarks || '');
    } else if (activeAssessorType === 'GTO') {
      setRemarks((submission as any).gtoRemarks || '');
    } else if (activeAssessorType === 'IO') {
      setRemarks((submission as any).ioRemarks || '');
    } else if (activeAssessorType === 'TO') {
      setRemarks((submission as any).toRemarks || '');
    }

    // Role-based meeting link logic
    const prefix = activeAssessorType.toLowerCase();
    const sub = submission as any;
    const dateField = sub[`${prefix}MeetingDate`];
    const linkField = sub[`${prefix}MeetingLink`];

    if (dateField) {
      const date = new Date(dateField);
      setMeetingDate(date.toISOString().slice(0, 16));
    } else {
      setMeetingDate('');
    }
    setMeetingLink(linkField || '');
  }, [activeAssessorType, submission]);

  const handleUpdate = async (status: AssessmentSubmission['status']) => {
    if (!id) return;
    
    // Strict completeness check for finalizing evaluations
    const currentGridConfig = ASSESSOR_GRID_CONFIG[activeAssessorType] || ASSESSOR_GRID_CONFIG.Psych;
    const isCompleted = status === 'COMPLETED';

    if (isCompleted) {
      const unfilledTraits = currentGridConfig.traits.filter(t => !scores[t.id] || scores[t.id] === 0);
      const unfilledMarks = !scores.marks || scores.marks === 0;
      
      if (unfilledTraits.length > 0 || unfilledMarks) {
        alert(
          `Verification Failed:\n\nPlease assign grades to all traits and fill in the Overall Marks before finalizing the evaluation.\n\n` +
          `• Unassigned traits: ${unfilledTraits.map(t => t.code).join(', ') || 'None'}\n` +
          `• Overall Marks: ${unfilledMarks ? 'Missing' : 'Filled'}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const updateData: any = {
        [`${activeAssessorType.toLowerCase()}Scores`]: scores,
      };

      // Isolated status and remarks routing
      if (activeAssessorType === 'Psych') {
        updateData.psychRemarks = remarks;
        updateData.psychStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
        updateData.assessorRemarks = remarks; // Sync compatibility
      } else if (activeAssessorType === 'GTO') {
        updateData.gtoRemarks = remarks;
        updateData.gtoStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      } else if (activeAssessorType === 'IO') {
        updateData.ioRemarks = remarks;
        updateData.ioStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      } else if (activeAssessorType === 'TO') {
        updateData.toRemarks = remarks;
        updateData.toStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      }

      // Calculate main submission status transition intelligently
      let allFinished = true;
      if (student) {
        if (student.assignedPsych && activeAssessorType !== 'Psych' && submission?.psychStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedGTO && activeAssessorType !== 'GTO' && (submission as any)?.gtoStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedIO && activeAssessorType !== 'IO' && (submission as any)?.ioStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedTO && activeAssessorType !== 'TO' && (submission as any)?.toStatus !== 'COMPLETED') allFinished = false;
      }

      if (isCompleted && allFinished) {
        updateData.status = 'COMPLETED';
      } else {
        updateData.status = 'REVIEW_PENDING';
      }

      const prefix = activeAssessorType.toLowerCase();
      if (meetingDate) updateData[`${prefix}MeetingDate`] = new Date(meetingDate).toISOString();
      if (meetingLink) updateData[`${prefix}MeetingLink`] = meetingLink;

      await api.submissions.update(id, updateData);
      setSubmission(prev => prev ? { ...prev, ...updateData } : null);

      if (isCompleted) {
        navigate('/assessor');
      }
    } catch (error) {
      console.error('Failed to update submission:', error);
    } finally {
      setSaving(false);
    }
  };

  const buildFileUrl = (path: string, fileIndex?: number) => {
    if (path.startsWith('db://')) {
      const token = localStorage.getItem('auth_token');
      // Always fallback to activePiqIndex if fileIndex is not provided
      const idx = fileIndex !== undefined ? fileIndex : activePiqIndex;
      return `${SERVER_BASE}/api/submissions/${id}/piq-file/${idx}?token=${token}`;
    }
    if (path.startsWith('http')) return path;
    return `${SERVER_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const isPdf = (path: string) => path.toLowerCase().endsWith('.pdf');

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!submission) return (
    <div className="text-app-text-bright p-12 text-center">Protocol record not identified.</div>
  );

  const piqFiles: string[] = (submission as any).piqFiles || [];
  const answerFiles: string[] = submission.uploadedFiles || [];
  const piqStatus: string = (submission as any).piqStatus || 'PENDING';
  const ocrTranscript: string = (submission as any).piqParsedData || '';

  // Graceful fallbacks if population was incomplete
  const studentName = student?.name || 'Candidate';
  const studentEmail = student?.email || '';
  const assessmentTitle = assessment?.title || 'Assessment';
  const assessmentDuration = (assessment as any)?.duration || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button
            onClick={() => navigate('/assessor')}
            className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
          >
            <ArrowLeft size={14} /> Back to Candidates
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
              {student?.profileImage ? (
                <img src={student.profileImage} alt={studentName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={32} className="text-app-text-muted" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tighter text-app-text-bright">{studentName}</h1>
                <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-[0.15em] text-app-text-bright">
                  Batch: {student?.batch || '--'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-[0.15em] text-app-text-bright">
                  Chest: {student?.chestNo || '--'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{assessmentTitle}</span>
                <span className="w-1 h-1 bg-app-border rounded-full" />
                <span className="px-2 py-0.5 rounded bg-app-accent/10 border border-app-accent/20 text-[9px] font-black text-app-accent uppercase tracking-[0.15em] leading-none">
                  {submission.status.replace(/_/g, ' ')}
                </span>
                {piqFiles.length > 0 && (
                  <>
                    <span className="w-1 h-1 bg-app-border rounded-full" />
                    <span className={cn('px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-[0.15em] leading-none', PIQ_STATUS_STYLES[piqStatus])}>
                      PIQ: {piqStatus}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleUpdate('UNDER_REVIEW')}
              disabled={saving}
              className="px-6 py-3 bg-app-card border border-app-border rounded-2xl text-xs font-black text-app-text-bright hover:bg-white/5 transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Save Preliminary
            </button>
            <button
              onClick={() => handleUpdate('COMPLETED')}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Finalize Evaluation
            </button>
          </div>
          
          {/* Temporal Markers */}
          <div className="flex items-center gap-4 text-[10px] font-black text-app-text-muted uppercase tracking-wider px-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-app-text-muted/65" />
              <span>Started: {submission?.startedAt ? new Date(submission.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
            </div>
            {submission?.completedAt && (
              <div className="flex items-center gap-1.5 text-app-accent">
                <ShieldCheck size={12} className="text-app-accent" />
                <span>Sealed: {new Date(submission.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-app-sidebar/50 p-1 rounded-2xl border border-app-border w-fit shadow-inner">
        {[
          { id: 'dossier', label: 'Document Viewer', icon: FileSearch },
          { id: 'evaluation', label: 'Assessment', icon: MessageSquare },
          { id: 'meeting', label: 'Feedback Scheduler', icon: Calendar },
          ...(submission.status === 'REPORT_RELEASED' ? [{ id: 'feedback', label: 'All Assessor Feedback', icon: Users }] : [])
        ].filter(tab => {
          if (activeAssessorType === 'GTO' && tab.id === 'dossier') return false;
          if (tab.id === 'meeting' && !['Psych', 'IO', 'TO'].includes(activeAssessorType)) return false;
          return true;
        }).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2.5 rounded-[0.85rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
              activeTab === tab.id ? "bg-app-accent text-white shadow-xl" : "text-app-text-muted hover:text-app-text-bright"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── DOSSIER VIEWER TAB ─────────────────────────────────────────── */}
      {activeTab === 'dossier' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* PIQ Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-app-border pb-3">
              <FileText className="text-app-accent" size={20} />
              <h2 className="text-sm font-black text-app-text-bright uppercase tracking-widest">Personal Information Questionnaire (PIQ)</h2>
              <span className={cn('ml-auto px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest', PIQ_STATUS_STYLES[piqStatus])}>
                OCR: {piqStatus}
              </span>
            </div>

            {piqFiles.length > 0 ? (
              <div className="flex flex-col gap-8">
                {/* Top: PDF / Image Viewer */}
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                    <span>{activeAssessorType === 'IO' ? 'Personal Information Questionnaire (PIQ)' : `File ${activePiqIndex + 1} of ${piqFiles.length}`}</span>
                    {activeAssessorType !== 'IO' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActivePiqIndex(i => Math.max(0, i - 1))}
                          disabled={activePiqIndex === 0}
                          className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          onClick={() => setActivePiqIndex(i => Math.min(piqFiles.length - 1, i + 1))}
                          disabled={activePiqIndex === piqFiles.length - 1}
                          className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                        >
                          <ChevronRight size={12} />
                        </button>
                        <a
                          href={buildFileUrl(piqFiles[activePiqIndex])}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent text-app-text-muted hover:text-app-accent transition-all"
                          title="Open full screen"
                        >
                          <Maximize2 size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-2xl" style={{ height: '680px' }}>
                    {isPdf(piqFiles[activePiqIndex]) ? (
                      <iframe
                        key={activePiqIndex}
                        src={`${buildFileUrl(piqFiles[activePiqIndex])}#toolbar=0&navpanes=0`}
                        className="w-full h-full border-0"
                        title={`PIQ Document ${activePiqIndex + 1}`}
                      />
                    ) : (
                      <img
                        key={activePiqIndex}
                        src={buildFileUrl(piqFiles[activePiqIndex])}
                        alt={`PIQ Page ${activePiqIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* File tabs if multiple */}
                  {piqFiles.length > 1 && activeAssessorType !== 'IO' && (
                    <div className="flex gap-2 flex-wrap">
                      {piqFiles.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActivePiqIndex(i)}
                          className={cn(
                            'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all',
                            i === activePiqIndex
                              ? 'bg-app-accent text-white border-app-accent'
                              : 'bg-app-card text-app-text-muted border-app-border hover:border-app-accent/50'
                          )}
                        >
                          {i === 0 ? 'Dossier' : i === 1 ? 'PIQ' : `File ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom: Psych Battery details */}
                {(activeAssessorType === 'Psych' || activeAssessorType === 'TO') && (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between px-2 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">
                      <div className="flex items-center gap-2">
                        <Sparkles size={12} className="text-app-accent animate-pulse" />
                        <span>Assessment Preview</span>
                      </div>
                    </div>
                  
                    <div className="bg-app-card/60 border border-app-border rounded-3xl overflow-hidden shadow-inner flex flex-col relative" style={{ height: '75vh', minHeight: '600px' }}>
                      <AssessmentPresenter assessmentId={assessment._id || assessment.id} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-app-sidebar border border-app-border border-dashed rounded-[3rem] p-20 text-center opacity-50 space-y-4">
                <FileText size={48} className="mx-auto text-app-border" />
                <p className="text-app-text-muted font-serif italic text-xl">No PIQ document uploaded yet by the candidate.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CLINICAL REMARKS TAB ─────────────────────────────────────── */}
      {activeTab === 'evaluation' && (() => {
        const gridConfig = ASSESSOR_GRID_CONFIG[activeAssessorType] || ASSESSOR_GRID_CONFIG.Psych;
        return (
          <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Evaluation Card */}
            <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-8 w-full">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-app-accent">
                  <Sparkles size={24} className="fill-current" />
                  <h3 className="text-2xl font-black text-app-text-bright tracking-tight">
                    {activeAssessorType === 'Psych' ? 'Psychologist Evaluation Suite' :
                     activeAssessorType === 'GTO' ? 'GTO Case Scorecard' :
                     activeAssessorType === 'IO' ? 'Interview Assessment Dossier' :
                     'Technical Aptitude Evaluation'}
                  </h3>
                </div>
                <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                  Record your detailed observations and clinical/professional grades for the allotted candidate below.
                </p>
              </div>

              {showRoleToggle && (
                <div className="space-y-2">
                  <div className="text-[9px] font-black text-app-text-muted uppercase tracking-widest px-1">Testing Role Selector (Preview Mode)</div>
                  <div className="flex gap-2 p-1 bg-app-card border border-app-border rounded-xl w-fit">
                    {(['Psych', 'GTO', 'IO', 'TO'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActiveAssessorType(t)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all",
                          activeAssessorType === t 
                            ? "bg-app-accent text-black shadow-sm" 
                            : "text-app-text-muted hover:text-app-text-bright"
                        )}
                      >
                        {t === 'Psych' ? 'Psychologist' : t === 'GTO' ? 'GTO Assessor' : t === 'IO' ? 'Interviewing Officer' : 'Technical Officer'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {/* Remarks Textarea */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Comprehensive Remarks & Dossier Analysis</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={
                      activeAssessorType === 'Psych' ? 'Enter comprehensive psychological profile and timeline analysis...' :
                      activeAssessorType === 'GTO' ? 'Enter GTO group dynamic behavior and outdoor performance marks...' :
                      activeAssessorType === 'IO' ? 'Enter comprehensive personal interview assessment and motivations...' :
                      'Enter technical aptitude, analytical comprehension, and structural thinking...'
                    }
                    rows={6}
                    className="w-full bg-app-card border border-app-border rounded-3xl p-6 text-app-text-bright font-serif text-lg italic focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent/20 transition-all placeholder:text-app-text-muted/30"
                  />
                </div>

                {/* Scoring Table Row */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-app-accent uppercase tracking-[0.2em] px-2 block">
                    TICKS and MARKS
                  </label>

                  <div className="w-full bg-app-card border border-app-border rounded-3xl overflow-hidden shadow-xl">
                    <div className="w-full overflow-hidden">
                      {(() => {
                        const traineeWidth = 'w-[13%]';
                        const marksWidth = 'w-[9%]';
                        const traitWidth = 'w-[5.2%]';
                        
                        return (
                          <table className="w-full border-collapse text-left table-fixed">
                            <colgroup>
                              <col className={traineeWidth} />
                              {gridConfig.traits.map((t) => (
                                <col key={t.id} className={traitWidth} />
                              ))}
                              <col className={marksWidth} />
                            </colgroup>
                            <thead>
                              {/* Factor Headers Row */}
                              <tr className="bg-black/30 border-b border-app-border divide-x divide-app-border/40 text-[9px] font-black text-app-accent uppercase tracking-widest text-center">
                                <th className="px-2 py-3 text-left overflow-hidden text-ellipsis whitespace-nowrap">Trainee / Chest No</th>
                                {gridConfig.factors.map((f, i) => (
                                  <th key={i} colSpan={f.colSpan} className="px-1 py-3 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {f.label}
                                  </th>
                                ))}
                                <th rowSpan={2} className="px-1 py-3 text-center align-middle font-bold text-app-accent bg-app-accent/10 overflow-hidden text-ellipsis whitespace-nowrap">
                                  MARKS
                                </th>
                              </tr>
                              {/* OLQ Codes Row */}
                              <tr className="bg-black/10 border-b border-app-border divide-x divide-app-border/40 text-[10px] font-black text-app-text-bright uppercase tracking-wider text-center">
                                <td className="px-2 py-2 text-left text-app-text-muted text-[8px] overflow-hidden text-ellipsis whitespace-nowrap">Code</td>
                                {gridConfig.traits.map((t) => (
                                  <td key={t.id} className="px-1 py-2 font-mono text-[9px] hover:bg-black/20 group relative cursor-help overflow-hidden text-ellipsis whitespace-nowrap">
                                    <span className="underline decoration-dotted decoration-app-text-muted/50">{t.code}</span>
                                    {/* Tooltip for description */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black border border-app-border text-white text-[9px] font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap z-50">
                                      {t.name}
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {/* Trainee Row */}
                              <tr className="divide-x divide-app-border/40 hover:bg-black/10 transition-colors">
                                <td className="px-2 py-3">
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="text-[11px] font-black text-app-text-bright uppercase tracking-wide leading-tight truncate mb-1">
                                      {student?.name || 'Trainee'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="px-1 py-0.5 rounded bg-black/30 border border-app-border text-[7px] font-black uppercase tracking-widest text-app-text-bright truncate">
                                        B: {student?.batch || '--'}
                                      </span>
                                      <span className="px-1 py-0.5 rounded bg-black/30 border border-app-border text-[7px] font-black uppercase tracking-widest text-app-text-bright truncate">
                                        C: {student?.chestNo || '--'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                {gridConfig.traits.map((t) => (
                                  <td key={t.id} className="p-0.5 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      value={scores[t.id] ?? ''}
                                      onChange={(e) => {
                                        if (e.target.value.length > 2) return;
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                        setScores((prev) => ({ ...prev, [t.id]: val }));
                                      }}
                                      placeholder="--"
                                      className="w-full bg-transparent border-0 text-center text-xs font-black text-app-text-bright focus:outline-none focus:ring-1 focus:ring-app-accent/50 focus:bg-black/30 rounded py-2 px-0.5 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                ))}
                                <td className="p-0.5 text-center bg-app-accent/5">
                                  <input
                                    type="number"
                                    min={0}
                                    value={scores['marks'] ?? ''}
                                    onChange={(e) => {
                                      if (e.target.value.length > 3) return;
                                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                      setScores((prev) => ({ ...prev, marks: val }));
                                    }}
                                    placeholder="--"
                                    className="w-full bg-app-accent/15 border-0 text-center text-xs font-black text-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent/80 focus:bg-app-accent/20 rounded py-2 px-1 transition-all font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── INTERVENTION PLAN TAB ──────────────────────────────────────── */}
      {activeTab === 'meeting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2">
            <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-app-accent">
                  <Calendar size={24} />
                  <h3 className="text-2xl font-black text-app-text-bright tracking-tight">{activeAssessorType} Feedback Scheduler</h3>
                </div>
                <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                  Schedule a follow-up feedback session or review with the candidate to discuss their performance from the {activeAssessorType} perspective.
                </p>
              </div>

              <div className="space-y-8 max-w-lg">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Conference Date & Hour</label>
                  <input
                    type="datetime-local"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full bg-app-card border border-app-border rounded-2xl p-4 text-sm font-black text-app-text-bright focus:outline-none focus:border-app-accent transition-all [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Secure Meeting Link</label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    className="w-full bg-app-card border border-app-border rounded-2xl p-4 text-sm font-black text-app-text-bright focus:outline-none focus:border-app-accent transition-all placeholder:text-app-text-muted/20"
                  />
                </div>

                <button
                  onClick={() => handleUpdate('MEETING_SCHEDULED')}
                  disabled={saving}
                  className="w-full py-4 bg-app-card border border-app-border hover:border-app-accent text-app-text-bright rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-black/40 hover:bg-app-accent hover:text-white disabled:opacity-50"
                >
                  Confirm & Transmit Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL ASSESSOR FEEDBACK TAB ──────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-8 w-full">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-app-accent">
                <Users size={24} className="fill-current" />
                <h3 className="text-2xl font-black text-app-text-bright tracking-tight">Final Broadcasted Feedback</h3>
              </div>
              <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                Review the qualitative feedback from all assessors across different evaluations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Psychology Evaluation', remarks: submission.psychRemarks },
                { title: 'GTO Outdoor Case', remarks: (submission as any).gtoRemarks },
                { title: 'IO Personal Interview', remarks: (submission as any).ioRemarks },
                { title: 'Technical Officer Aptitude', remarks: (submission as any).toRemarks },
              ].map((feedback, idx) => (
                <div key={idx} className="bg-app-card border border-app-border rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="border-b border-app-border pb-3">
                    <h4 className="text-xs font-black uppercase text-app-text-bright tracking-widest">{feedback.title}</h4>
                  </div>
                  <div className="bg-black/30 border border-app-border p-4 rounded-2xl min-h-[140px] overflow-y-auto leading-relaxed text-xs font-serif italic text-app-text-bright">
                    {feedback.remarks ? feedback.remarks : 'No qualitative comments recorded.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ethics & Integrity Consent Modal */}
      {showEthicsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full text-center relative overflow-hidden shadow-2xl space-y-8 animate-in scale-in-95 duration-300">
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-app-card rounded-3xl border border-app-border flex items-center justify-center mx-auto mb-6 text-app-accent shadow-inner">
                <ShieldCheck size={32} />
              </div>
              
              <h2 className="text-3xl font-black tracking-tight text-app-text-bright uppercase">
                Ethics & Integrity Protocols
              </h2>
              
              <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                As an authorized assessor, you hold absolute professional accountability for candidate evaluation. Please review and agree to the following protocols to initialize review:
              </p>

              <div className="space-y-4 pt-4 text-left">
                <div className="flex gap-4 p-4 bg-app-card rounded-2xl border border-app-border/40 hover:border-app-accent/30 transition-all">
                  <div className="w-2.5 h-2.5 bg-app-accent rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_#C5A028]"></div>
                  <div>
                    <h4 className="text-xs font-black text-app-text-bright uppercase tracking-widest mb-1">Confidentiality Mandate</h4>
                    <p className="text-xs text-app-text-muted leading-relaxed">All student info and data under review must be kept strictly confidential.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-app-card rounded-2xl border border-app-border/40 hover:border-app-accent/30 transition-all">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_#EF4444]"></div>
                  <div>
                    <h4 className="text-xs font-black text-app-text-bright uppercase tracking-widest mb-1">Recording Prohibition</h4>
                    <p className="text-xs text-app-text-muted leading-relaxed">Recording, photographing, or taking screenshots of any candidate material or answers is strictly illegal.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setShowEthicsModal(false)}
                  className="w-full py-4 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 cursor-pointer"
                >
                  I Agree & Continue
                </button>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-64 h-64 bg-app-accent/5 rounded-full blur-[100px] -ml-32 -mt-32" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionReview;
