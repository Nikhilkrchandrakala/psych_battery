import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserProfile, Assessment, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { 
  Shield, Users, BookOpen, Layers, Plus, Search, 
  Settings, Trash2, Edit2, CheckCircle2, UserPlus,
  Loader2, AlertCircle, Database, LayoutGrid, ArrowRight, Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

const AdminDashboard: React.FC = () => {
  const { user, isAdminUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'assessments' | 'assignments'>('users');

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

  const updateUserRole = async (id: string, role: string) => {
    try {
      await api.users.update(id, { role });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: role as any } : u));
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const assignStudentToAssessor = async (userId: string, assessorId: string) => {
    try {
      await api.users.update(userId, { assignedAssessor: assessorId });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, assignedAssessor: assessorId } : u));
    } catch (error) {
      console.error('Failed to assign student to assessor:', error);
    }
  };

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

       {/* Tabs */}
       <div className="flex gap-2 bg-app-sidebar p-1 rounded-2xl border border-app-border w-fit shadow-2xl">
        {[
          { id: 'users', label: 'Identity Registry', icon: Users },
          { id: 'assessments', label: 'Protocol Catalog', icon: Layers },
          { id: 'assignments', label: 'Assessor Progress', icon: UserPlus }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
              activeTab === tab.id ? "bg-app-accent text-white shadow-xl" : "text-app-text-muted hover:text-app-text-bright hover:bg-white/5"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in duration-500">
           <div className="p-6 border-b border-app-border bg-black/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-grow max-w-md w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
                 <input 
                  type="text" 
                  placeholder="Query user database..." 
                  className="w-full bg-app-card border border-app-border rounded-xl py-2.5 pl-12 pr-4 text-xs font-medium focus:outline-none focus:border-app-accent transition-all text-app-text-bright"
                 />
              </div>
              <button className="px-4 py-2.5 bg-app-card border border-app-border rounded-xl text-xs font-black text-app-text-bright hover:bg-white/5 transition-all flex items-center gap-2">
                 <Plus size={16} /> Initialise Invited Student
              </button>
           </div>
           <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/10">
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Entity Profile</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Privilege Level</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Allocation</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-app-border hover:bg-white/5 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0">
                           {u.profileImage ? <img src={u.profileImage} alt={u.name} className="w-full h-full object-cover" /> : <Users size={20} className="text-app-text-muted" />}
                         </div>
                         <div>
                            <div className="text-sm font-black text-app-text-bright">{u.name}</div>
                            <div className="text-[10px] font-medium text-app-text-muted">{u.email}</div>
                         </div>
                      </div>
                    </td>
                    <td className="p-6">
                       <select 
                        value={u.role}
                        onChange={(e) => updateUserRole(u.id, e.target.value)}
                        className="bg-app-card border border-app-border rounded-lg px-3 py-1 text-[10px] font-black text-app-text-bright uppercase focus:outline-none focus:ring-1 focus:ring-app-accent cursor-pointer"
                       >
                         <option value="student">Student</option>
                         <option value="assessor">Assessor</option>
                         <option value="admin">Admin</option>
                       </select>
                    </td>
                    <td className="p-6">
                       {u.role === 'student' ? (
                          <select 
                            value={u.assignedAssessor || ''}
                            onChange={(e) => assignStudentToAssessor(u.id, e.target.value)}
                            className="bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-[9px] font-black text-app-accent uppercase focus:outline-none focus:ring-1 focus:ring-app-accent cursor-pointer w-full"
                          >
                            <option value="">No Assessor</option>
                            {users.filter(usr => usr.role === 'assessor' || usr.role === 'admin').map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                       ) : (
                          <div className="text-[9px] font-black text-app-text-muted uppercase tracking-widest text-center">N/A</div>
                       )}
                    </td>
                    <td className="p-6 text-right">
                       <button className="p-2 text-app-text-muted hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}

      {activeTab === 'assessments' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex justify-between items-center bg-app-sidebar border border-app-border p-4 px-8 rounded-3xl shadow-lg">
              <h3 className="text-sm font-black text-app-text-bright uppercase tracking-widest italic">Protocol Registry</h3>
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
                         <button className="p-2 text-app-text-muted hover:text-red-400 transition-colors" title="Delete Protocol"><Trash2 size={16} /></button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'assignments' && (
         <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in duration-500">
           <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/10">
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Candidate</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Submission Status</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">PIQ OCR</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border">Assigned Assessor</th>
                  <th className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-app-text-muted border-b border-app-border text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const piqStatus = (s as any).piqStatus || 'PENDING';
                  const piqStatusStyles: Record<string, string> = {
                    PENDING:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
                    PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    PARSED:     'bg-green-500/10 text-green-400 border-green-500/20',
                    FAILED:     'bg-red-500/10 text-red-400 border-red-500/20',
                  };
                  return (
                  <tr key={s.id} className="border-b border-app-border hover:bg-white/5 transition-colors group">
                    <td className="p-6">
                       <div className="text-sm font-black text-app-text-bright">
                        {users.find(u => u.uid === s.userId)?.name || users.find(u => u.id === s.userId)?.name || 'Unknown Candidate'}
                       </div>
                       <div className="text-[9px] font-black text-app-accent uppercase tracking-widest mt-1 opacity-60">
                        {assessments.find(a => a.id === s.assessmentId)?.title}
                       </div>
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{s.status.replace(/_/g, ' ')}</span>
                       </div>
                    </td>
                    <td className="p-6">
                       <span className={cn('px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-[0.15em]', piqStatusStyles[piqStatus] || piqStatusStyles['PENDING'])}>
                         {piqStatus}
                       </span>
                    </td>
                    <td className="p-6">
                       <select 
                        value={s.assessorId || ''}
                        onChange={(e) => assignAssessor(s.id!, e.target.value)}
                        className="bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-[10px] font-black text-app-text-bright uppercase focus:outline-none focus:ring-1 focus:ring-app-accent cursor-pointer w-full max-w-[200px]"
                       >
                         <option value="">Pending Assignment</option>
                         {users.filter(u => u.role === 'assessor' || u.role === 'admin').map(a => (
                           <option key={a.uid || a.id} value={a.uid || a.id}>{a.name}</option>
                         ))}
                       </select>
                    </td>
                    <td className="p-6 text-right">
                       <Link to={`/review/${s.id}`} className="p-2 text-app-text-muted hover:text-app-accent transition-colors" title="Open Dossier Viewer">
                          <ArrowRight size={18} />
                       </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
           </table>
         </div>
      )}
    </div>
  );
};

export default AdminDashboard;
