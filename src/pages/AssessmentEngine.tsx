import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Timer, AlertTriangle, Play, BookOpen, Clock, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

const AssessmentEngine: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [slides, setSlides] = useState<AssessmentSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!id) return;
      try {
        const assessmentData = await api.assessments.get(id);
        setAssessment(assessmentData);
        
        const slidesList = await api.assessments.slides(id);
        setSlides(slidesList);
      } catch (error) {
        console.error('Failed to fetch assessment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [id]);

  useEffect(() => {
    if (isStarted && currentSlideIndex >= 0 && currentSlideIndex < slides.length) {
      const slide = slides[currentSlideIndex];
      setTimeLeft(slide.displayTime);

      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleNextSlide();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, currentSlideIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  const startAssessment = async () => {
    if (!user || !assessment) return;
    
    try {
      const submissionData = {
        assessmentId: assessment.id,
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
        assessorId: profile?.assignedAssessor || undefined,
        ...(profile?.assignedAssessor ? { status: 'ASSIGNED' as const } : {})
      };
      
      const created = await api.submissions.create(submissionData);
      setSubmissionId(created.id);
      
      setIsStarted(true);
      setCurrentSlideIndex(0);
      toggleFullscreen();
    } catch (error) {
      console.error('Failed to create submission:', error);
    }
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => {
      if (prev + 1 >= slides.length) {
        completeAssessment();
        return prev;
      }
      return prev + 1;
    });
  };

  const completeAssessment = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsCompleted(true);
    setIsStarted(false);
    
    if (submissionId) {
      try {
        await api.submissions.update(submissionId, {
          status: 'PENDING_UPLOAD',
          completedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to complete submission:', error);
      }
    }

    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    setTimeout(() => {
      navigate(`/upload/${submissionId}`);
    }, 2500);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!assessment) return <div className="text-app-text-bright p-12 text-center">Assessment records not found.</div>;

  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-8">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-green-500/10 rounded-full text-green-500 mb-4 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]"
        >
          <Zap size={48} className="fill-current" />
        </motion.div>
        <h1 className="text-5xl font-black text-app-text-bright tracking-tight">Test Terminated</h1>
        <p className="text-xl text-app-text-muted font-serif italic">The battery is complete. Initializing secure upload portal...</p>
      </div>
    );
  }

  if (!isStarted && currentSlideIndex === -1) {
    return (
      <div className="max-w-5xl mx-auto space-y-16 pb-20">
        <div className="space-y-6">
          <button 
            onClick={() => navigate('/')}
            className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
          >
            ← Cancel Session
          </button>
          <h1 className="text-7xl font-black tracking-tighter text-app-text-bright leading-[0.9]">
            {assessment.title}
          </h1>
          <p className="text-2xl text-app-text-muted font-serif italic leading-relaxed max-w-3xl">
            {assessment.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-app-sidebar p-10 rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-app-accent/10 rounded-3xl text-app-accent border border-app-accent/20">
              <Timer size={40} />
            </div>
            <div className="space-y-2">
               <h3 className="text-xl font-black text-app-text-bright tracking-tight">TIMED CADENCE</h3>
               <p className="text-sm text-app-text-muted leading-relaxed">Each probe appears for a fixed duration. There is no manual override.</p>
            </div>
          </div>
          <div className="bg-app-sidebar p-10 rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-amber-500/10 rounded-3xl text-amber-500 border border-amber-500/20">
              <AlertTriangle size={40} />
            </div>
             <div className="space-y-2">
              <h3 className="text-xl font-black text-app-text-bright tracking-tight">TEMPORAL LOCK</h3>
              <p className="text-sm text-app-text-muted leading-relaxed">The session is persistent. Navigation away will be flagged for review.</p>
            </div>
          </div>
          <div className="bg-app-sidebar p-10 rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-amber-500/10 rounded-3xl text-amber-500 border border-amber-500/20">
              <Maximize size={40} />
            </div>
             <div className="space-y-2">
              <h3 className="text-xl font-black text-app-text-bright tracking-tight">TOTAL FOCUS</h3>
              <p className="text-sm text-app-text-muted leading-relaxed">Fullscreen execution is mandatory to ensure environmental consistency.</p>
            </div>
          </div>
        </div>

        <div className="bg-app-accent text-white rounded-[3.5rem] p-12 md:p-20 relative overflow-hidden shadow-[0_30px_100px_rgba(99,101,241,0.15)]">
          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-black tracking-tight leading-none italic">Final Protocol Check</h2>
              <div className="space-y-4 text-white/80 font-medium">
                <p>• Have your answer sheets and dark pen ready.</p>
                <p>• Ensure adequate lighting for writing.</p>
                <p>• Silence all notifications and distractions.</p>
              </div>
            </div>
            <button
              onClick={startAssessment}
              className="w-full h-24 flex items-center justify-center gap-4 bg-white text-app-accent rounded-3xl font-black text-2xl hover:scale-[1.02] transition-all active:scale-95 group shadow-2xl shadow-white/10"
            >
              <Play size={28} className="fill-current" />
              COMMENCE TEST
            </button>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-[80px]" />
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-app-bg overflow-hidden font-sans",
        currentSlide?.slideType === 'BLACKOUT' && "bg-black"
      )}
    >
      {/* Overall Progression Bar */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5 z-[110]">
        <motion.div 
          className="h-full bg-app-accent shadow-[0_0_15px_#C5A028]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Header Info */}
      <div className={cn(
        "px-10 h-24 flex justify-between items-center border-b border-app-border bg-app-header relative",
        currentSlide?.slideType === 'BLACKOUT' && "bg-black border-transparent text-zinc-900"
      )}>
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Section</span>
              <span className="text-app-text-bright font-black text-xs">PSYCH TEST</span>
            </div>
            <div className="h-4 w-px bg-app-border/30" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Stimulus</span>
              <span className="text-app-text-bright font-black text-xs">{currentSlideIndex + 1} of {slides.length}</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 pl-8 border-l border-app-border/20">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Presented</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                <span className="text-app-text-bright font-black text-xs">{currentSlideIndex + 1}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40">Remaining</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                <span className="text-app-text-bright font-black text-xs">{slides.length - (currentSlideIndex + 1)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <h2 className="font-extrabold text-app-text-bright tracking-tight opacity-90 text-sm uppercase">
            {assessment.title}
          </h2>
          <span className="text-[8px] font-black text-app-accent uppercase tracking-widest mt-0.5">Live Assessment Mode</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-app-card px-5 py-2 rounded-xl border border-app-border flex items-center gap-3 shadow-inner">
             <Clock size={14} className="text-app-accent animate-pulse" />
             <span className="text-xl font-black text-app-text-bright font-mono tabular-nums leading-none">
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Slide Content Area */}
      <div className="flex-grow flex items-center justify-center relative px-20 py-10">
        <AnimatePresence mode="wait">
          {currentSlide && (
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-6xl h-full flex flex-col items-center justify-center"
            >
              {currentSlide.slideType === 'IMAGE' && currentSlide.imageUrl && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[200px]" />
                  <img 
                    src={currentSlide.imageUrl} 
                    alt="Evaluation Stimulus" 
                    className="max-w-full max-h-full object-contain rounded-[2rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] border border-app-border relative z-10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-10 left-10 bg-black/80 backdrop-blur px-5 py-3 rounded-2xl text-3xl font-black text-white border border-white/10 z-20 shadow-2xl">
                    {currentSlide.order}
                  </div>
                </div>
              )}

              {currentSlide.slideType === 'WORD' && currentSlide.content && (
                <div className="relative">
                  <div className="absolute inset-0 bg-app-accent/10 rounded-full blur-[150px]" />
                  <h3 className="text-[15rem] md:text-[22rem] font-black tracking-tighter text-app-text-bright leading-none relative z-10">
                    {currentSlide.content}
                  </h3>
                </div>
              )}

              {currentSlide.slideType === 'SITUATION' && currentSlide.content && (
                <div className="max-w-4xl space-y-12 text-center relative">
                   <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[150px]" />
                   <div className="p-10 bg-app-sidebar/50 backdrop-blur rounded-[3rem] border border-app-border shadow-2xl relative z-10">
                      <h3 className="text-4xl md:text-5xl font-serif italic text-app-text-bright leading-tight tracking-tight">
                        "{currentSlide.content}"
                      </h3>
                   </div>
                   <div className="text-[12rem] font-black text-white/5 uppercase italic absolute -bottom-20 left-1/2 -translate-x-1/2 select-none pointer-events-none">
                      REACT
                   </div>
                </div>
              )}

              {currentSlide.slideType === 'BREAK' && (
                <div className="text-center space-y-10 group">
                   <div className="w-32 h-32 bg-app-card rounded-full flex items-center justify-center mx-auto border border-app-border group-hover:scale-110 transition-transform duration-700 shadow-2xl">
                    <Clock size={64} className="text-app-text-muted" />
                  </div>
                  <h3 className="text-8xl font-black text-app-text-bright uppercase tracking-tighter italic">BREAK</h3>
                  <p className="text-2xl text-app-text-muted font-serif italic">Protocol cooling. Deep breaths encouraged.</p>
                </div>
              )}

              {currentSlide.slideType === 'INSTRUCTIONS' && (
                <div className="bg-app-sidebar p-20 rounded-[4rem] border border-app-border shadow-2xl w-full max-w-4xl text-left space-y-10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-app-accent/5 rounded-full blur-3xl -mr-32 -mt-32" />
                   <h3 className="text-5xl font-black text-app-text-bright tracking-tight flex items-center gap-6 italic">
                    <BookOpen size={48} className="text-app-accent" />
                    Instructions
                  </h3>
                  <div className="text-3xl text-app-text-main leading-relaxed font-serif italic whitespace-pre-wrap">
                    {currentSlide.content || "Please adhere to the protocols established in the previous section."}
                  </div>
                  <div className="pt-10 border-t border-app-border flex items-center gap-4 text-xs font-black text-app-accent uppercase tracking-[0.3em]">
                    <Zap size={18} className="fill-current" />
                    Next Protocol in {timeLeft}s
                  </div>
                </div>
              )}

              {currentSlide.slideType === 'BLACKOUT' && (
                <div className="text-white/5 text-[15vw] font-black italic select-none pointer-events-none uppercase tracking-tighter animate-pulse">
                  WRITE
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress Monitor */}
      <div className="h-2 w-full bg-app-card relative">
        <motion.div 
          className="h-full bg-app-accent shadow-[0_0_20px_#C5A028]"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          key={`${currentSlideIndex}-timer`}
          transition={{ duration: timeLeft, ease: 'linear' }}
        />
      </div>
    </div>
  );
};

export default AssessmentEngine;
