import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AssessmentSubmission, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Calendar, User as UserIcon, CheckCircle2, Video, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

const Meetings: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<(AssessmentSubmission & { student?: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssessorType, setActiveAssessorType] = useState<'Psych' | 'GTO' | 'TO' | 'IO'>('Psych');

  useEffect(() => {
    if (profile?.assessorType) {
      setActiveAssessorType(profile.assessorType);
    }
  }, [profile]);

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

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleMarkAsComplete = async (id: string) => {
    try {
      const prefix = activeAssessorType.toLowerCase();
      await api.submissions.update(id, {
        [`${prefix}MeetingCompleted`]: true
      });
      // Optimistic update
      setSubmissions(prev => prev.map(s => {
        if (s.id === id) {
          return { ...s, [`${prefix}MeetingCompleted`]: true } as any;
        }
        return s;
      }));
    } catch (error) {
      console.error('Failed to mark meeting complete:', error);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
    </div>
  );

  const prefix = activeAssessorType.toLowerCase();
  
  // Filter for meetings that exist for this assessor and aren't completed
  const myMeetings = submissions.filter(sub => {
    const s = sub as any;
    return s[`${prefix}MeetingDate`] && !s[`${prefix}MeetingCompleted`];
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-app-sidebar border border-app-border rounded-[2.5rem] p-8 shadow-xl">
        <div className="space-y-3">
          <div className="flex items-end gap-3 mb-1">
            <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">Scheduled Meetings</h1>
            <span className="w-3 h-3 bg-app-accent rounded-full mb-3 shadow-[0_0_10px_#C5A028]"></span>
          </div>
          <p className="text-app-text-muted text-base font-serif italic max-w-2xl leading-relaxed">
            Manage your upcoming feedback sessions and candidate interviews.
          </p>
        </div>
      </div>

      <div className="space-y-6 w-full">
        {myMeetings.length === 0 ? (
          <div className="bg-app-sidebar p-20 rounded-[2.5rem] border border-app-border border-dashed text-center">
            <div className="w-20 h-20 bg-app-card border border-app-border rounded-3xl flex items-center justify-center mx-auto mb-6 text-app-text-muted opacity-20">
              <Calendar size={40} />
            </div>
            <h3 className="text-xl font-bold text-app-text-bright mb-2">No Scheduled Meetings</h3>
            <p className="text-app-text-muted text-sm italic font-serif leading-relaxed">You have no pending meetings with candidates at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {myMeetings.map(sub => {
              const s = sub as any;
              const dateStr = s[`${prefix}MeetingDate`];
              const linkStr = s[`${prefix}MeetingLink`];
              const date = new Date(dateStr);
              
              return (
                <div key={sub.id} className="bg-app-sidebar border border-app-border rounded-3xl p-6 shadow-xl flex flex-col hover:border-app-accent/50 transition-colors">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0">
                      {sub.student?.profileImage ? (
                        <img src={sub.student.profileImage} alt={sub.student.name || 'Candidate'} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={24} className="text-app-text-muted" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-app-text-bright">{sub.student?.name || 'Unknown Candidate'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-1.5 py-0.5 rounded bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-bright">
                          B: {sub.student?.batch || '--'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-bright">
                          C: {sub.student?.chestNo || '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-app-card rounded-2xl p-4 border border-app-border space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-app-text-muted">
                      <Clock size={16} className="text-app-accent" />
                      <span className="text-xs font-bold text-app-text-bright">
                        {date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <a 
                      href={linkStr || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Video size={14} />
                      Join Link
                    </a>
                    <button 
                      onClick={() => handleMarkAsComplete(sub.id)}
                      className="flex items-center justify-center gap-2 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <CheckCircle2 size={14} />
                      Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Meetings;
