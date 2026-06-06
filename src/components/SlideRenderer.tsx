import React from 'react';
import { AssessmentSlide } from '../types';
import { Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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

interface SlideRendererProps {
  slide: AssessmentSlide;
  // Apply the invert filter only to the inner content element, not the wrapper
  // This fixes the white-background issue on dark sidebars
  invertContentOnly?: boolean;
  // If true, the renderer wraps itself in AnimatePresence/motion.div
  // Set to false if the parent is already handling the motion wrapper
  animated?: boolean;
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ 
  slide, 
  invertContentOnly = true,
  animated = true 
}) => {
  if (!slide) return null;

  const innerContent = (
    <>
      {slide.slideType === 'IMAGE' && slide.imageUrl && (
        <div className="relative w-full h-full flex items-center justify-center p-[2cqi] min-h-0 min-w-0 overflow-hidden">
          <div className="absolute inset-0 bg-app-accent/5 rounded-full blur-[200px]" />
          <img 
            src={slide.imageUrl} 
            alt="Evaluation Stimulus" 
            className="w-full h-full object-contain rounded-[2cqi] shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-app-border relative z-10"
            referrerPolicy="no-referrer"
            style={{ filter: invertContentOnly && slide.inverted ? 'invert(1)' : 'none' }}
          />
          <div className="absolute bottom-[5cqi] left-[5cqi] bg-black/80 backdrop-blur px-[3cqi] py-[1.5cqi] rounded-[1.5cqi] font-black text-white border border-white/10 z-20 shadow-2xl" style={{ fontSize: 'clamp(0.5rem, 3cqi, 3rem)' }}>
            {slide.order}
          </div>
        </div>
      )}

      {slide.slideType === 'WORD' && slide.content && (
        <div className="relative max-w-full px-[4cqi] w-full h-full flex flex-col overflow-hidden min-h-0 min-w-0">
          <div className="absolute inset-0 bg-app-accent/10 rounded-full blur-[150px]" />
          <div 
            className="flex-1 font-sans font-normal text-app-text-bright tracking-tight w-full p-[4cqi] text-center font-black flex items-center justify-center whitespace-pre-wrap break-words relative z-10 min-h-0 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: slide.content }}
            style={{ 
              fontSize: `calc(clamp(0.5rem, 6cqi, 10rem) * ${slide.typographyScale || 1})`,
              lineHeight: '1.2',
              filter: invertContentOnly && slide.inverted ? 'invert(1)' : 'none'
            }}
          />
        </div>
      )}

      {slide.slideType === 'BREAK' && (
        <div className="text-center space-y-[4cqi] group px-[4cqi] max-w-full">
           <div className="w-[15cqi] h-[15cqi] bg-app-card rounded-full flex items-center justify-center mx-auto border border-app-border group-hover:scale-110 transition-transform duration-700 shadow-2xl">
            <Clock className="text-app-text-muted w-[8cqi] h-[8cqi]" />
          </div>
          <h3 
            style={{ fontSize: 'clamp(0.5rem, 8cqi, 5rem)' }}
            className="font-black text-app-text-bright uppercase tracking-tighter italic font-sans"
          >
            BREAK
          </h3>
          <p 
            style={{ fontSize: 'clamp(0.5rem, 2.5cqi, 2rem)' }}
            className="text-app-text-muted font-sans italic max-w-md mx-auto"
          >
            Deep breaths encouraged. Next section loading shortly.
          </p>
        </div>
      )}

      {slide.slideType === 'TEXT' && (
        <div className="w-full h-full flex flex-col items-center justify-center max-h-full overflow-hidden px-[4cqi] py-[3cqi] min-h-0 min-w-0">
           <div className="w-full max-h-full overflow-hidden flex flex-col justify-center">
             <div 
               style={{ 
                 fontSize: `calc(clamp(0.5rem, 2.2cqi, 3rem) * ${slide.typographyScale || 1})`, 
                 lineHeight: '1.5'
               }}
               className="text-app-text-bright font-sans whitespace-pre-wrap break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-[3cqi] [&_ol]:pl-[3cqi] text-left"
               dangerouslySetInnerHTML={{ __html: cleanHTML(slide.content || "") }}
             />
           </div>
        </div>
      )}

      {slide.slideType === 'BLACKOUT' && (
        <div className="text-white/10 text-[10cqi] sm:text-[15cqi] font-black italic select-none pointer-events-none uppercase tracking-tighter animate-pulse">
          WRITE
        </div>
      )}
    </>
  );

  if (!animated) {
    return (
      <div 
        className="flex-1 w-full h-full flex flex-col items-center justify-center bg-app-sidebar min-h-0 min-w-0 overflow-hidden relative"
        style={{ 
          filter: !invertContentOnly && slide.inverted ? 'invert(1)' : 'none',
          containerType: 'size' 
        }}
      >
        {innerContent}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slide.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 w-full h-full flex flex-col items-center justify-center bg-app-sidebar min-h-0 min-w-0 overflow-hidden relative"
        style={{ 
          filter: !invertContentOnly && slide.inverted ? 'invert(1)' : 'none',
          containerType: 'size'
        }}
      >
        {innerContent}
      </motion.div>
    </AnimatePresence>
  );
};
