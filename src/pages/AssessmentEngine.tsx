import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, ModuleId, ModuleConfig } from '../types';
import { useAuth } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, Timer, AlertTriangle, Play, BookOpen, Clock, Zap, ChevronLeft, ChevronRight, Pause } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAssessmentData } from '../hooks/useAssessmentData';
import { SlideRenderer } from '../components/SlideRenderer';
import { Watermark } from '../components/Watermark';

const DEFAULT_MODULE_CONFIG: ModuleConfig = { timingMode: 'per-slide', globalDuration: 0, navigable: false };

const AssessmentEngine: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, mainSiteUrl } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewModule = searchParams.get('module');

  const { assessment, allSlides, loading, error, moduleSlideMap, activeModules } = useAssessmentData(id, previewModule);

  const [isStarted, setIsStarted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  
  // Module-aware tracking
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentSlideInModule, setCurrentSlideInModule] = useState(0);
  
  // Timers
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSlideKeyRef = useRef<string>('');
  const globalTimerInitializedRef = useRef<number>(-1);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (isStarted) {
      startedAtRef.current = Date.now();
    }
  }, [isStarted]);

  // Preload images in the background to ensure TAT images load instantly
  useEffect(() => {
    if (allSlides && allSlides.length > 0) {
      allSlides.forEach(slide => {
        if (slide.slideType === 'IMAGE' && slide.imageUrl) {
          const img = new Image();
          img.src = slide.imageUrl;
        }
      });
    }
  }, [allSlides]);

  const currentModule = activeModules[currentModuleIndex] || 'INTRO';
  const currentModuleSlides = moduleSlideMap[currentModule] || [];

  const isAdminPreview = profile?.role === 'admin' || profile?.role === 'assessor';
  const allowCandidateSkip = assessment?.allowCandidateSkip === true;

  const currentModuleConfig: ModuleConfig = useMemo(() => {
    const base = assessment?.modules?.[currentModule] || DEFAULT_MODULE_CONFIG;
    if (isAdminPreview || currentModule === 'SRT') {
      return { ...base, navigable: true };
    }
    return base;
  }, [assessment, currentModule, isAdminPreview]);
  
  const currentSlide = currentModuleSlides[currentSlideInModule];

  // Flattened total slide count and current global index (for progress bar)
  const totalSlides = allSlides.length;
  const globalSlideIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentModuleIndex; i++) {
      count += moduleSlideMap[activeModules[i]]?.length || 0;
    }
    return count + currentSlideInModule;
  }, [currentModuleIndex, currentSlideInModule, activeModules, moduleSlideMap]);

  const autoStart = searchParams.get('autoStart') === 'true';

  // Data fetch auto-start for admin and candidate
  useEffect(() => {
    if (!loading && assessment && user) {
      if (profile?.role === 'admin') {
        setIsStarted(true);
      } else if (autoStart && !isStarted) {
        startAssessment();
      }
    }
  }, [loading, assessment, user, profile, autoStart, isStarted]);

  // Advance to next module
  const advanceToNextModule = useCallback(() => {
    console.log('[ENGINE] advanceToNextModule called. currentModuleIndex:', currentModuleIndex, 'activeModules:', activeModules, 'next will be:', activeModules[currentModuleIndex + 1]);
    if (currentModuleIndex + 1 >= activeModules.length) {
      completeAssessment();
      return;
    }
    setCurrentModuleIndex(prev => {
      const next = prev + 1;
      console.log('[ENGINE] setCurrentModuleIndex:', prev, '->', next, '= module:', activeModules[next]);
      return next;
    });
    setCurrentSlideInModule(0);
  }, [currentModuleIndex, activeModules.length]);

  // Advance to next slide (or next module if at end of current module)
  const handleNextSlide = useCallback(() => {
    console.log('[ENGINE] handleNextSlide called. slideInModule:', currentSlideInModule, 'totalSlides:', currentModuleSlides.length, 'currentModule:', activeModules[currentModuleIndex]);
    if (currentSlideInModule + 1 >= currentModuleSlides.length) {
      if (activeModules[currentModuleIndex] === 'SRT' && !isAdminPreview) {
        // SRT candidate navigation is locked within this module until the global 30-min timer expires
        return;
      }
      advanceToNextModule();
      return;
    }
    setCurrentSlideInModule(prev => prev + 1);
  }, [currentSlideInModule, currentModuleSlides.length, advanceToNextModule, currentModuleIndex, activeModules, isAdminPreview]);

  // Go to previous slide
  const handlePrevSlide = useCallback(() => {
    if (currentModuleConfig.navigable && currentSlideInModule > 0) {
      setCurrentSlideInModule(prev => prev - 1);
    }
  }, [currentModuleConfig, currentSlideInModule]);

  // Timer logic — uses a ref to avoid calling side-effects inside React state updaters
  // (React 18 StrictMode double-invokes state updaters, which caused handleNextSlide
  //  to fire twice, skipping entire modules like TAT)
  const timeLeftRef = useRef(0);

  useEffect(() => {
    if (!isStarted || isCompleted || !currentSlide) return;

    const slideKey = `${currentModuleIndex}-${currentSlideInModule}`;

    if (currentModuleConfig.timingMode === 'per-slide') {
      if (lastSlideKeyRef.current !== slideKey) {
        const newTime = currentSlide.displayTime || 30;
        setTimeLeft(newTime);
        timeLeftRef.current = newTime;
        lastSlideKeyRef.current = slideKey;
      }

      if (timerRef.current) clearInterval(timerRef.current);

      if (!isPaused) {
        timerRef.current = setInterval(() => {
          timeLeftRef.current -= 1;
          const t = timeLeftRef.current;
          setTimeLeft(t);
          if (t <= 0) {
            console.log('[ENGINE] Per-slide timer expired, advancing. Module:', activeModules[currentModuleIndex], 'slide:', currentSlideInModule);
            clearInterval(timerRef.current!);
            timerRef.current = null;
            handleNextSlide();
          }
        }, 1000);
      }
    } else if (currentModuleConfig.timingMode === 'global') {
      // Initialize global timer exactly ONCE per module
      if (globalTimerInitializedRef.current !== currentModuleIndex) {
        const newTime = currentModuleConfig.globalDuration;
        setTimeLeft(newTime);
        timeLeftRef.current = newTime;
        globalTimerInitializedRef.current = currentModuleIndex;
      }

      if (timerRef.current) clearInterval(timerRef.current);

      if (!isPaused) {
        timerRef.current = setInterval(() => {
          timeLeftRef.current -= 1;
          const t = timeLeftRef.current;
          setTimeLeft(t);
          if (t <= 0) {
            console.log('[ENGINE] Global timer expired, advancing module from:', activeModules[currentModuleIndex]);
            clearInterval(timerRef.current!);
            timerRef.current = null;
            advanceToNextModule();
          }
        }, 1000);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isCompleted, currentModuleIndex, currentSlideInModule, isPaused, currentModuleConfig, currentSlide]);

  // Keyboard controls & Security environment listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStarted || isCompleted) return;

      // Detect screenshot, devtools or printing key combinations
      const isScreenshotOrBlockKey = 
        e.key === 'PrintScreen' || 
        (e.metaKey && e.shiftKey && (e.key === 'S' || e.key === 's')) || // Win+Shift+S (Windows Snipping Tool)
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) || // Mac screenshots
        (e.ctrlKey && (e.key === 'P' || e.key === 'p')) || // Print
        (e.metaKey && (e.key === 'P' || e.key === 'p')) || // Mac Print
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) || // DevTools
        (e.key === 'F12');

      if (isScreenshotOrBlockKey) {
        e.preventDefault();
        if (!isAdminPreview) {
          setIsScreenLocked(true);
        }
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
        return;
      }

      const isGlobalTiming = currentModuleConfig.timingMode === 'global';
      const isLastSlideOfModule = currentSlideInModule === currentModuleSlides.length - 1;
      const isSRT = currentModule === 'SRT';

      if (e.key === 'ArrowRight') {
        if (isAdminPreview) {
          handleNextSlide();
        } else if ((isSRT || (allowCandidateSkip && isGlobalTiming)) && !isLastSlideOfModule) {
          handleNextSlide();
        }
      } else if (e.key === 'ArrowLeft') {
        if (isAdminPreview) {
          handlePrevSlide();
        } else if ((isSRT || (allowCandidateSkip && isGlobalTiming)) && currentSlideInModule > 0) {
          handlePrevSlide();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (isAdminPreview) {
          setIsPaused((prev) => !prev);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
      }
    };

    const handleBlur = () => {
      if (!isAdminPreview) {
        // Implement 3-second grace period to ignore blur events triggered by fullscreen transitions
        if (Date.now() - startedAtRef.current < 3000) {
          console.log("Ignoring blur event during start grace period");
          return;
        }
        setIsScreenLocked(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isAdminPreview) {
        setIsScreenLocked(true);
      }
    };

    const preventDefaultContext = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('contextmenu', preventDefaultContext);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('contextmenu', preventDefaultContext);
    };
  }, [isStarted, isCompleted, currentModule, isAdminPreview, handleNextSlide, handlePrevSlide, currentModuleConfig, currentSlideInModule, currentModuleSlides.length, allowCandidateSkip]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  const startAssessment = async () => {
    if (!user || !assessment) return;
    
    // Lock screen only if requested directly (not usually possible from useEffect without click)
    // We already try to lock screen in StudentEntry before navigation
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed", err);
    }

    if (isAdminPreview) {
      setIsStarted(true);
      return;
    }

    if (submissionId) {
      setIsStarted(true);
      return;
    }

    try {
      const sub = await api.submissions.create({ assessmentId: assessment?._id || assessment?.id as string });
      setSubmissionId(sub.id || sub._id);
      setIsStarted(true);
    } catch (error) {
      console.error('Failed to create submission:', error);
      // Even if it fails, try to start so they don't get stuck
      setIsStarted(true);
    }
  };

  const exitPreview = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log(e));
    }
    window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`;
  };

  const completeAssessment = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsCompleted(true);
    setIsStarted(false);
    
    if (isAdminPreview) {
      setTimeout(() => {
        exitPreview();
      }, 2500);
      return;
    }
    
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
      document.exitFullscreen().catch(e => console.log(e));
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!assessment) return <div className="text-app-text-bright p-12 text-center">Assessment records not found.</div>;

  if (isScreenLocked) {
    return (
      <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center text-center p-6 select-none">
        <Watermark user={user} isAdminPreview={isAdminPreview} />
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white uppercase">SECURITY BLOCK ACTIVE</h2>
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">
            Screen capture attempt, tab switching, or loss of focus detected. Timed evaluations are strictly monitored. Your activity has been logged.
          </p>
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold leading-normal">
            To prevent automatic disqualification, click the button below to resume focus and return to the test.
          </div>
          <button
            onClick={() => {
              setIsScreenLocked(false);
              try {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen();
                }
              } catch (err) {}
            }}
            className="w-full py-4 bg-app-accent hover:bg-app-accent/90 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-app-accent/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            Resume Evaluation
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-8">
        <Watermark user={user} isAdminPreview={isAdminPreview} />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-green-500/10 rounded-full text-green-500 mb-4 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]"
        >
          <Zap size={48} className="fill-current" />
        </motion.div>
        <h1 className="text-5xl font-black text-app-text-bright tracking-tight">Test Complete</h1>
        <p className="text-xl text-app-text-muted font-serif italic max-w-lg mx-auto">
          The test is complete. You will now return to your profile. Upload the Dossier in the profile.
        </p>
        <button
          onClick={async () => {
            if (submissionId) {
              try {
                await api.submissions.complete(submissionId);
              } catch (e) {
                console.error("Failed to mark evaluation as complete", e);
              }
            }
            window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest&submissionId=${submissionId}`;
          }}
          className="mt-8 px-12 py-4 bg-app-accent text-white font-bold rounded-xl shadow-lg shadow-app-accent/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
        >
          Continue to Profile
        </button>
      </div>
    );
  }

  // Pre-start screen (fallback just in case)
  if (!isStarted) {
    return (
      <div className="flex justify-center items-center h-screen bg-app-bg">
        <Watermark user={user} isAdminPreview={isAdminPreview} />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  // Active test view
  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-app-bg overflow-hidden font-sans select-none",
        currentSlide?.slideType === 'BLACKOUT' && "bg-black"
      )}
    >
      {/* Security Watermark Overlay */}
      <Watermark user={user} isAdminPreview={isAdminPreview} />

      {/* Overall Progression Bar */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5 z-[110]">
        <motion.div 
          className="h-full bg-app-accent shadow-[0_0_15px_#C5A028]"
          initial={{ width: 0 }}
          animate={{ width: `${((globalSlideIndex + 1) / totalSlides) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Header Info */}
      <div className={cn(
        "px-4 md:px-10 h-16 md:h-20 flex justify-between items-center border-b border-app-border bg-app-header relative shrink-0",
        currentSlide?.slideType === 'BLACKOUT' && "bg-black border-transparent text-zinc-900"
      )}>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2 md:gap-4 ml-auto mr-4">
            <div className="flex flex-col text-right">
              <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Module</span>
              <span className="text-app-text-bright font-black text-[10px] md:text-xs">{currentModule}</span>
            </div>
            {currentModule !== 'TAT' && currentModule !== 'WAT' && (
              <>
                <div className="h-4 w-px bg-app-border/30" />
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Slide</span>
                  <span className="text-app-text-bright font-black text-[10px] md:text-xs">{currentSlideInModule + 1} of {currentModuleSlides.length}</span>
                </div>
              </>
            )}
          </div>

          {currentModuleConfig.navigable && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-app-accent/10 border border-app-accent/20 rounded-lg">
              <ChevronLeft size={12} className="text-app-accent" />
              <span className="text-[8px] font-black text-app-accent uppercase tracking-wider">Navigable</span>
              <ChevronRight size={12} className="text-app-accent" />
            </div>
          )}

          {isAdminPreview && (
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-app-card border border-app-border hover:bg-app-sidebar transition-colors ml-2"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play size={12} className="text-green-500 fill-current ml-0.5" /> : <Pause size={12} className="text-app-accent fill-current" />}
            </button>
          )}
        </div>

        <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
          <h2 className="font-extrabold text-app-text-bright tracking-tight opacity-90 text-xs md:text-sm uppercase">
            {assessment.title}
          </h2>
          <span className="text-[8px] font-black text-app-accent uppercase tracking-widest mt-0.5">
            {currentModuleConfig.timingMode === 'global'
              ? 'Free Navigation Mode' 
              : 'Auto-Advance Mode'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-app-card px-3 py-1.5 md:px-5 md:py-2 rounded-xl border border-app-border flex items-center gap-2 md:gap-3 shadow-inner">
             <Clock className={cn("animate-pulse w-3 h-3 md:w-4 md:h-4", currentModuleConfig.timingMode === 'global' ? "text-amber-400" : "text-app-accent")} />
             <span className="text-sm md:text-xl font-black text-app-text-bright font-mono tabular-nums leading-none">
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
          {isAdminPreview ? (
            <button 
              onClick={exitPreview}
              className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
            >
              Exit Preview
            </button>
          ) : (
            (() => {
              const isSRT = currentModule === 'SRT';
              const isLastSlideOfModule = currentSlideInModule === currentModuleSlides.length - 1;
              const isFirstSlideOfModule = currentSlideInModule === 0;

              if (isSRT) {
                // Candidates can navigate freely back and forth inside SRT
                return (
                  <div className="flex gap-2">
                    {!isFirstSlideOfModule && (
                      <button
                        onClick={handlePrevSlide}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-app-border shadow-md active:scale-95"
                      >
                        Prev
                      </button>
                    )}
                    {!isLastSlideOfModule && (
                      <button
                        onClick={handleNextSlide}
                        className="px-4 py-2 bg-app-accent hover:bg-app-accent/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 border border-white/10"
                      >
                        Next
                      </button>
                    )}
                  </div>
                );
              }

              // If allowCandidateSkip is OFF, no manual controls for candidate at all
              if (!allowCandidateSkip) return null;

              const isGlobalTiming = currentModuleConfig.timingMode === 'global';

              if (isGlobalTiming) {
                // Global timed module (e.g. other global tests)
                if (!isLastSlideOfModule) {
                  return (
                    <button
                      onClick={handleNextSlide}
                      className="px-4 py-2 bg-app-accent hover:bg-app-accent/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 border border-white/10"
                    >
                      Next
                    </button>
                  );
                }
                return null;
              } else {
                // Per-slide timing module (TAT, WAT, SDT, INTRO, etc.)
                return null;
              }
            })()
          )}
        </div>
      </div>

      <div className="@container flex-grow flex items-center justify-center relative px-4 py-4 md:px-12 md:py-8 lg:px-20 lg:py-10 min-h-0 w-full">
        <SlideRenderer slide={currentSlide} invertContentOnly={false} animated={true} />
      </div>

      {/* Slide Pagination Strip */}
      {currentModuleConfig.navigable && currentModuleConfig.timingMode === 'global' && (isAdminPreview || allowCandidateSkip || currentModule === 'SRT') && (
        <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-1.5 bg-app-card/80 backdrop-blur-md px-4 py-2 rounded-full border border-app-border shadow-lg">
          {currentModuleSlides.map((slide, idx) => {
            const displayIdx = idx + 1;
            return (
              <button
                key={idx}
                onClick={() => setCurrentSlideInModule(idx)}
                className={cn(
                  "w-7 h-7 md:w-8 md:h-8 rounded-full text-[10px] font-black transition-all",
                  idx === currentSlideInModule
                    ? "bg-app-accent text-white shadow-lg shadow-app-accent/30 scale-110"
                    : "bg-app-card border border-app-border text-app-text-muted hover:text-app-text-bright hover:scale-105"
                )}
              >
                {displayIdx}
              </button>
            );
          })}
        </div>
      )}

      {/* Floating Presenter Controls */}
      {isStarted && isAdminPreview && (
        <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-3 md:gap-6 bg-app-card/85 backdrop-blur-md px-4 md:px-8 py-2 md:py-3.5 rounded-full border border-app-border shadow-[0_15px_30px_rgba(0,0,0,0.4)] transition-opacity duration-300 hover:opacity-100 opacity-60 max-w-[95vw] md:max-w-none">
          <div className="flex items-center gap-1 md:gap-2">
            {/* Prev — only if navigable */}
            <button
              onClick={handlePrevSlide}
              disabled={!currentModuleConfig.navigable || currentSlideInModule <= 0}
              className="p-1.5 md:p-2 text-app-text-muted hover:text-app-text-bright disabled:opacity-20 disabled:pointer-events-none hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Previous Slide (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            {isAdminPreview && (
              <button
                onClick={() => setIsPaused((prev) => !prev)}
                className="p-2 md:p-3 bg-app-accent/15 border border-app-accent/20 rounded-full text-app-accent hover:bg-app-accent/35 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={isPaused ? "Play Timer (Spacebar)" : "Pause Timer (Spacebar)"}
              >
                {isPaused ? <Play size={16} className="fill-current md:w-5 md:h-5" /> : <Pause size={16} className="fill-current md:w-5 md:h-5" />}
              </button>
            )}

            {/* Next — always visible but behavior depends on module config */}
            <button
              onClick={handleNextSlide}
              className="p-1.5 md:p-2 text-app-text-muted hover:text-app-text-bright hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Next Slide (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Monitor */}
      <div className="h-2 w-full bg-app-card relative shrink-0">
        {currentModuleConfig.timingMode === 'per-slide' ? (
          <div 
            className="h-full bg-app-accent shadow-[0_0_20px_#C5A028] transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / (currentSlide?.displayTime || 1)) * 100}%` }}
          />
        ) : (
          <div 
            className="h-full bg-amber-400 shadow-[0_0_20px_#F59E0B] transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / (currentModuleConfig.globalDuration || 1)) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
};

export default AssessmentEngine;
