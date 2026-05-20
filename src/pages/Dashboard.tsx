import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Clock, CheckCircle2, BookOpen, Layers, ArrowRight, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [assessmentsList, submissionsList] = await Promise.all([
          api.assessments.list(),
          api.submissions.list()
        ]);
        
        setAssessments(assessmentsList.filter((a: Assessment) => a.active));
        setSubmissions(submissionsList);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  const getSubmissionForAssessment = (assessmentId: string) => {
    return submissions.find(s => s.assessmentId === assessmentId);
  };

  const getWelcomeName = () => {
    const rawName = profile?.name || user?.name || user?.email || 'User';
    if (rawName.includes('@')) {
      return rawName.split('@')[0];
    }
    return rawName.split(' ')[0];
  };

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <section>
        <div className="flex items-end gap-2 mb-2">
           <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">
            Welcome, {getWelcomeName()}
          </h1>
          <span className="w-3 h-3 bg-app-accent rounded-full mb-3 shadow-[0_0_10px_#C5A028]"></span>
        </div>
        <p className="text-xl text-app-text-muted font-serif italic max-w-2xl leading-relaxed">
          "Spontaneity and consistency define your natural self. Your personality is a journey of discovery."
        </p>
      </section>

      {/* Stats/Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-sm">
          <div className="text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2">Active Tests</div>
          <div className="text-3xl font-black text-app-text-bright">{assessments.length}</div>
        </div>
        <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-sm">
          <div className="text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2">My Submissions</div>
          <div className="text-3xl font-black text-app-text-bright">{submissions.length}</div>
        </div>
        <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-sm">
          <div className="text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2">Evaluations</div>
          <div className="text-3xl font-black text-app-text-bright">{submissions.filter(s => s.status === 'COMPLETED').length}</div>
        </div>
      </div>

      {/* PIQ Download Section */}
      <section className="bg-gradient-to-br from-app-accent/10 to-transparent border border-app-accent/30 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-app-accent/5">
        <div className="flex items-center gap-6">
          <div className="bg-app-card p-4 rounded-2xl border border-app-accent/20">
            <FileText className="text-app-accent" size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-app-text-bright">Essential: Download PIQ Form</h3>
            <p className="text-xs text-app-text-muted font-medium max-w-sm">
              The Personal Information Questionnaire must be filled manually and uploaded with your assessment. 
              <span className="text-app-accent"> Download it now to prepare.</span>
            </p>
          </div>
        </div>
        <a 
          href="https://www.ssbcrack.com/wp-content/uploads/2013/11/PIQ-form-SSB.pdf" 
          target="_blank"
          rel="noopener noreferrer"
          className="bg-app-card border border-app-accent/50 text-app-accent px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-app-accent hover:text-white transition-all shadow-lg active:scale-95 whitespace-nowrap shadow-app-accent/10"
        >
          Download PDF Template
        </a>
      </section>

      {/* Assessment List */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-app-border pb-4">
          <h2 className="text-2xl font-bold text-app-text-bright flex items-center gap-3">
            <Layers className="text-app-accent" size={24} />
            Available Assessments
          </h2>
        </div>

        {assessments.length === 0 ? (
          <div className="bg-app-sidebar rounded-[2rem] p-16 text-center border border-app-border border-dashed shadow-inner">
            <BookOpen size={48} className="mx-auto text-app-border mb-6" />
            <p className="text-app-text-muted text-lg font-medium">No active assessments available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {assessments.map(assessment => {
              const submission = getSubmissionForAssessment(assessment.id);
              const isStarted = !!submission;
              const isCompleted = submission?.status === 'COMPLETED';

              return (
                <div key={assessment.id} className="bg-app-sidebar rounded-[2rem] p-8 border border-app-border flex flex-col hover:border-app-accent/50 transition-all group relative overflow-hidden">
                  {/* Subtle background glow on hover */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-app-accent/10 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="bg-app-card p-3 rounded-2xl border border-app-border group-hover:scale-110 transition-transform shadow-inner">
                      <Clock size={28} className="text-app-accent" />
                    </div>
                    
                    {isStarted ? (
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                        submission.status === 'COMPLETED' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        submission.status === 'UPLOADED' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {submission.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-app-accent/20">
                        New Battery
                      </span>
                    )}
                  </div>

                  <div className="relative z-10 space-y-3">
                    <h3 className="text-2xl font-black text-app-text-bright tracking-tight ">{assessment.title}</h3>
                    <p className="text-app-text-muted text-sm leading-relaxed max-w-md">
                      {assessment.description || 'Comprehensive timed psychological evaluation including TAT, WAT, and SRT modules.'}
                    </p>
                  </div>

                  <div className="mt-10 pt-8 border-t border-app-border flex items-center justify-between relative z-10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-app-text-bright">{assessment.duration}</span>
                      <span className="text-[10px] uppercase font-black text-app-text-muted tracking-widest">MINS</span>
                    </div>
                    
                    <Link
                      to={isCompleted ? `/assessment/results/${submission?.id}` : 
                          submission?.status === 'PENDING_UPLOAD' ? `/upload/${submission.id}` : 
                          `/assessment/${assessment.id}`}
                      className={cn(
                        "flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95",
                        isCompleted 
                          ? "bg-app-card text-app-text-bright hover:bg-white/5 border border-app-border" 
                          : "bg-app-accent text-white hover:bg-amber-600 shadow-app-accent/20"
                      )}
                    >
                      {isCompleted ? 'View Full Report' : 
                       submission?.status === 'PENDING_UPLOAD' ? 'Upload Files' : 
                       'Begin Session'}
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      
      {/* Refined Info Section */}
      <section className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
          <div className="max-w-xl space-y-6">
            <h2 className="text-4xl font-black tracking-tight text-app-text-bright">Conduct Review</h2>
            <p className="text-app-text-main text-lg font-serif italic">
              All psychological evaluations at SSB Academy follow strict temporal protocols. Ensure you are mentally prepared before starting.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-3">
                <CheckCircle2 className="text-app-accent shrink-0" size={20} />
                <span className="text-sm font-medium text-app-text-muted italic">Handwritten answers only</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="text-app-accent shrink-0" size={20} />
                <span className="text-sm font-medium text-app-text-muted italic">Timed automatic slides</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="text-app-accent shrink-0" size={20} />
                <span className="text-sm font-medium text-app-text-muted italic">Manual assessor review</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="text-app-accent shrink-0" size={20} />
                <span className="text-sm font-medium text-app-text-muted italic">Digital submission archive</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 w-48 h-48 bg-app-card rounded-[3rem] border border-app-border flex items-center justify-center rotate-12 group hover:rotate-0 transition-transform duration-500 shadow-2xl">
            <ShieldCheck size={80} className="text-app-accent/20 group-hover:text-app-accent transition-colors" />
          </div>
        </div>
        
        {/* Background glow highlights */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-app-accent/5 rounded-full blur-[100px]" />
      </section>
    </div>
  );
};

// Internal icon for the info section
const ShieldCheck = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default Dashboard;
