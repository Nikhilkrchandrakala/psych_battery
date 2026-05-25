import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Users, Search, Filter, ExternalLink, Shield, ArrowRight, User as UserIcon, Bell, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface NotificationItem {
  id: string;
  recipientId: string;
  studentId: {
    id: string;
    name: string;
    email: string;
  };
  submissionId: {
    id: string;
    assessmentId: string;
    status: string;
  };
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const AssessorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<(AssessmentSubmission & { student?: UserProfile })[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssessorType, setActiveAssessorType] = useState<'Psych' | 'GTO' | 'TO' | 'IO'>('Psych');

  useEffect(() => {
    if (profile?.assessorType) {
      setActiveAssessorType(profile.assessorType);
    }
  }, [profile]);

  const showRoleToggle = !profile?.assessorType;

  const headerTitle = 
    activeAssessorType === 'Psych' ? 'Psychologist Terminal' :
    activeAssessorType === 'GTO' ? 'GTO Assessment Desk' :
    activeAssessorType === 'IO' ? 'Interviewing Officer Terminal' :
    activeAssessorType === 'TO' ? 'Technical Officer Terminal' :
    'Assessor Terminal';

  const headerDesc = 
    activeAssessorType === 'Psych' ? 'Monitor candidate timed batteries, TAT/WAT/SRT/SDT responses, and evaluate the 15 Officer Like Qualities (OLQs).' :
    activeAssessorType === 'GTO' ? 'Assess group dynamics, physical coordination, cooperation, and practical intellect of your allotted candidates.' :
    activeAssessorType === 'IO' ? 'Conduct comprehensive personal interviews, grade verbal expression, and schedule/record feedback sessions.' :
    activeAssessorType === 'TO' ? 'Evaluate practical technical problem solving, analytical ability, and technical comprehension.' :
    'Monitor candidate progress, review psychological dossiers, and conduct professional evaluations.';

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const subData = await api.submissions.list();
        setSubmissions(subData);

        const notifData = await (api as any).notifications.list();
        setNotifications(notifData);
      } catch (error) {
        console.error('Failed to fetch assessor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await (api as any).notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-end gap-3 mb-2">
            <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">{headerTitle}</h1>
            <span className="w-3 h-3 bg-app-accent rounded-full mb-3 shadow-[0_0_10px_#C5A028]"></span>
          </div>
          <p className="text-app-text-muted text-xl font-serif italic max-w-2xl leading-relaxed">
            {headerDesc}
          </p>
        </div>

        {showRoleToggle && (
          <div className="flex gap-2 p-1 bg-app-sidebar border border-app-border rounded-2xl w-fit self-start shrink-0 shadow-lg">
            {(['Psych', 'GTO', 'IO', 'TO'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveAssessorType(t)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all",
                  activeAssessorType === t 
                    ? "bg-app-accent text-black shadow-md shadow-app-accent/20" 
                    : "text-app-text-muted hover:text-app-text-bright hover:bg-white/5"
                )}
              >
                {t === 'Psych' ? 'Psychologist' : t === 'GTO' ? 'GTO' : t === 'IO' ? 'Interview' : 'Technical'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="space-y-6">
          <div className="bg-app-sidebar border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-8">
            <div className="space-y-4">
               <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.2em] border-b border-app-border pb-3">
                Assigned Caseload
               </h3>
               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-app-card p-4 rounded-2xl border border-app-border">
                   <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Pending</div>
                   <div className="text-2xl font-black text-app-text-bright">
                    {submissions.filter(s => s.status === 'UPLOADED' || s.status === 'ASSIGNED').length}
                   </div>
                 </div>
                 <div className="bg-app-card p-4 rounded-2xl border border-app-border">
                   <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Completed</div>
                   <div className="text-2xl font-black text-app-text-bright">
                    {submissions.filter(s => s.status === 'COMPLETED').length}
                   </div>
                 </div>
               </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.2em] border-b border-app-border pb-3 flex items-center gap-2">
                <Bell size={12} className="text-app-accent animate-pulse" /> Real-Time Alerts
               </h3>
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                 {notifications.filter(n => !n.isRead).length === 0 ? (
                   <p className="text-[11px] text-app-text-muted italic font-serif">
                     Zero active dossier alerts. All systems sync'd.
                   </p>
                 ) : (
                   notifications.filter(n => !n.isRead).map((notif) => (
                     <div key={notif.id} className="p-3 bg-app-card rounded-xl border border-app-border space-y-2 hover:border-app-accent/30 transition-all">
                       <div className="flex justify-between items-start gap-2">
                         <div className="text-[11px] font-black text-app-text-bright tracking-tight leading-tight">
                           {notif.title}
                         </div>
                         <button 
                           onClick={() => handleMarkAsRead(notif.id)}
                           className="p-1 hover:bg-white/10 rounded text-app-text-muted hover:text-green-400 transition-all"
                           title="Mark as Read"
                         >
                           <Check size={10} />
                         </button>
                       </div>
                       <p className="text-[10px] text-app-text-muted leading-relaxed">
                         {notif.message}
                       </p>
                       <div className="flex justify-between items-center text-[9px] pt-1">
                         <span className="text-app-accent font-semibold">
                           {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                         <Link 
                           to={`/review/${notif.submissionId?.id || notif.submissionId}`}
                           className="hover:underline text-app-text-bright font-black tracking-widest uppercase"
                         >
                           Review dossier →
                         </Link>
                       </div>
                     </div>
                   ))
                 )}
               </div>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-app-sidebar border border-app-border p-4 rounded-3xl shadow-lg">
            <div className="relative flex-grow max-w-md w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
               <input 
                type="text" 
                placeholder="Search candidate dossiers..." 
                className="w-full bg-app-card border border-app-border rounded-xl py-2.5 pl-12 pr-4 text-xs font-medium focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent/20 transition-all text-app-text-bright"
               />
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-text-muted hover:text-app-text-bright transition-colors">
                <Filter size={20} />
               </button>
            </div>
          </div>

          <div className="space-y-4">
             {submissions.length === 0 ? (
               <div className="bg-app-sidebar p-20 rounded-[2.5rem] border border-app-border border-dashed text-center">
                 <div className="w-20 h-20 bg-app-card border border-app-border rounded-3xl flex items-center justify-center mx-auto mb-6 text-app-text-muted opacity-20">
                    <Users size={40} />
                 </div>
                 <h3 className="text-xl font-bold text-app-text-bright mb-2">No dossiers detected.</h3>
                 <p className="text-app-text-muted text-sm italic font-serif leading-relaxed">No candidates have been assigned to your evaluation queue yet.</p>
               </div>
             ) : (
               <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-app-border bg-black/20">
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">Candidate Identity</th>
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">Lifecycle Status</th>
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">Clinical Stage</th>
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">Allotted Assessors</th>
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted">Session Date</th>
                       <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted text-right">Cadence</th>
                     </tr>
                   </thead>
                   <tbody>
                     {submissions.map((sub) => (
                       <tr key={sub.id} className="border-b border-app-border hover:bg-white/5 transition-colors group">
                         <td className="p-6">
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                               {sub.student?.profileImage ? (
                                 <img src={sub.student.profileImage} alt={sub.student.name} className="w-full h-full object-cover" />
                               ) : (
                                 <UserIcon size={24} className="text-app-text-muted" />
                               )}
                             </div>
                             <div>
                               <div className="text-sm font-black text-app-text-bright">{sub.student?.name || 'Unknown Candidate'}</div>
                               <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">{sub.student?.email || 'N/A'}</div>
                             </div>
                           </div>
                         </td>
                         <td className="p-6">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                              sub.status === 'COMPLETED' ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5" :
                              sub.status === 'MEETING_SCHEDULED' ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5" :
                              sub.status === 'UPLOADED' ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5" :
                              "bg-app-card text-app-text-muted border-app-border"
                            )}>
                              {sub.status.replace('_', ' ')}
                            </span>
                         </td>
                         <td className="p-6">
                            <span className="px-2.5 py-1 rounded bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-[0.15em] text-app-text-bright">
                              {sub.student?.clinicalStage || 'Screening'}
                            </span>
                         </td>
                         <td className="p-6">
                           <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                             {sub.student?.assignedPsych && (
                               <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-black uppercase tracking-wider">Psych</span>
                             )}
                             {sub.student?.assignedGTO && (
                               <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-wider">GTO</span>
                             )}
                             {sub.student?.assignedIO && (
                               <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-black uppercase tracking-wider">IO</span>
                             )}
                             {sub.student?.assignedTO && (
                               <span className="px-1.5 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded text-[9px] font-black uppercase tracking-wider">TO</span>
                             )}
                             {!sub.student?.assignedPsych && !sub.student?.assignedGTO && !sub.student?.assignedIO && !sub.student?.assignedTO && (
                               <span className="text-[10px] italic text-app-text-muted">None Allotted</span>
                             )}
                           </div>
                         </td>
                         <td className="p-6">
                           <div className="text-[11px] font-black text-app-text-bright">
                             {sub.startedAt ? new Date(sub.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                           </div>
                         </td>
                         <td className="p-6 text-right">
                            <Link 
                              to={`/review/${sub.id}`}
                              className="inline-flex items-center gap-2 text-[10px] font-black text-app-accent hover:text-white transition-all uppercase tracking-widest group/btn"
                            >
                              Initialize Review 
                              <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessorDashboard;
