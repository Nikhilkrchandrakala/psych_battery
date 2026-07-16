import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserProfile, Assessment, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { 
  Layers, Plus, Trash2, Edit2, UserPlus, Database, ArrowRight, Play,
  Eye, X, CheckCircle, AlertCircle, Send, Lock, Unlock, Copy
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

const AdminDashboard: React.FC = () => {
  const { isAdminUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'catalogue' ? 'assessments' : 'assignments';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Super Admin Auditing State
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null);
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const [auditing, setAuditing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAdminUser) return;
      try {
        const [usersList, assessmentsList, submissionsList] = await Promise.all([
          api.users.list(),
          api.assessments.list(),
          api.submissions.list()
        ]);

        setUsers(usersList);
        setAssessments(assessmentsList);
        setSubmissions(submissionsList);
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdminUser]);

  const assignAssessor = async (submissionId: string, assessorId: string) => {
    try {
      await api.submissions.update(submissionId, { 
        assessorId, 
        status: 'ASSIGNED'
      });
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, assessorId, status: 'ASSIGNED' } : s));
    } catch (error) {
      console.error('Failed to assign assessor to submission:', error);
    }
  };

  const handleAuditAssessor = async (submissionId: string, assessorType: string, action: 'APPROVE' | 'REJECT') => {
    setAuditing(true);
    try {
      const remarks = revisionNotes[assessorType] || '';
      const response = await api.submissions.audit(submissionId, {
        assessorType,
        action,
        remarks
      });

      const updatedSub = response.submission;
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, ...updatedSub } : s));
      setSelectedSubmission(prev => prev && prev.id === submissionId ? { ...prev, ...updatedSub } : prev);
      setRevisionNotes(prev => ({ ...prev, [assessorType]: '' }));
      alert(`Assessor ${assessorType} report successfully ${action === 'APPROVE' ? 'Approved & Locked' : 'Rejected & Unlocked'}.`);
    } catch (err: any) {
      console.error('Failed to audit assessor report:', err);
      alert(err.message || 'Failed to audit report.');
    } finally {
      setAuditing(false);
    }
  };

  const handleBroadcastSub = async (submissionId: string) => {
    setBroadcasting(true);
    try {
      const response = await api.submissions.broadcast(submissionId);
      const updatedSub = response.submission;

      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, ...updatedSub } : s));
      setSelectedSubmission(prev => prev && prev.id === submissionId ? { ...prev, ...updatedSub } : prev);
      alert('Success! All qualitative written feedback comments have been successfully broadcasted to the candidate.');
    } catch (err: any) {
      console.error('Failed to broadcast results:', err);
      alert(err.message || 'Failed to broadcast results.');
    } finally {
      setBroadcasting(false);
    }
  };

  const createAssessment = async () => {
    try {
      const newAssessment = {
        title: 'New Protocol',
        description: 'Describe the purpose of this psychological battery.',
        type: 'GENERAL',
        instructions: 'Follow the on-screen instructions.',
        duration: 30,
        active: false,
      };
      
      const created = await api.assessments.create(newAssessment);
      navigate(`/admin/assessment/${created.id}`);
    } catch (error) {
      console.error('Failed to create assessment:', error);
    }
  };

  const deleteAssessment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) return;
    try {
      await api.assessments.delete(id);
      setAssessments(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete assessment:', error);
      alert('Failed to delete assessment.');
    }
  };

  const duplicateAssessment = async (id: string) => {
    if (!window.confirm('Are you sure you want to duplicate this assessment?')) return;
    try {
      const newAssessment = await api.assessments.duplicate(id);
      setAssessments(prev => [...prev, newAssessment]);
    } catch (error) {
      console.error('Failed to duplicate assessment:', error);
      alert('Failed to duplicate assessment.');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
             <div className="flex items-center gap-3 mb-2">
              <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">Admin Nexus</h1>
              <span className="px-3 py-1 bg-app-accent/10 border border-app-accent/20 rounded-lg text-[10px] font-black text-app-accent uppercase tracking-widest leading-none">
                Privileged Access
              </span>
            </div>
            <p className="text-app-text-muted text-xl font-serif italic max-w-2xl leading-relaxed">
              Global protocol control, user management, and assessor progress monitoring.
            </p>
          </div>
        </div>
      </div>





      {activeTab === 'assessments' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex justify-between items-center bg-app-sidebar border border-app-border p-4 px-8 rounded-3xl shadow-lg">
              <h3 className="text-sm font-black text-app-text-bright uppercase tracking-widest italic">Assessment Catalogue</h3>
              <button 
                onClick={createAssessment}
                className="px-6 py-2.5 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-app-accent/20 flex items-center gap-2"
              >
                 <Plus size={16} /> New Assessment Battery
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assessments.map(a => (
                <div key={a.id} className="bg-app-sidebar border border-app-border rounded-[2rem] p-8 shadow-2xl hover:border-app-accent/50 transition-all group">
                   <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-app-card rounded-2xl border border-app-border">
                         <Database size={24} className="text-app-accent" />
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border",
                        a.active ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {a.active ? 'Operational' : 'Disabled'}
                      </span>
                   </div>
                   <h4 className="text-xl font-black text-app-text-bright mb-2 tracking-tight">{a.title}</h4>
                   <p className="text-app-text-muted text-xs font-serif italic mb-6 line-clamp-2">{a.description}</p>
                   
                   <div className="pt-6 border-t border-app-border flex items-center justify-between">
                      <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{a.duration} Mins</span>
                      <div className="flex items-center gap-2">
                         <Link to={`/admin/assessment/${a.id}`} className="p-2 text-app-text-muted hover:text-app-text-bright transition-colors" title="Edit Protocol">
                           <Edit2 size={16} />
                         </Link>
                         <Link to={`/assessment/${a.id}`} className="p-2 text-app-accent hover:text-amber-500 transition-colors" title="Test Protocol">
                           <Play size={16} />
                         </Link>
                         <button onClick={() => duplicateAssessment(a.id)} className="p-2 text-app-text-muted hover:text-green-400 transition-colors" title="Duplicate Protocol"><Copy size={16} /></button>
                         <button onClick={() => deleteAssessment(a.id)} className="p-2 text-app-text-muted hover:text-red-400 transition-colors" title="Delete Protocol"><Trash2 size={16} /></button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'assignments' && (
          <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in duration-500">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                 <thead>
                   <tr className="bg-black/10">
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Candidate</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-center">Candidate Step</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-center">Psychologist</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-center">GTO</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-center">Interview (IO)</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-center">Technical (TO)</th>
                     <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {submissions.map((s) => {
                     const student = s.student || users.find(u => u.uid === s.userId) || users.find(u => u.id === s.userId);
                     const studentName = student?.name || 'Unknown Candidate';
                     const studentEmail = student?.email || 'N/A';
                     
                     // Candidate Step calculation
                     const hasPiq = s.piqFiles && s.piqFiles.length > 0;
                     const isTestCompleted = s.status === 'COMPLETED' || s.status === 'REVIEW_PENDING' || s.status === 'TEST_COMPLETED' || s.status === 'REPORT_RELEASED';
                     const hasDossier = s.uploadedFiles && s.uploadedFiles.length > 0;
   
                     let candidateStepContent;
                     if (hasDossier) {
                       candidateStepContent = (
                         <div className="flex items-center justify-center gap-1.5" title="All Documents Uploaded / Timed Test Complete">
                           <span className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.3)] animate-pulse">
                             <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                           </span>
                           <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Sealed</span>
                         </div>
                       );
                     } else if (isTestCompleted) {
                       candidateStepContent = (
                         <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider">
                           Candidate Evaluation
                         </span>
                       );
                     } else if (hasPiq) {
                       candidateStepContent = (
                         <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-wider">
                           PIQ Uploaded
                         </span>
                       );
                     } else {
                       candidateStepContent = (
                         <span className="px-2.5 py-1 rounded bg-app-card text-app-text-muted border border-app-border text-[9px] font-black uppercase tracking-wider">
                           PIQ Pending
                         </span>
                       );
                     }
   
                     // Dots rendering helper
                     const renderAssessorDot = (assigned: any, statusVal: string, name: string) => {
                       if (!assigned) {
                         return (
                           <div className="flex items-center justify-center" title="Not required for this candidate's course">
                             <span className="w-3 h-3 bg-gray-700 rounded-full shadow-inner inline-block" />
                           </div>
                         );
                       }
                       if (statusVal === 'COMPLETED') {
                         return (
                           <div className="flex items-center justify-center" title={`${name}: Evaluation Finalized & Locked`}>
                             <span className="w-3.5 h-3.5 bg-green-500 rounded-full shadow-[0_0_8px_#22C55E] inline-block" />
                           </div>
                         );
                       }
                       return (
                         <div className="flex items-center justify-center" title={`${name}: Assessment Pending`}>
                           <span className="w-3.5 h-3.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_#F59E0B] inline-block" />
                         </div>
                       );
                     };
   
                     return (
                     <tr key={s.id} className="border-b border-app-border hover:bg-white/5 transition-colors group">
                       <td className="p-6">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-sm font-black text-app-text-bright">{studentName}</div>
                            <span className="px-1.5 py-0.5 rounded bg-black/30 border border-app-border text-[8px] font-black uppercase tracking-widest text-app-text-bright whitespace-nowrap">
                              B: {student?.batch || '--'} | C: {student?.chestNo || '--'}
                            </span>
                          </div>
                          <div className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">{studentEmail}</div>
                       </td>
                       <td className="p-6 text-center">
                          {candidateStepContent}
                       </td>
                       <td className="p-6 text-center">
                          {renderAssessorDot(student?.assignedPsych, s.psychStatus || 'PENDING', 'Psychologist')}
                       </td>
                       <td className="p-6 text-center">
                          {renderAssessorDot(student?.assignedGTO, (s as any).gtoStatus || 'PENDING', 'GTO Assessor')}
                       </td>
                       <td className="p-6 text-center">
                          {renderAssessorDot(student?.assignedIO, (s as any).ioStatus || 'PENDING', 'Interviewing Officer')}
                       </td>
                       <td className="p-6 text-center">
                          {renderAssessorDot(student?.assignedTO, (s as any).toStatus || 'PENDING', 'Technical Officer')}
                       </td>
                       <td className="p-6 text-right">
                          <button
                            onClick={() => setSelectedSubmission(s)}
                            className="p-2 text-app-text-muted hover:text-app-accent hover:scale-115 active:scale-95 transition-all inline-flex items-center cursor-pointer"
                            title="Audit Scorecard Details"
                          >
                            <Eye size={20} />
                          </button>
                       </td>
                     </tr>
                     );
                   })}
                 </tbody>
              </table>
            </div>
          </div>
      )}

      {/* ── SUPER ADMIN AUDIT DETAILS VIEW MODAL ──────────────────────────────── */}
      {selectedSubmission && (() => {
        const s = selectedSubmission;
        const student = s.student || users.find(u => u.uid === s.userId) || users.find(u => u.id === s.userId);
        const studentName = student?.name || 'Candidate';
        const studentEmail = student?.email || 'N/A';

        // Audit broadcast completion check
        const isPsychDone = !student?.assignedPsych || s.psychStatus === 'COMPLETED';
        const isGtoDone = !student?.assignedGTO || (s as any).gtoStatus === 'COMPLETED';
        const isIoDone = !student?.assignedIO || (s as any).ioStatus === 'COMPLETED';
        const isToDone = !student?.assignedTO || (s as any).toStatus === 'COMPLETED';
        const allAssessorDone = isPsychDone && isGtoDone && isIoDone && isToDone;
        const isBroadcasted = s.status === 'REPORT_RELEASED';

        const psychTraits = [
            { id: 'effective_intelligence', code: 'EI', name: 'Effective Intelligence' },
            { id: 'reasoning_ability', code: 'RA', name: 'Reasoning Ability' },
            { id: 'organizing_ability', code: 'OA', name: 'Organizing Ability' },
            { id: 'power_of_expression', code: 'POE', name: 'Power of Expression' },
            { id: 'social_adaptability', code: 'SA', name: 'Social Adaptability' },
            { id: 'cooperation', code: 'COOP', name: 'Cooperation' },
            { id: 'sense_of_responsibility', code: 'SOR', name: 'Sense of Responsibility' },
            { id: 'initiative', code: 'INIT', name: 'Initiative' },
            { id: 'self_confidence', code: 'SC', name: 'Self Confidence' },
            { id: 'speed_of_decision', code: 'SOD', name: 'Speed of Decision' },
            { id: 'ability_to_influence_the_group', code: 'AIG', name: 'Influence Group' },
            { id: 'liveliness', code: 'LIV', name: 'Liveliness' },
            { id: 'determination', code: 'D', name: 'Determination' },
            { id: 'courage', code: 'C', name: 'Courage' },
            { id: 'stamina', code: 'S', name: 'Stamina' }
        ];

        const ASSESSOR_TRAITS_CONFIG = {
          Psych: psychTraits,
          GTO: psychTraits,
          IO: psychTraits,
          TO: psychTraits
        };

        const gridConfig = {
          factors: [
            { label: <>FACTOR I:<br/>PLANNING & ORGANIZING</>, colSpan: 4 },
            { label: <>FACTOR II:<br/>SOCIAL ADJUSTMENT</>, colSpan: 3 },
            { label: <>FACTOR III:<br/>SOCIAL EFFECTIVENESS</>, colSpan: 5 },
            { label: <>FACTOR IV:<br/>DYNAMIC</>, colSpan: 3 }
          ],
          traits: psychTraits
        };

        const renderAuditAssessorCard = (type: 'Psych' | 'GTO' | 'IO' | 'TO', title: string, assignedId: any, statusVal: string, remarksVal: string) => {
          if (!assignedId) return null;

          const scoresMap = (s as any)[`${type.toLowerCase()}Scores`] || {};
          const traitsList = ASSESSOR_TRAITS_CONFIG[type];
          const traitsScoreEntries = traitsList.filter(t => scoresMap[t.id] !== undefined && scoresMap[t.id] > 0);
          const finalMarks = scoresMap.marks || 0;

          const isAssessorVisible = s.reportVisibility?.[type.toLowerCase() as 'psych' | 'io' | 'gto' | 'to'];
          const isCompleted = statusVal === 'COMPLETED';

          const handleIndividualBroadcast = async () => {
            if (broadcasting) return;
            setBroadcasting(true);
            try {
              const response = await api.submissions.broadcast(s.id!, { assessorType: type.toLowerCase() });
              const updatedSub = response.submission;
              setSubmissions(prev => prev.map(item => item.id === s.id ? { ...item, ...updatedSub } : item));
              setSelectedSubmission(prev => prev && prev.id === s.id ? { ...prev, ...updatedSub } : prev);
              alert(`Success! ${type.toUpperCase()} qualitative remarks have been released/broadcasted to the candidate.`);
            } catch (err: any) {
              console.error('Failed to broadcast individual assessor result:', err);
              alert(err.message || 'Failed to broadcast result.');
            } finally {
              setBroadcasting(false);
            }
          };

          return (
            <div className="bg-app-card border border-app-border rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-app-border pb-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-app-text-bright tracking-widest">{title}</h4>
                  <span className="text-[9px] font-black text-app-text-muted uppercase tracking-wider block mt-0.5">Assigned evaluator</span>
                </div>
                <div className="flex items-center gap-3">
                  {!isBroadcasted && (
                    <button
                      onClick={handleIndividualBroadcast}
                      disabled={broadcasting}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all flex items-center gap-1.5",
                        isAssessorVisible 
                          ? "bg-app-card border-app-border text-app-text-bright hover:border-app-accent" 
                          : "bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white border-transparent hover:opacity-90 shadow-md shadow-app-accent/10"
                      )}
                    >
                      <Send size={10} />
                      {isAssessorVisible ? 'Rebroadcast' : 'Broadcast'}
                    </button>
                  )}
                  <span className={cn(
                    "px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                    statusVal === 'COMPLETED' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                  )}>
                    {statusVal}
                  </span>
                </div>
              </div>

              {/* Written Remarks */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase text-app-text-muted tracking-widest">Written Remarks & Feedback</span>
                <div className="bg-black/30 border border-app-border p-4 rounded-2xl max-h-[140px] overflow-y-auto leading-relaxed text-sm font-serif italic text-app-text-bright">
                  {remarksVal ? remarksVal : 'No qualitative comments recorded yet.'}
                </div>
              </div>

              {/* Ticks and Marks (Grades) */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-app-accent tracking-widest block">Scorecard Ticks & Marks</span>
                {traitsScoreEntries.length > 0 ? (
                  <div className="bg-app-sidebar border border-app-border rounded-xl overflow-x-auto shadow-2xl hide-scrollbar">
                    <table className="w-full border-collapse text-left table-fixed min-w-[700px]">
                      <thead>
                        {/* Factor Headers Row */}
                        <tr className="bg-black/30 border-b border-app-border divide-x divide-app-border/40 text-[11px] font-black text-app-accent uppercase tracking-widest text-center">
                          {gridConfig.factors.map((f, i) => (
                            <th key={i} colSpan={f.colSpan} className="px-1 py-2 leading-tight">
                              {f.label}
                            </th>
                          ))}
                          <th rowSpan={2} className="w-[12%] px-1 py-3 text-center align-middle font-bold text-app-accent bg-app-accent/10 overflow-hidden text-ellipsis whitespace-nowrap">
                            MARKS
                          </th>
                        </tr>
                        {/* OLQ Codes Row */}
                        <tr className="bg-black/10 border-b border-app-border divide-x divide-app-border/40 text-xs font-black text-app-text-bright uppercase tracking-wider text-center">
                          {gridConfig.traits.map((t) => (
                            <td key={t.id} className="w-[5.8%] px-1 py-2 font-mono text-xs hover:bg-black/20 group relative cursor-help overflow-hidden text-ellipsis whitespace-nowrap">
                              <span className="underline decoration-dotted decoration-app-text-muted/50">{t.code}</span>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black border border-app-border text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap z-50">
                                {t.name}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="divide-x divide-app-border/40 hover:bg-black/10 transition-colors">
                          {gridConfig.traits.map((t) => (
                            <td key={t.id} className="p-0.5 text-center">
                              <div className="w-full text-center text-sm font-black text-app-text-bright py-2 px-0.5">
                                {scoresMap[t.id] ?? 0}
                              </div>
                            </td>
                          ))}
                          <td className="p-0.5 text-center bg-app-accent/5">
                            <div className="w-full text-center text-sm font-black text-app-accent py-2 px-1 font-mono">
                              {finalMarks}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs italic text-app-text-muted bg-black/10 p-4 rounded-2xl text-center">
                    No numeric traits graded yet.
                  </div>
                )}
              </div>


            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
            <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] max-w-6xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl flex flex-col animate-in scale-in-95 duration-300">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-app-border p-8 shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-app-text-bright tracking-tight uppercase">Audit: {studentName}</h2>
                    <span className="px-2.5 py-0.5 bg-app-accent/10 border border-app-accent/20 rounded text-[9px] font-black text-app-accent uppercase tracking-wider leading-none whitespace-nowrap">
                      Batch: {student?.batch || '--'} | Chest No: {student?.chestNo || '--'}
                    </span>
                  </div>
                  <p className="text-xs text-app-text-muted font-serif italic">{studentEmail}</p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 bg-app-card border border-app-border rounded-xl text-app-text-muted hover:text-app-text-bright hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-8 overflow-y-auto flex-grow">
                {/* Scorecards Grid */}
                <div className="flex flex-col gap-6">
                  {renderAuditAssessorCard('Psych', 'Psychology Evaluation Report', student?.assignedPsych, s.psychStatus || 'PENDING', s.psychRemarks || '')}
                  {renderAuditAssessorCard('GTO', 'GTO Outdoor Case Report', student?.assignedGTO, (s as any).gtoStatus || 'PENDING', (s as any).gtoRemarks || '')}
                  {renderAuditAssessorCard('IO', 'IO Personal Interview Report', student?.assignedIO, (s as any).ioStatus || 'PENDING', (s as any).ioRemarks || '')}
                  {renderAuditAssessorCard('TO', 'Technical Officer Aptitude Report', student?.assignedTO, (s as any).toStatus || 'PENDING', (s as any).toRemarks || '')}
                </div>
              </div>

              {/* Modal Footer (Broadcast Switch) */}
              <div className="bg-black/30 border-t border-app-border p-8 shrink-0 flex flex-col md:flex-row items-center justify-between gap-6 rounded-b-[2.5rem]">
                <div className="space-y-1 max-w-xl text-center md:text-left">
                  <h4 className="text-xs font-black uppercase text-app-text-bright tracking-wider">Results Broadcasting Protocol</h4>
                  <p className="text-[10px] text-app-text-muted font-serif italic leading-relaxed">
                    Once broadcasted, the candidate's portfolio locks permanently. The student will instantly be granted access to **only their qualitative written remarks** — strictly shielding all OLQ grades, traits score sheets, ticks, and numeric marks.
                  </p>
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  {isBroadcasted ? (
                    <div className="px-6 py-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 w-full sm:w-auto">
                      <CheckCircle size={16} />
                      Final Results Broadcasted & Released
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBroadcastSub(s.id!)}
                      disabled={broadcasting}
                      className="w-full md:w-auto px-8 py-4 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-xl shadow-app-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Send size={16} />
                      {broadcasting ? 'Broadcasting...' : 'Broadcast Final Result to Student'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AdminDashboard;
