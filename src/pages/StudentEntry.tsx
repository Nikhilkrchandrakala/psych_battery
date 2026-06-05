import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Play, Timer, BookOpen, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

const StudentEntry: React.FC = () => {
  const { user, profile, mainSiteUrl } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assessmentState, setAssessmentState] = useState<'NOT_STARTED' | 'IN_PROGRESS' | null>(null);
  const [primaryAssessment, setPrimaryAssessment] = useState<Assessment | null>(null);
  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    const determineRoute = async () => {
      if (!user) return;
      try {
        const [assessmentsList, submissionsList] = await Promise.all([
          api.assessments.list(),
          api.submissions.list()
        ]);
        
        const activeAssessments = assessmentsList.filter((a: Assessment) => a.active);
        
        if (activeAssessments.length === 0) {
          // If no active assessments, bounce back to profile
          window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`;
          return;
        }

        const primary = activeAssessments[0];
        setPrimaryAssessment(primary);
        
        // Calculate approx time (duration is stored in the assessment object, or derived)
        // Duration is in minutes (e.g. 60)
        setTotalTime(primary.duration ? primary.duration * 60 : 3600);

        const submission = submissionsList.find((s: AssessmentSubmission) => 
          typeof s.assessmentId === 'object' 
            ? s.assessmentId._id === primary.id || s.assessmentId._id === primary._id
            : s.assessmentId === primary.id || s.assessmentId === primary._id
        );

        if (!submission) {
          // Candidate hasn't started yet.
          setAssessmentState('NOT_STARTED');
        } else if (
          submission.status === 'PENDING_UPLOAD' || 
          submission.status === 'COMPLETED' || 
          submission.status === 'UPLOADED' || 
          submission.status === 'REPORT_RELEASED' || 
          submission.status === 'MEETING_SCHEDULED'
        ) {
          window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`;
        } else {
          // IN_PROGRESS or ASSIGNED
          setAssessmentState('IN_PROGRESS');
        }

      } catch (error) {
        console.error('Failed to fetch evaluation data:', error);
        window.location.href = `${mainSiteUrl}/ProfileDashboard`;
      } finally {
        setLoading(false);
      }
    };

    determineRoute();
  }, [user, mainSiteUrl]);

  const handleStart = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }
    navigate(`/assessment/${primaryAssessment?._id || primaryAssessment?.id}?autoStart=true`);
  };

  const getWelcomeName = () => {
    const rawName = profile?.name || user?.name || user?.email || 'Candidate';
    if (rawName.includes('@')) {
      return rawName.split('@')[0];
    }
    return rawName.split(' ')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text-main">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  if (!primaryAssessment) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 space-y-10 sm:space-y-16 pb-20 pt-6 sm:pt-10 animate-fade-in">
      <div className="space-y-4 sm:space-y-6">
        <button 
          onClick={() => window.location.href = `${mainSiteUrl}/ProfileDashboard`}
          className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
        >
          ← Back to Profile
        </button>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-app-text-bright leading-[0.9]">
          Welcome, {getWelcomeName()}
        </h1>
        <p className="text-lg sm:text-2xl text-app-text-muted font-serif italic leading-relaxed max-w-3xl">
          {primaryAssessment.description || 'This assessment will evaluate various cognitive and psychological traits.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            <Timer className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-black text-app-text-muted uppercase tracking-widest mb-1 md:mb-2">Total Duration</h3>
            <p className="text-3xl md:text-5xl font-black text-app-text-bright">{Math.round(totalTime / 60)}<span className="text-lg md:text-2xl text-app-text-muted ml-2">min</span></p>
          </div>
        </div>

        <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
            <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-purple-500" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-black text-app-text-muted uppercase tracking-widest mb-1 md:mb-2">Format</h3>
            <p className="text-xl md:text-2xl font-black text-app-text-bright uppercase tracking-widest">Multiple<br />Modules</p>
          </div>
        </div>

        <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors duration-500"></div>
          <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-red-400 relative z-10" />
          <div className="relative z-10">
            <h3 className="text-xs md:text-sm font-black text-app-text-muted uppercase tracking-widest mb-2">Instructions</h3>
            <ul className="text-sm md:text-base text-app-text-muted space-y-1 font-medium">
              <li>Do not refresh the page</li>
              <li>Ensure stable connection</li>
              <li>Test is strictly timed</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pt-8 sm:pt-12">
        <button 
          onClick={handleStart}
          className="w-full py-6 md:py-8 px-6 bg-app-accent hover:bg-app-accent/90 text-white rounded-[1.5rem] md:rounded-[2rem] font-black text-xl md:text-3xl uppercase tracking-widest transition-all shadow-xl shadow-app-accent/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-4 border border-white/10"
        >
          <Play className="fill-current w-8 h-8 md:w-10 md:h-10" />
          {assessmentState === 'IN_PROGRESS' ? 'Resume Test' : 'Commence Test'}
        </button>
      </div>
    </div>
  );
};

export default StudentEntry;
