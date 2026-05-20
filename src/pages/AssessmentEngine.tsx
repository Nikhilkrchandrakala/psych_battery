import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Timer, AlertTriangle, Play, BookOpen, Clock, Zap, ChevronLeft, ChevronRight, Pause, Type } from 'lucide-react';
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
  
  const [isPaused, setIsPaused] = useState(false);
  const lastSlideIndexRef = useRef<number>(-1);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState<number>(1.0);

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
      
      if (lastSlideIndexRef.current !== currentSlideIndex) {
        setTimeLeft(slide.displayTime);
        lastSlideIndexRef.current = currentSlideIndex;
      }

      if (timerRef.current) clearInterval(timerRef.current);
      
      if (!isPaused) {
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
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, currentSlideIndex, isPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStarted || isCompleted) return;

      if (e.key === 'ArrowRight') {
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        handlePrevSlide();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStarted, isCompleted, slides.length, isPaused]);

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

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => {
      if (prev - 1 < 0) {
        return prev;
      }
      return prev - 1;
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 space-y-10 sm:space-y-16 pb-20 pt-6 sm:pt-10 animate-fade-in">
        <div className="space-y-4 sm:space-y-6">
          <button 
            onClick={() => navigate('/')}
            className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
          >
            ← Cancel Session
          </button>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-app-text-bright leading-[0.9]">
            {assessment.title}
          </h1>
          <p className="text-lg sm:text-2xl text-app-text-muted font-serif italic leading-relaxed max-w-3xl">
            {assessment.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
            <div className="p-3 sm:p-4 bg-app-accent/10 rounded-2xl sm:rounded-3xl text-app-accent border border-app-accent/20">
              <Timer className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div className="space-y-2">
               <h3 className="text-lg sm:text-xl font-black text-app-text-bright tracking-tight">TIMED CADENCE</h3>
               <p className="text-xs sm:text-sm text-app-text-muted leading-relaxed">Each probe appears for a fixed duration. There is no manual override.</p>
            </div>
          </div>
          <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
            <div className="p-3 sm:p-4 bg-amber-500/10 rounded-2xl sm:rounded-3xl text-amber-500 border border-amber-500/20">
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
             <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-app-text-bright tracking-tight">TEMPORAL LOCK</h3>
              <p className="text-xs sm:text-sm text-app-text-muted leading-relaxed">The session is persistent. Navigation away will be flagged for review.</p>
            </div>
          </div>
          <div className="bg-app-sidebar p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] border border-app-border shadow-2xl flex flex-col items-center text-center space-y-4 sm:space-y-6">
            <div className="p-3 sm:p-4 bg-amber-500/10 rounded-2xl sm:rounded-3xl text-amber-500 border border-amber-500/20">
              <Maximize className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
             <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-app-text-bright tracking-tight">TOTAL FOCUS</h3>
              <p className="text-xs sm:text-sm text-app-text-muted leading-relaxed">Fullscreen execution is mandatory to ensure environmental consistency.</p>
            </div>
          </div>
        </div>

        <div className="bg-app-accent text-white rounded-[1.5rem] sm:rounded-[3.5rem] p-6 sm:p-12 md:p-20 relative overflow-hidden shadow-[0_30px_100px_rgba(99,101,241,0.15)]">
          <div className="relative z-10 grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="space-y-4 sm:space-y-8">
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-none italic">Final Protocol Check</h2>
              <div className="space-y-2 sm:space-y-4 text-white/80 font-medium text-sm sm:text-base">
                <p>• Have your answer sheets and dark pen ready.</p>
                <p>• Ensure adequate lighting for writing.</p>
                <p>• Silence all notifications and distractions.</p>
              </div>
            </div>
            <button
              onClick={startAssessment}
              className="w-full h-16 sm:h-24 flex items-center justify-center gap-3 sm:gap-4 bg-white text-app-accent rounded-2xl sm:rounded-3xl font-black text-lg sm:text-2xl hover:scale-[1.02] transition-all active:scale-95 group shadow-2xl shadow-white/10"
            >
              <Play className="fill-current w-5 h-5 sm:w-7 sm:h-7" />
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
        "fixed inset-0 z-[100] flex flex-col bg-app-bg overflow-hidden font-sans select-none",
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
        "px-4 md:px-10 h-16 md:h-24 flex justify-between items-center border-b border-app-border bg-app-header relative shrink-0",
        currentSlide?.slideType === 'BLACKOUT' && "bg-black border-transparent text-zinc-900"
      )}>
        <div className="flex items-center gap-4 md:gap-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-40">Section</span>
              <span className="text-app-text-bright font-black text-[10px] md:text-xs">PSYCH TEST</span>
            </div>
            <div className="h-4 w-px bg-app-border/30" />
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-40">Stimulus</span>
              <span className="text-app-text-bright font-black text-[10px] md:text-xs">{currentSlideIndex + 1} of {slides.length}</span>
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

        <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <h2 className="font-extrabold text-app-text-bright tracking-tight opacity-90 text-xs md:text-sm uppercase">
            {assessment.title}
          </h2>
          <span className="text-[8px] font-black text-app-accent uppercase tracking-widest mt-0.5">Live Assessment Mode</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-app-card px-3 py-1.5 md:px-5 md:py-2 rounded-xl border border-app-border flex items-center gap-2 md:gap-3 shadow-inner">
             <Clock className="text-app-accent animate-pulse w-3 h-3 md:w-4 md:h-4" />
             <span className="text-sm md:text-xl font-black text-app-text-bright font-mono tabular-nums leading-none">
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Slide Content Area */}
      <div className="flex-grow flex items-center justify-center relative px-4 py-4 md:px-12 md:py-8 lg:px-20 lg:py-10">
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
                <div className="relative w-full h-full max-h-[calc(100vh-14rem)] flex items-center justify-center">
                  <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[200px]" />
                  <img 
                    src={currentSlide.imageUrl} 
                    alt="Evaluation Stimulus" 
                    className="max-w-full max-h-full object-contain rounded-[1.5rem] md:rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-app-border relative z-10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 bg-black/80 backdrop-blur px-3 py-1.5 md:px-5 md:py-3 rounded-xl md:rounded-2xl text-lg md:text-3xl font-black text-white border border-white/10 z-20 shadow-2xl">
                    {currentSlide.order}
                  </div>
                </div>
              )}

              {currentSlide.slideType === 'WORD' && currentSlide.content && (
                <div className="relative max-w-full px-4">
                  <div className="absolute inset-0 bg-app-accent/10 rounded-full blur-[150px]" />
                  <h3 
                    style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(2rem, 15vw, 10rem))` }}
                    className="font-black tracking-tighter text-app-text-bright leading-none relative z-10 text-center font-sans break-words max-w-full"
                  >
                    {currentSlide.content}
                  </h3>
                </div>
              )}

              {currentSlide.slideType === 'SITUATION' && currentSlide.content && (
                <div className="w-full max-w-4xl px-4 text-center relative flex flex-col items-center justify-center">
                   <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[150px] pointer-events-none" />
                   <div className="w-full p-6 sm:p-10 bg-app-sidebar/50 backdrop-blur rounded-[1.5rem] sm:rounded-[3rem] border border-app-border shadow-2xl relative z-10 max-h-[calc(100vh-13rem)] overflow-y-auto custom-scrollbar">
                      <h3 
                        style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(1.25rem, 3.5vw, 2.5rem))`, lineHeight: '1.4' }}
                        className="font-sans italic text-app-text-bright tracking-tight whitespace-pre-wrap break-words"
                      >
                        "{currentSlide.content}"
                      </h3>
                   </div>
                   <div className="text-[4rem] sm:text-[8rem] md:text-[12rem] font-black text-white/5 uppercase italic absolute -bottom-8 sm:-bottom-20 left-1/2 -translate-x-1/2 select-none pointer-events-none">
                      REACT
                   </div>
                </div>
              )}

              {currentSlide.slideType === 'BREAK' && (
                <div className="text-center space-y-6 sm:space-y-10 group px-4 max-w-full">
                   <div className="w-20 h-20 sm:w-32 sm:h-32 bg-app-card rounded-full flex items-center justify-center mx-auto border border-app-border group-hover:scale-110 transition-transform duration-700 shadow-2xl">
                    <Clock className="text-app-text-muted w-10 h-10 sm:w-16 sm:h-16" />
                  </div>
                  <h3 
                    style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(2rem, 8vw, 5rem))` }}
                    className="font-black text-app-text-bright uppercase tracking-tighter italic font-sans"
                  >
                    BREAK
                  </h3>
                  <p 
                    style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(1rem, 2.5vw, 1.5rem))` }}
                    className="text-app-text-muted font-sans italic max-w-md mx-auto"
                  >
                    Protocol cooling. Deep breaths encouraged.
                  </p>
                </div>
              )}

              {currentSlide.slideType === 'INSTRUCTIONS' && (
                <div className="bg-app-sidebar p-6 sm:p-10 md:p-14 rounded-[1.5rem] sm:rounded-[3rem] border border-app-border shadow-2xl w-full max-w-4xl text-left space-y-6 sm:space-y-8 relative overflow-hidden max-h-[calc(100vh-13rem)] flex flex-col justify-between">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-app-accent/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                   
                   <div className="space-y-6 overflow-y-auto custom-scrollbar flex-grow pr-2">
                     <h3 
                       style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(1.5rem, 4vw, 2.5rem))` }}
                       className="font-black text-app-text-bright tracking-tight flex items-center gap-3 sm:gap-6 italic font-sans"
                     >
                      <BookOpen className="text-app-accent w-8 h-8 sm:w-12 sm:h-12 shrink-0" />
                      Instructions
                     </h3>
                     <div 
                       style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(0.95rem, 2.5vw, 1.5rem))`, lineHeight: '1.5' }}
                       className="text-app-text-main font-sans italic whitespace-pre-wrap break-words"
                     >
                       {currentSlide.content || "Please adhere to the protocols established in the previous section."}
                     </div>
                   </div>
                   
                   <div className="pt-4 sm:pt-6 border-t border-app-border flex items-center gap-4 text-xs font-black text-app-accent uppercase tracking-[0.3em] shrink-0 bg-app-sidebar/80 backdrop-blur z-10">
                     <Zap size={16} className="fill-current animate-pulse" />
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

      {/* Floating Presenter Controls */}
      {isStarted && (
        <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 md:gap-6 bg-app-card/85 backdrop-blur-md px-4 md:px-8 py-2 md:py-3.5 rounded-full border border-app-border shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-opacity duration-300 hover:opacity-100 opacity-60 max-w-[95vw] md:max-w-none">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={handlePrevSlide}
              disabled={currentSlideIndex <= 0}
              className="p-1.5 md:p-2 text-app-text-muted hover:text-app-text-bright disabled:opacity-30 disabled:pointer-events-none hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Previous Slide (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-2 md:p-3 bg-app-accent/15 border border-app-accent/20 rounded-full text-app-accent hover:bg-app-accent/35 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={isPaused ? "Play Timer (Spacebar)" : "Pause Timer (Spacebar)"}
            >
              {isPaused ? <Play size={16} className="fill-current md:w-5 md:h-5" /> : <Pause size={16} className="fill-current md:w-5 md:h-5" />}
            </button>

            <button
              onClick={handleNextSlide}
              className="p-1.5 md:p-2 text-app-text-muted hover:text-app-text-bright hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Next Slide (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          <div className="h-5 md:h-6 w-px bg-app-border/40" />

          {/* Font Scaling Slider */}
          <div className="flex items-center gap-1.5 md:gap-3 select-none">
            <Type className="text-app-text-muted shrink-0 w-3.5 h-3.5 md:w-4 md:h-4" />
            <input 
              type="range"
              min="0.6"
              max="1.8"
              step="0.05"
              value={fontSizeMultiplier}
              onChange={(e) => setFontSizeMultiplier(Number(e.target.value))}
              className="w-16 md:w-24 h-1 bg-app-card border border-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
              title="Adjust Font Size"
            />
            <span className="text-[9px] md:text-[10px] font-black font-mono text-app-accent w-6 md:w-8 shrink-0">
              {Math.round(fontSizeMultiplier * 100)}%
            </span>
          </div>

          <div className="h-5 md:h-6 w-px bg-app-border/40" />

          <div className="flex items-center gap-1.5 md:gap-2 select-none px-1 md:px-2">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-app-accent animate-pulse shrink-0" />
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] text-app-text-muted hidden sm:inline-block">
              Presentation
            </span>
          </div>
        </div>
      )}

      {/* Progress Monitor */}
      <div className="h-2 w-full bg-app-card relative shrink-0">
        <div 
          className="h-full bg-app-accent shadow-[0_0_20px_#C5A028] transition-all duration-1000 ease-linear"
          style={{ width: `${(timeLeft / (currentSlide?.displayTime || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default AssessmentEngine;

