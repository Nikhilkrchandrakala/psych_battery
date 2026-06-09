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

export const AssessmentMiniViewer: React.FC<AssessmentPresenterProps> = ({ assessmentId: propId, onExit }) => {
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

  const totalSlides = useMemo(() => {
    if (previewModule) {
      return moduleSlideMap[previewModule as any]?.length || 0;
    }
    return activeModules.reduce((acc, m) => acc + (moduleSlideMap[m]?.length || 0), 0);
  }, [previewModule, activeModules, moduleSlideMap]);

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

  // Timer logic removed for assessor preview - manual navigation only

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

  if (activeModules.length === 0) {
    return <div className="text-app-text-muted p-8 text-center bg-app-bg w-full h-full flex items-center justify-center font-serif italic">No evaluation slides found for this assessment.</div>;
  }

  const isAtStart = currentModuleIndex === 0 && currentSlideInModule === 0;
  const isAtEnd = currentModuleIndex === activeModules.length - 1 && currentSlideInModule === currentModuleSlides.length - 1;

  return (
    <div className={cn("w-full h-full flex flex-col bg-app-sidebar overflow-hidden font-sans select-none relative rounded-3xl", currentSlide?.slideType === 'BLACKOUT' && "bg-black")}>
      
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
      <div className="flex-1 min-h-0 w-full flex items-center justify-center p-0">
        <div className="w-full aspect-video max-h-full relative overflow-hidden rounded-2xl border border-app-border bg-app-bg flex items-center justify-center shadow-2xl">
          <SlideRenderer slide={currentSlide} invertContentOnly={false} animated={false} />
        </div>
      </div>

      {/* Simple Mini Toolbar */}
      <div className="shrink-0 h-12 bg-black/40 flex items-center justify-between px-4 z-50 border-t border-app-border w-full">
        <button
          onClick={handlePrevSlide}
          disabled={isAtStart}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-app-text-muted hover:bg-white/5 hover:text-app-text-bright disabled:opacity-30 transition-all font-black uppercase tracking-widest text-[10px]"
        >
          <ChevronLeft size={14} /> Back
        </button>
        
        <div className="text-[10px] font-mono text-app-text-muted tracking-widest uppercase">
          Slide {globalSlideIndex + 1} / {totalSlides}
        </div>

        <button
          onClick={handleNextSlide}
          disabled={isAtEnd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-app-text-muted hover:bg-white/5 hover:text-app-text-bright disabled:opacity-30 transition-all font-black uppercase tracking-widest text-[10px]"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
