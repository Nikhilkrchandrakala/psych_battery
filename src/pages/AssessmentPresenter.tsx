import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAssessmentData } from '../hooks/useAssessmentData';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Clock, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

const cleanHTML = (html: string) => {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let lastChild = doc.body.lastChild;
    while (lastChild) {
      if (lastChild.nodeType === Node.TEXT_NODE && !lastChild.textContent?.trim()) {
        const prev = lastChild.previousSibling;
        lastChild.remove();
        lastChild = prev;
      } else if (lastChild.nodeType === Node.ELEMENT_NODE) {
        const el = lastChild as HTMLElement;
        if (el.tagName === 'BR' || (!el.textContent?.trim() && !el.querySelector('img'))) {
          const prev = lastChild.previousSibling;
          lastChild.remove();
          lastChild = prev;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return doc.body.innerHTML;
  } catch (e) {
    return html;
  }
};

interface AssessmentPresenterProps {
  assessmentId?: string; // Can be passed directly or taken from route params
  onExit?: () => void;
}

export const AssessmentPresenter: React.FC<AssessmentPresenterProps> = ({ assessmentId: propId, onExit }) => {
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
      <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-black/40 relative overflow-hidden">
        <div 
          className="flex flex-col items-center justify-center relative w-full"
          style={{ 
            aspectRatio: '16/9', 
            maxWidth: 'calc((100vh - 80px) * 16 / 9)'
          }}
        >
        <AnimatePresence mode="wait">
          {currentSlide && (
            <motion.div
              key={currentSlide.id || `${currentModuleIndex}-${currentSlideInModule}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 w-full flex flex-col items-center justify-center bg-app-sidebar"
              style={{ filter: currentSlide?.inverted ? 'invert(1)' : 'none' }}
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
                </div>
              )}

              {currentSlide.slideType === 'WORD' && currentSlide.content && (
                <div className="w-full h-full flex flex-col overflow-hidden">
                  <div 
                    className="flex-1 font-sans font-normal text-app-text-bright tracking-tight w-full p-[6cqi] text-center font-black flex items-center justify-center whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: currentSlide.content }}
                    style={{ 
                      containerType: 'inline-size',
                      fontSize: `calc(8cqi * ${currentSlide.typographyScale || 1})`
                    }}
                  />
                </div>
              )}

              {currentSlide.slideType === 'BREAK' && (
                <div className="text-center space-y-6 group p-[6cqi] max-w-full">
                  <div className="w-16 h-16 bg-app-card rounded-full flex items-center justify-center mx-auto border border-app-border">
                    <Clock className="text-app-text-muted w-8 h-8" />
                  </div>
                  <h3 
                    style={{ fontSize: 'clamp(2rem, 6vw, 4rem)' }}
                    className="font-black text-app-text-bright uppercase tracking-tighter italic font-sans"
                  >
                    BREAK
                  </h3>
                </div>
              )}

              {currentSlide.slideType === 'TEXT' && (
                <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden p-[6cqi]">
                  <div 
                    className="w-full my-auto font-sans font-normal text-app-text-bright tracking-tight text-left leading-relaxed whitespace-pre-wrap break-words [&_ul]:list-disc [&_ul]:pl-12 [&_ol]:list-decimal [&_ol]:pl-12 [&_li]:my-2"
                    dangerouslySetInnerHTML={{ __html: cleanHTML(currentSlide.content || "") }}
                    style={{ 
                      containerType: 'inline-size',
                      fontSize: `calc(1.1cqi * ${currentSlide.typographyScale || 1})`
                    }}
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

        {/* Counter and Utilities */}
        <div className="flex items-center gap-6 justify-end w-auto min-w-[200px]">
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
             <Clock className={cn("animate-pulse w-4 h-4", currentModuleConfig.timingMode === 'global' ? "text-amber-400" : "text-app-accent")} />
             <span className="text-xl font-black text-app-text-bright font-mono tabular-nums leading-none">
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>

          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border",
              isPaused 
                ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white" 
                : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white"
            )}
          >
            {isPaused ? "Resume" : "Pause Timer"}
          </button>

          <button
            onClick={() => {
              if (onExit) onExit();
              else navigate(-1);
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
