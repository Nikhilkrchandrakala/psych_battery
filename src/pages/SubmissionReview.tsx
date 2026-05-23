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
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

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

const SubmissionReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdminUser } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'evaluation' | 'meeting'>('dossier');

  // Dossier viewer state
  const [activePiqIndex, setActivePiqIndex] = useState(0);
  const [activeAnswerIndex, setActiveAnswerIndex] = useState(0);

  // Form states
  const [remarks, setRemarks] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({ personality: 0, resilience: 0, social: 0 });
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

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
        if (subData.scores) setScores(subData.scores);
        if (subData.meetingDate) {
          const date = new Date(subData.meetingDate);
          setMeetingDate(date.toISOString().slice(0, 16));
        }
        if (subData.meetingLink) setMeetingLink(subData.meetingLink);

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

  const handleUpdate = async (status: AssessmentSubmission['status']) => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: any = {
        status,
        assessorRemarks: remarks,
        scores,
      };

      if (meetingDate) updateData.meetingDate = new Date(meetingDate).toISOString();
      if (meetingLink) updateData.meetingLink = meetingLink;

      await api.submissions.update(id, updateData);
      setSubmission(prev => prev ? { ...prev, ...updateData, status } : null);

      if (status === 'COMPLETED') {
        navigate('/assessor');
      }
    } catch (error) {
      console.error('Failed to update submission:', error);
    } finally {
      setSaving(false);
    }
  };

  const buildFileUrl = (path: string) => {
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
            <ArrowLeft size={14} /> Back to Candidate Dossiers
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
              <h1 className="text-4xl font-black tracking-tighter text-app-text-bright">{studentName}</h1>
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleUpdate('UNDER_REVIEW')}
            disabled={saving}
            className="px-6 py-3 bg-app-card border border-app-border rounded-2xl text-xs font-black text-app-text-bright hover:bg-white/5 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            Save Preliminary
          </button>
          <button
            onClick={() => handleUpdate('COMPLETED')}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Finalize Evaluation
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-app-sidebar/50 p-1 rounded-2xl border border-app-border w-fit shadow-inner">
        {[
          { id: 'dossier', label: 'Dossier Viewer', icon: FileSearch },
          { id: 'evaluation', label: 'Clinical Remarks', icon: MessageSquare },
          { id: 'meeting', label: 'Intervention Plan', icon: Calendar }
        ].map(tab => (
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
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                {/* Left: PDF / Image Viewer */}
                <div className="xl:col-span-3 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                    <span>File {activePiqIndex + 1} of {piqFiles.length}</span>
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
                  </div>

                  <div className="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-2xl" style={{ height: '680px' }}>
                    {isPdf(piqFiles[activePiqIndex]) ? (
                      <iframe
                        key={activePiqIndex}
                        src={buildFileUrl(piqFiles[activePiqIndex])}
                        className="w-full h-full"
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
                  {piqFiles.length > 1 && (
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
                          File {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: OCR Transcript */}
                <div className="xl:col-span-2 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                    <Sparkles size={12} className="text-app-accent" />
                    <span>Gemini OCR Transcript</span>
                  </div>
                  <div className="bg-app-card/60 border border-app-border rounded-3xl p-6 shadow-inner overflow-y-auto font-mono text-[11px] text-app-text-muted leading-relaxed whitespace-pre-wrap" style={{ height: '680px' }}>
                    {piqStatus === 'PROCESSING' && (
                      <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
                        <Loader2 size={32} className="animate-spin text-app-accent" />
                        <p className="text-xs font-serif italic">OCR processing in progress…</p>
                      </div>
                    )}
                    {piqStatus === 'PENDING' && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                        <FileSearch size={40} />
                        <p className="text-xs font-serif italic text-center">PIQ uploaded. OCR pipeline will process shortly.</p>
                      </div>
                    )}
                    {piqStatus === 'FAILED' && (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400/60">
                        <AlertCircle size={40} />
                        <p className="text-xs font-serif italic text-center">OCR processing failed. Review the original document manually.</p>
                      </div>
                    )}
                    {piqStatus === 'PARSED' && ocrTranscript && (
                      <span className="text-app-text-main">{ocrTranscript}</span>
                    )}
                    {piqStatus === 'PARSED' && !ocrTranscript && (
                      <span className="opacity-40 italic font-serif">Transcript parsed but no text returned.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-app-sidebar border border-app-border border-dashed rounded-[3rem] p-20 text-center opacity-50 space-y-4">
                <FileText size={48} className="mx-auto text-app-border" />
                <p className="text-app-text-muted font-serif italic text-xl">No PIQ document uploaded yet by the candidate.</p>
              </div>
            )}
          </div>

          {/* Handwritten Answer Sheets Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-app-border pb-3">
              <Layers className="text-app-accent" size={20} />
              <h2 className="text-sm font-black text-app-text-bright uppercase tracking-widest">Handwritten Answer Sheets</h2>
              <span className="ml-auto text-[10px] font-black text-app-text-muted uppercase tracking-widest">
                {answerFiles.length} {answerFiles.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {answerFiles.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                  <span>Page {activeAnswerIndex + 1} of {answerFiles.length}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setActiveAnswerIndex(i => Math.max(0, i - 1))}
                      disabled={activeAnswerIndex === 0}
                      className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      onClick={() => setActiveAnswerIndex(i => Math.min(answerFiles.length - 1, i + 1))}
                      disabled={activeAnswerIndex === answerFiles.length - 1}
                      className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                    >
                      <ChevronRight size={12} />
                    </button>
                    <a
                      href={buildFileUrl(answerFiles[activeAnswerIndex])}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent text-app-text-muted hover:text-app-accent transition-all"
                    >
                      <Maximize2 size={12} />
                    </a>
                  </div>
                </div>

                <div className="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-2xl" style={{ height: '600px' }}>
                  {isPdf(answerFiles[activeAnswerIndex]) ? (
                    <iframe
                      key={activeAnswerIndex}
                      src={buildFileUrl(answerFiles[activeAnswerIndex])}
                      className="w-full h-full"
                      title={`Answer Sheet ${activeAnswerIndex + 1}`}
                    />
                  ) : (
                    <img
                      key={activeAnswerIndex}
                      src={buildFileUrl(answerFiles[activeAnswerIndex])}
                      alt={`Handwritten Page ${activeAnswerIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {answerFiles.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {answerFiles.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveAnswerIndex(i)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all',
                          i === activeAnswerIndex
                            ? 'bg-app-accent text-white border-app-accent'
                            : 'bg-app-card text-app-text-muted border-app-border hover:border-app-accent/50'
                        )}
                      >
                        Page {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-app-sidebar border border-app-border border-dashed rounded-[3rem] p-20 text-center opacity-50 space-y-4">
                <AlertCircle size={48} className="mx-auto text-app-border" />
                <p className="text-app-text-muted font-serif italic text-xl">Handwritten answers pending student transmission.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CLINICAL REMARKS TAB ─────────────────────────────────────── */}
      {activeTab === 'evaluation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2">
            <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-app-accent">
                  <Sparkles size={24} className="fill-current" />
                  <h3 className="text-2xl font-black text-app-text-bright tracking-tight">Clinical Assessment & Remarks</h3>
                </div>
                <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                  Review the OCR transcript in the Dossier Viewer tab, then record your detailed psychological interpretation below.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Comprehensive Assessment</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter detailed psychological profile…"
                    rows={12}
                    className="w-full bg-app-card border border-app-border rounded-3xl p-6 text-app-text-bright font-serif text-lg italic focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent/20 transition-all placeholder:text-app-text-muted/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {Object.keys(scores).map(trait => (
                    <div key={trait} className="space-y-3">
                      <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">{trait} Factor</label>
                      <select
                        value={scores[trait]}
                        onChange={(e) => setScores(prev => ({ ...prev, [trait]: parseInt(e.target.value) }))}
                        className="w-full bg-app-card border border-app-border rounded-2xl py-3 px-4 text-xs font-black text-app-text-bright focus:outline-none focus:border-app-accent transition-all appearance-none cursor-pointer"
                      >
                        <option value="0">Unassigned</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(v => (
                          <option key={v} value={v}>Level {v}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-app-sidebar border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-8">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.2em] px-1">Evaluation Ledger</h3>
                <div className="h-px bg-app-border" />
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-50">Subject Identity</div>
                  <div className="text-sm font-black text-app-text-bright">{student.name}</div>
                  <div className="text-[10px] font-bold text-app-text-muted mt-0.5">{student.email}</div>
                </div>

                <div>
                  <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-50">Protocol Sequence</div>
                  <div className="text-sm font-black text-app-text-bright">{assessment.title}</div>
                  <div className="text-[10px] font-bold text-app-text-muted mt-0.5">{assessment.duration} Minute Cadence</div>
                </div>

                <div>
                  <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-2 opacity-50">Temporal Markers</div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={12} className="text-app-text-muted" />
                    <span className="text-[11px] font-bold text-app-text-main">
                      Started: {submission.startedAt ? new Date(submission.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  </div>
                  {submission.completedAt && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={12} className="text-app-accent" />
                      <span className="text-[11px] font-bold text-app-text-main">
                        Sealed: {new Date(submission.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-app-border">
                <div className="bg-app-card p-4 rounded-2xl border border-app-border shadow-inner">
                  <div className="text-[9px] font-black text-app-accent uppercase tracking-widest mb-1.5">Internal Note</div>
                  <p className="text-[10px] text-app-text-muted leading-relaxed font-serif italic">
                    Remarks are saved when you click "Save Preliminary". Finalizing will release the report.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-app-accent text-white rounded-[2rem] p-8 space-y-4 shadow-xl shadow-app-accent/20 relative overflow-hidden group">
              <h4 className="text-lg font-black uppercase tracking-tighter leading-none italic relative z-10">Assessor Mandate</h4>
              <p className="text-xs font-medium text-white/70 leading-relaxed relative z-10">
                You are entering the "Finalize" phase of clinical interpretation. This will release the preliminary report to the candidate's dashboard.
              </p>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* ── INTERVENTION PLAN TAB ──────────────────────────────────────── */}
      {activeTab === 'meeting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2">
            <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-app-accent">
                  <Calendar size={24} />
                  <h3 className="text-2xl font-black text-app-text-bright tracking-tight">Intervention Scheduler</h3>
                </div>
                <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                  Schedule a follow-up interview or deep-dive session with the candidate to clarify psychological markers.
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
    </div>
  );
};

export default SubmissionReview;
