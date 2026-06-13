import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAssessmentData } from '../hooks/useAssessmentData';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { SlideRenderer } from '../components/SlideRenderer';



interface AssessmentPresenterProps {
  assessmentId?: string; // Can be passed directly or taken from route params
  onExit?: () => void;
}

export const AssessmentAdminPreview: React.FC<AssessmentPresenterProps> = ({ assessmentId: propId, onExit }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = propId || routeId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewModule = searchParams.get('module');
  
  const { assessment, allSlides, loading, error, moduleSlideMap, activeModules } = useAssessmentData(id, previewModule);

  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentSlideInModule, setCurrentSlideInModule] = useState(0);

  const currentModule = activeModules[currentModuleIndex] || 'INTRO';
  const currentModuleSlides = moduleSlideMap[currentModule] || [];
  const currentSlide = currentModuleSlides[currentSlideInModule];

  const totalSlides = previewModule ? (moduleSlideMap[previewModule as any]?.length || 0) : allSlides.length;
  const globalSlideIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentModuleIndex; i++) {
      count += moduleSlideMap[activeModules[i]]?.length || 0;
    }
    return count + currentSlideInModule;
  }, [currentModuleIndex, currentSlideInModule, activeModules, moduleSlideMap]);

  const currentModuleConfig = assessment?.modules?.[currentModule as any] || { timingMode: 'per-slide', globalDuration: 0, navigable: false };

  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSlideKeyRef = useRef<string>('');

  const advanceToNextModule = useCallback(() => {
    if (currentModuleIndex + 1 >= activeModules.length) {
      return; // End of assessment
    }
    setCurrentModuleIndex(prev => prev + 1);
    setCurrentSlideInModule(0);
  }, [currentModuleIndex, activeModules.length]);

  const handleNextSlide = useCallback(() => {
    if (currentSlideInModule + 1 >= currentModuleSlides.length) {
      advanceToNextModule();
      return;
    }
    setCurrentSlideInModule(prev => prev + 1);
  }, [currentSlideInModule, currentModuleSlides.length, advanceToNextModule]);

  const handlePrevSlide = useCallback(() => {
    if (currentSlideInModule > 0) {
      setCurrentSlideInModule(prev => prev - 1);
    } else if (currentModuleIndex > 0) {
      // Go to last slide of previous module
      const prevModuleIndex = currentModuleIndex - 1;
      const prevModule = activeModules[prevModuleIndex];
      setCurrentModuleIndex(prevModuleIndex);
      setCurrentSlideInModule(Math.max(0, (moduleSlideMap[prevModule]?.length || 1) - 1));
    }
  }, [currentSlideInModule, currentModuleIndex, activeModules, moduleSlideMap]);

  // Timer logic
  useEffect(() => {
    if (!currentSlide || !assessment) return;

    const slideKey = `${currentModuleIndex}-${currentSlideInModule}`;

    if (currentModuleConfig.timingMode === 'per-slide') {
      if (lastSlideKeyRef.current !== slideKey) {
        setTimeLeft(currentSlide.displayTime || 15);
        lastSlideKeyRef.current = slideKey;
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
    } else {
      if (lastSlideKeyRef.current.split('-')[0] !== String(currentModuleIndex)) {
        setTimeLeft(currentModuleConfig.globalDuration || 1800);
        lastSlideKeyRef.current = slideKey;
      } else {
        lastSlideKeyRef.current = slideKey;
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
  }, [currentSlide, currentModuleIndex, currentSlideInModule, currentModuleConfig, isPaused, handleNextSlide, assessment]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        handlePrevSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextSlide, handlePrevSlide]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-app-bg text-app-accent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  if (error || !assessment) {
    return <div className="text-red-400 p-8 text-center bg-app-bg w-full h-full flex items-center justify-center font-serif italic">{error || "Assessment not found"}</div>;
  }

  if (allSlides.length === 0) {
    return <div className="text-app-text-muted p-8 text-center bg-app-bg w-full h-full flex items-center justify-center font-serif italic">No slides found for this assessment.</div>;
  }

  const isAtStart = currentModuleIndex === 0 && currentSlideInModule === 0;
  const isAtEnd = currentModuleIndex === activeModules.length - 1 && currentSlideInModule === currentModuleSlides.length - 1;

  return (
    <div className={cn("w-full h-screen flex flex-col bg-app-bg overflow-hidden font-sans select-none relative", currentSlide?.slideType === 'BLACKOUT' && "bg-black")}>
      
      {/* Progress Bar */}
      <div className="w-full h-[3px] bg-white/5 z-50 shrink-0">
        <motion.div 
          className="h-full bg-app-accent"
          initial={{ width: 0 }}
          animate={{ width: `${((globalSlideIndex + 1) / totalSlides) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Slide Content Area (WYSIWYG 16:9 Canvas) */}
      <div className="@container flex-1 min-h-0 w-full flex items-center justify-center bg-black/40 relative overflow-hidden p-8">
        <div 
          className="flex flex-col items-center justify-center relative w-full bg-app-bg border border-app-border rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          style={{ 
            aspectRatio: '16/9', 
            maxWidth: 'calc((100vh - 120px) * 16 / 9)'
          }}
        >
          <SlideRenderer slide={currentSlide} invertContentOnly={false} animated={true} />
        </div>
      </div>

      {/* Bottom Presenter Toolbar (Static Div Below) */}
      <div className="shrink-0 h-20 bg-black flex items-center justify-between px-8 z-50 border-t border-white/5 w-full">
        
        {/* Module Info */}
        <div className="flex flex-col w-[200px]">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Module</span>
          <span className="text-app-text-bright font-black text-sm">{currentModule}</span>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-6 flex-1 justify-center">
          <button
            onClick={handlePrevSlide}
            disabled={isAtStart}
            className="flex items-center gap-2 p-2 px-6 rounded-xl text-app-text-muted hover:bg-app-card hover:text-app-text-bright disabled:opacity-30 transition-all font-black uppercase tracking-widest text-[12px]"
          >
            <ChevronLeft size={18} /> Prev
          </button>
          
          <div className="text-center min-w-[100px] flex items-center justify-center gap-2">
            <span className="text-base font-black text-app-text-bright">{globalSlideIndex + 1}</span>
            <span className="text-[12px] text-app-text-muted">/</span>
            <span className="text-[12px] font-black text-app-text-muted">{totalSlides}</span>
          </div>

          <button
            onClick={handleNextSlide}
            disabled={isAtEnd}
            className="flex items-center gap-2 p-2 px-6 rounded-xl text-app-text-bright bg-app-accent/10 border border-app-accent/20 hover:bg-app-accent hover:text-white disabled:opacity-30 disabled:hover:bg-app-accent/10 disabled:hover:text-app-text-bright transition-all font-black uppercase tracking-widest text-[12px]"
          >
            Next <ChevronRight size={18} />
          </button>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-6 justify-end w-auto min-w-[200px]">

          <button
            onClick={() => {
              if (onExit) onExit();
              else navigate(`/admin/assessment/${id}`);
            }}
            className="px-6 py-2.5 bg-red-500/10 text-red-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
          >
            Exit Preview
          </button>
        </div>
      </div>
    </div>
  );
};
