import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAssessmentData } from '../hooks/useAssessmentData';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';
import { useParams } from 'react-router-dom';

interface AssessmentPresenterProps {
  assessmentId?: string; // Can be passed directly or taken from route params
  onExit?: () => void;
}

export const AssessmentPresenter: React.FC<AssessmentPresenterProps> = ({ assessmentId: propId, onExit }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = propId || routeId;
  
  const { assessment, allSlides, loading, error, moduleSlideMap, activeModules } = useAssessmentData(id);

  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentSlideInModule, setCurrentSlideInModule] = useState(0);

  const currentModule = activeModules[currentModuleIndex] || 'INTRO';
  const currentModuleSlides = moduleSlideMap[currentModule] || [];
  const currentSlide = currentModuleSlides[currentSlideInModule];

  const totalSlides = allSlides.length;
  const globalSlideIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < currentModuleIndex; i++) {
      count += moduleSlideMap[activeModules[i]]?.length || 0;
    }
    return count + currentSlideInModule;
  }, [currentModuleIndex, currentSlideInModule, activeModules, moduleSlideMap]);

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

  // We use a fixed font size multiplier so it always looks good in embedded views
  const fontSizeMultiplier = 1.0;

  return (
    <div className={cn("w-full h-full flex flex-col bg-app-bg overflow-hidden font-sans select-none relative", currentSlide?.slideType === 'BLACKOUT' && "bg-black")}>
      
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5 z-50">
        <motion.div 
          className="h-full bg-app-accent"
          initial={{ width: 0 }}
          animate={{ width: `${((globalSlideIndex + 1) / totalSlides) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Slide Content Area (Full Bleed) */}
      <div className="flex-grow flex items-center justify-center relative px-2 py-4 sm:px-8 sm:py-8 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentSlide && (
            <motion.div
              key={currentSlide.id || `${currentModuleIndex}-${currentSlideInModule}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full h-full flex flex-col items-center justify-center relative"
            >
              {currentSlide.slideType === 'IMAGE' && currentSlide.imageUrl && (
                <div className="relative w-full h-full max-h-[85vh] flex items-center justify-center">
                  <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[200px]" />
                  <img 
                    src={currentSlide.imageUrl} 
                    alt="Evaluation Stimulus" 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-app-border relative z-10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur px-4 py-2 rounded-xl text-lg font-black text-white border border-white/10 z-20">
                    {currentSlide.order}
                  </div>
                </div>
              )}

              {currentSlide.slideType === 'WORD' && currentSlide.content && (
                <div className="relative max-w-full px-4">
                  <h3 
                    style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(2rem, 10vw, 8rem))` }}
                    className="font-black tracking-tighter text-app-text-bright leading-none relative z-10 text-center font-sans break-words max-w-full"
                    dangerouslySetInnerHTML={{ __html: currentSlide.content }}
                  />
                </div>
              )}

              {currentSlide.slideType === 'BREAK' && (
                <div className="text-center space-y-6 group px-4 max-w-full">
                  <div className="w-16 h-16 bg-app-card rounded-full flex items-center justify-center mx-auto border border-app-border">
                    <Clock className="text-app-text-muted w-8 h-8" />
                  </div>
                  <h3 
                    style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(2rem, 6vw, 4rem))` }}
                    className="font-black text-app-text-bright uppercase tracking-tighter italic font-sans"
                  >
                    BREAK
                  </h3>
                </div>
              )}

              {currentSlide.slideType === 'TEXT' && (
                <div className="bg-app-sidebar p-6 sm:p-12 rounded-[2rem] border border-app-border shadow-2xl w-full max-w-5xl max-h-[80vh] overflow-y-auto custom-scrollbar relative">
                   <div 
                     style={{ fontSize: `calc(${fontSizeMultiplier} * clamp(1.25rem, 2.5vw, 2rem))`, lineHeight: '1.6' }}
                     className="text-app-text-bright font-sans whitespace-pre-wrap break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-8 [&_ol]:pl-8"
                     dangerouslySetInnerHTML={{ __html: currentSlide.content || "" }}
                   />
                </div>
              )}

              {currentSlide.slideType === 'BLACKOUT' && (
                <div className="text-white/10 text-[10vw] font-black italic select-none pointer-events-none uppercase tracking-tighter">
                  WRITE
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Presenter Toolbar */}
      <div className="h-16 shrink-0 bg-app-header border-t border-app-border flex items-center justify-between px-4 sm:px-8 z-50">
        
        {/* Module Info */}
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Module</span>
          <span className="text-app-text-bright font-black text-xs">{currentModule}</span>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={handlePrevSlide}
            disabled={isAtStart}
            className="flex items-center gap-2 p-2 px-4 rounded-xl text-app-text-muted hover:bg-app-card hover:text-app-text-bright disabled:opacity-30 transition-all font-black uppercase tracking-widest text-[10px]"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div className="text-center min-w-[80px]">
            <span className="text-sm font-black text-app-text-bright">{globalSlideIndex + 1}</span>
            <span className="text-[10px] text-app-text-muted mx-1">/</span>
            <span className="text-[10px] font-black text-app-text-muted">{totalSlides}</span>
          </div>

          <button
            onClick={handleNextSlide}
            disabled={isAtEnd}
            className="flex items-center gap-2 p-2 px-4 rounded-xl text-app-text-bright bg-app-accent/10 border border-app-accent/20 hover:bg-app-accent hover:text-white disabled:opacity-30 disabled:hover:bg-app-accent/10 disabled:hover:text-app-text-bright transition-all font-black uppercase tracking-widest text-[10px]"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Utilities */}
        <div className="flex items-center">
          {onExit && (
             <button
               onClick={onExit}
               className="text-[10px] font-black uppercase tracking-widest text-app-text-muted hover:text-white transition-colors"
             >
               Exit
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
