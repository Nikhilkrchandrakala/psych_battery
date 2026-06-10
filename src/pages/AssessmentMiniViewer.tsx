import React, { useMemo } from 'react';
import { useAssessmentData } from '../hooks/useAssessmentData';
import { useParams } from 'react-router-dom';
import { AssessmentSlide, ModuleId } from '../types';

interface AssessmentPresenterProps {
  assessmentId?: string; // Can be passed directly or taken from route params
  onExit?: () => void;
}

const MODULE_ORDER: ModuleId[] = ['INTRO', 'TAT', 'WAT', 'SRT_INST', 'SRT', 'SDT_INST', 'SDT', 'CLOSING'];

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

export const AssessmentMiniViewer: React.FC<AssessmentPresenterProps> = ({ assessmentId: propId }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const id = propId || routeId;
  
  const { assessment, allSlides, loading, error } = useAssessmentData(id, null);

  const filteredSlides = useMemo(() => {
    const list = allSlides.filter(slide => {
      // 1. Exclude introductory, instruction, closing modules
      if (['INTRO', 'SRT_INST', 'SDT_INST', 'CLOSING'].includes(slide.module)) return false;
      // 2. Exclude break and blackout slides
      if (slide.slideType === 'BREAK' || slide.slideType === 'BLACKOUT') return false;
      // 3. Exclude explicit instruction slides
      if (slide.isInstruction) return false;
      
      // 4. Module-specific question constraints:
      // TAT (Thematic Apperception Test) only consists of IMAGE slides as questions
      if (slide.module === 'TAT' && slide.slideType !== 'IMAGE') return false;
      // WAT (Word Association Test) only consists of WORD slides as questions
      if (slide.module === 'WAT' && slide.slideType !== 'WORD') return false;

      // 5. Exclude slide if it matches instruction/introductory text patterns (case-insensitive)
      const contentUpper = (slide.content || '').toUpperCase();
      const instructionKeywords = [
        'INSTRUCTIONS FOR',
        'IN THIS TEST',
        'TEST OF YOUR',
        'YOU WILL BE PRESENTED',
        'YOU ARE REQUIRED TO',
        'GREETINGS OF THE',
        'PRACTICE WORD',
        'PRACTICE SITUATION',
        'SAMPLE WORD',
        'SAMPLE SITUATION',
        'WRITE DOWN YOUR',
        'WRITING YOUR',
        'THANK YOU PLEASE',
        'THANK YOU!'
      ];
      const hasKeyword = instructionKeywords.some(kw => contentUpper.includes(kw));
      if (hasKeyword) return false;

      return true;
    });

    // Sort by module order and order within module
    return list.sort((a, b) => {
      const idxA = MODULE_ORDER.indexOf(a.module);
      const idxB = MODULE_ORDER.indexOf(b.module);
      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return (a.order || 0) - (b.order || 0);
    });
  }, [allSlides]);

  // Group slides by module for rendering sections
  const groupedSlides = useMemo(() => {
    const groups: Record<string, AssessmentSlide[]> = {};
    filteredSlides.forEach(slide => {
      if (!groups[slide.module]) {
        groups[slide.module] = [];
      }
      groups[slide.module].push(slide);
    });
    return groups;
  }, [filteredSlides]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-app-bg text-app-accent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="text-red-400 p-8 text-center bg-app-bg w-full h-full flex items-center justify-center font-serif italic">
        {error || "Assessment not found"}
      </div>
    );
  }

  if (filteredSlides.length === 0) {
    return (
      <div className="text-app-text-muted p-8 text-center bg-app-bg w-full h-full flex items-center justify-center font-serif italic">
        No evaluation questions found for this assessment.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-app-sidebar overflow-hidden font-sans select-none relative rounded-3xl">
      {/* Quick Section Links */}
      <div className="shrink-0 flex gap-2 p-3 bg-black/20 border-b border-app-border overflow-x-auto select-none no-scrollbar">
        {Object.entries(groupedSlides).map(([mod, slides]) => (
          <button
            key={mod}
            onClick={() => {
              const el = document.getElementById(`qp-sec-${mod}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="px-3 py-1.5 bg-app-card border border-app-border/60 hover:border-app-accent text-app-text-bright hover:text-app-accent rounded-lg text-[9px] font-black transition-all uppercase tracking-widest shrink-0 cursor-pointer"
          >
            {mod} ({slides.length})
          </button>
        ))}
      </div>

      {/* Scrollable Questions list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-app-bg text-app-text-bright custom-scrollbar">
        {Object.entries(groupedSlides).map(([moduleName, slides]) => (
          <div key={moduleName} id={`qp-sec-${moduleName}`} className="space-y-4 pt-1">
            <div className="sticky top-0 bg-app-bg/95 backdrop-blur border-b border-app-border/60 pb-2 z-10 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase text-app-accent tracking-[0.2em]">
                {moduleName} Section
              </h3>
              <span className="text-[9px] text-app-text-muted font-black uppercase tracking-widest">
                {slides.length} Questions
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {slides.map((slide, idx) => (
                <div 
                  key={slide.id} 
                  className="bg-app-card/40 border border-app-border/40 hover:border-app-accent/20 rounded-2xl p-4 transition-all space-y-3"
                >
                  <div className="flex justify-between items-center text-[9px] font-black text-app-text-muted uppercase tracking-widest">
                    <span>Question {idx + 1}</span>
                    <span className="px-1.5 py-0.5 rounded bg-black/20 border border-app-border/30">
                      ID: {slide.order || (idx + 1)}
                    </span>
                  </div>

                  {/* Render based on slide type */}
                  {slide.slideType === 'IMAGE' && slide.imageUrl && (
                    <div className="w-full aspect-video bg-black/20 rounded-xl overflow-hidden border border-app-border/40 relative flex items-center justify-center p-2">
                      <img 
                        src={slide.imageUrl} 
                        alt={`Stimulus ${idx + 1}`} 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        referrerPolicy="no-referrer"
                        style={{ filter: slide.inverted ? 'invert(1)' : 'none' }}
                      />
                    </div>
                  )}

                  {slide.slideType === 'WORD' && slide.content && (
                    <div 
                      className="text-xl font-black text-app-text-bright tracking-tight text-center py-6 bg-black/20 rounded-xl font-mono uppercase border border-app-border/20"
                      style={{ filter: slide.inverted ? 'invert(1)' : 'none' }}
                      dangerouslySetInnerHTML={{ __html: slide.content }}
                    />
                  )}

                  {slide.slideType === 'TEXT' && slide.content && (
                    <div 
                      className="text-xs text-app-text-bright leading-relaxed bg-black/20 border border-app-border/20 rounded-xl p-4 font-serif italic"
                      dangerouslySetInnerHTML={{ __html: cleanHTML(slide.content) }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
