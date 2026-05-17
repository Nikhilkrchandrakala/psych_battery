import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, Assessment, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import { 
  ArrowLeft, FileText, Calendar, MessageSquare, 
  User as UserIcon, Clock, ShieldCheck,
  CheckCircle2, Sparkles, AlertCircle, Maximize2
} from 'lucide-react';
import { cn } from '../lib/utils';

const SubmissionReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdminUser } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'evaluation' | 'meeting'>('dossier');
  
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
        setSubmission(subData);
        setRemarks(subData.assessorRemarks || '');
        if (subData.scores) setScores(subData.scores);
        if (subData.meetingDate) {
          const date = new Date(subData.meetingDate);
          setMeetingDate(date.toISOString().slice(0, 16));
        }
        if (subData.meetingLink) setMeetingLink(subData.meetingLink);

        const [assessData, studentData] = await Promise.all([
          api.assessments.get(subData.assessmentId),
          api.users.list().then(users => users.find((u: any) => u.id === subData.userId))
        ]);

        setAssessment(assessData);
        setStudent(studentData);
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

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!submission || !student || !assessment) return <div className="text-app-text-bright p-12 text-center">Protocol record not identified.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/assessor')}
            className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
          >
            <ArrowLeft size={14} /> Back to Repository
          </button>
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 rounded-[1.5rem] bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
               {student.profileImage ? (
                 <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
               ) : (
                 <UserIcon size={32} className="text-app-text-muted" />
               )}
             </div>
             <div>
               <h1 className="text-4xl font-black tracking-tighter text-app-text-bright">{student.name}</h1>
               <div className="flex items-center gap-3 mt-1">
                 <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{assessment.title}</span>
                 <span className="w-1 h-1 bg-app-border rounded-full" />
                 <span className="px-2 py-0.5 rounded bg-app-accent/10 border border-app-accent/20 text-[9px] font-black text-app-accent uppercase tracking-[0.15em] leading-none">
                   {submission.status.replace('_', ' ')}
                 </span>
               </div>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button
            onClick={() => handleUpdate('UNDER_REVIEW')}
            className="px-6 py-3 bg-app-card border border-app-border rounded-2xl text-xs font-black text-app-text-bright hover:bg-white/5 transition-all shadow-lg active:scale-95"
           >
            Save Preliminary
           </button>
           <button
            onClick={() => handleUpdate('COMPLETED')}
            className="px-6 py-3 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 flex items-center gap-2"
           >
            Finalize Evaluation <CheckCircle2 size={16} />
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-app-sidebar/50 p-1 rounded-2xl border border-app-border w-fit shadow-inner">
        {[
          { id: 'dossier', label: 'Stimuli Dossier', icon: FileText },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
           {activeTab === 'dossier' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {submission.answerSheetUrls?.map((url, i) => (
                   <div key={i} className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-2xl group flex flex-col space-y-4">
                     <div className="flex items-center justify-between text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                        <span>Plate Index {i + 1}</span>
                        <a href={url} target="_blank" rel="noreferrer" className="text-app-accent hover:text-app-text-bright transition-colors flex items-center gap-1.5 underline decoration-app-accent/30 underline-offset-4">
                          Expand <Maximize2 size={12} />
                        </a>
                     </div>
                     <div className="bg-app-card rounded-2xl border border-app-border overflow-hidden relative cursor-zoom-in h-[500px]">
                        <img src={url} alt={`Dossier Sheet ${i + 1}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                     </div>
                   </div>
                 ))}
                 {!submission.answerSheetUrls?.length && (
                   <div className="bg-app-sidebar border border-app-border border-dashed rounded-[3rem] p-24 col-span-2 text-center opacity-50 space-y-4">
                      <AlertCircle size={48} className="mx-auto text-app-border" />
                      <p className="text-app-text-muted font-serif italic text-xl">Dossier images are pending student transmission.</p>
                   </div>
                 )}
               </div>
             </div>
           )}

           {activeTab === 'evaluation' && (
             <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-app-accent">
                    <Sparkles size={24} className="fill-current" />
                    <h3 className="text-2xl font-black text-app-text-bright tracking-tight">Clinical Remarks</h3>
                  </div>
                  <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                    Provide detailed psychological interpretation of the candidate's responses. Focus on consistency, spontaneity, and thematic undercurrents.
                  </p>
               </div>

               <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Comprehensive Assessment</label>
                    <textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter detailed psychological profile..."
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
           )}

           {activeTab === 'meeting' && (
             <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-app-accent">
                    <Calendar size={24} className="fill-current" />
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
                    className="w-full py-4 bg-app-card border border-app-border hover:border-app-accent text-app-text-bright rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-black/40 hover:bg-app-accent hover:text-white"
                  >
                    Confirm & Transmit Invite
                  </button>
               </div>
             </div>
           )}
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
                        Sealed: {submission.completedAt ? new Date(submission.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                       </span>
                     </div>
                   )}
                </div>
              </div>

              <div className="pt-4 border-t border-app-border">
                 <div className="bg-app-card p-4 rounded-2xl border border-app-border shadow-inner">
                    <div className="text-[9px] font-black text-app-accent uppercase tracking-widest mb-1.5">Internal System Note</div>
                    <p className="text-[10px] text-app-text-muted leading-relaxed font-serif italic">
                      This evaluation is pending finalizing. All data entered is auto-saved locally during the session.
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
    </div>
  );
};

export default SubmissionReview;
