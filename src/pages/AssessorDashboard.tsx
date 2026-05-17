import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Users, Search, Filter, Calendar, ExternalLink, Shield, ArrowRight, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const AssessorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<(AssessmentSubmission & { student?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const subData = await api.submissions.list();
        setSubmissions(subData);
      } catch (error) {
        console.error('Failed to fetch assessor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex items-end gap-3 mb-2">
          <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">Assessor Terminal</h1>
          <span className="w-3 h-3 bg-app-accent rounded-full mb-3 shadow-[0_0_10px_#C5A028]"></span>
        </div>
        <p className="text-app-text-muted text-xl font-serif italic max-w-2xl leading-relaxed">
          Monitor candidate progress, review psychological dossiers, and conduct professional evaluations.
        </p>
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
               <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.2em] border-b border-app-border pb-3">
                Quick Actions
               </h3>
               <div className="space-y-2">
                 <button className="w-full flex items-center justify-between p-3 rounded-xl bg-app-card border border-app-border text-xs font-bold text-app-text-bright hover:bg-white/5 transition-all">
                   Manage Schedule <Calendar size={14} className="text-app-accent" />
                 </button>
                 <button className="w-full flex items-center justify-between p-3 rounded-xl bg-app-card border border-app-border text-xs font-bold text-app-text-bright hover:bg-white/5 transition-all">
                   Evaluation Templates <ExternalLink size={14} className="text-app-accent" />
                 </button>
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

       <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 space-y-6 max-w-xl mx-auto">
             <div className="w-16 h-16 bg-app-card rounded-3xl border border-app-border flex items-center justify-center mx-auto mb-6 text-app-accent shadow-inner">
               <Shield size={32} />
             </div>
             <h2 className="text-3xl font-black tracking-tight text-app-text-bright">Ethics & Integrity Protocols</h2>
             <p className="text-app-text-muted text-lg font-serif italic italic leading-relaxed">
               As an assessor, you hold clinical accountability for candidate evaluation. Ensure all remarks remain professional, objective, and evidence-based following SSA guidelines.
             </p>
          </div>
          <div className="absolute top-0 left-0 w-64 h-64 bg-app-accent/5 rounded-full blur-[100px] -ml-32 -mt-32" />
       </div>
    </div>
  );
};

export default AssessorDashboard;
