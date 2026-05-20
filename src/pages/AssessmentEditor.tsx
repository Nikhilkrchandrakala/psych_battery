import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, SlideType } from '../types';
import { 
  Save, Plus, Trash2, ChevronUp, ChevronDown, 
  Image as ImageIcon, Type, MessageSquare, 
  Clock, Play, Settings, ArrowLeft, Loader2,
  AlertCircle, Layout, Eye, Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const AssessmentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [slides, setSlides] = useState<AssessmentSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState<number>(1.0);


  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const assessmentData = await api.assessments.get(id);
        setAssessment(assessmentData);

        const fetchedSlides = await api.assessments.slides(id);
        setSlides(fetchedSlides);
        if (fetchedSlides.length > 0) {
          setActiveSlideId(fetchedSlides[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch assessment data:', error);
        navigate('/admin');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const activeSlide = slides.find(s => s.id === activeSlideId);

  const addSlide = () => {
    const newSlide: AssessmentSlide = {
      id: `new-${Date.now()}`,
      assessmentId: id!,
      slideType: 'INSTRUCTIONS',
      content: 'New Slide Content',
      displayTime: 5,
      order: slides.length
    };
    setSlides([...slides, newSlide]);
    setActiveSlideId(newSlide.id);
  };

  const updateSlide = (slideId: string, updates: Partial<AssessmentSlide>) => {
    setSlides(prev => prev.map(s => s.id === slideId ? { ...s, ...updates } : s));
  };

  const deleteSlide = (slideId: string) => {
    const newSlides = slides.filter(s => s.id !== slideId).map((s, i) => ({ ...s, order: i }));
    setSlides(newSlides);
    if (activeSlideId === slideId) {
      setActiveSlideId(newSlides.length > 0 ? newSlides[0].id : null);
    }
  };

  const moveSlide = (slideId: string, direction: 'up' | 'down') => {
    const index = slides.findIndex(s => s.id === slideId);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slides.length - 1) return;

    const newSlides = [...slides];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[swapIndex]] = [newSlides[swapIndex], newSlides[index]];
    
    // Update orders
    const orderedSlides = newSlides.map((s, i) => ({ ...s, order: i }));
    setSlides(orderedSlides);
  };

  const saveChanges = async () => {
    if (!id || !assessment) return;
    setSaving(true);
    try {
      // Update assessment
      await api.assessments.update(id, assessment);

      // Save slides batch
      const updatedSlides = await api.assessments.saveSlidesBatch(id, slides);
      setSlides(updatedSlides);
      
      alert('Changes saved successfully protocol.');
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save protocol configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-app-bg">
      <Loader2 className="animate-spin text-app-accent" size={40} />
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-app-bg text-app-text-main overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-app-border bg-app-sidebar flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-white/5 rounded-lg text-app-text-muted transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-8 w-px bg-app-border mx-1" />
          <div>
            <h1 className="text-sm font-black text-app-text-bright uppercase tracking-widest leading-none mb-1">
              {assessment?.title || 'Untitled Protocol'}
            </h1>
            <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-tighter">
              Protocol Configuration Editor
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(`/assessment/${id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-card border border-app-border text-xs font-black text-app-text-bright hover:bg-white/5 transition-all"
          >
            <Eye size={16} /> Preview
          </button>
          <button 
            onClick={saveChanges}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-app-accent/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Save Protocol
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Slide Thumbnails */}
        <aside className="w-72 bg-app-sidebar border-r border-app-border flex flex-col shrink-0">
          <div className="p-4 border-b border-app-border flex items-center justify-between">
            <span className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">Sequence Map</span>
            <button 
              onClick={addSlide}
              className="p-1.5 hover:bg-app-accent hover:text-white rounded-lg text-app-accent border border-app-accent/20 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {slides.map((slide, index) => (
                <motion.div
                  key={slide.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setActiveSlideId(slide.id)}
                  className={cn(
                    "group relative flex flex-col gap-2 p-3 rounded-2xl border transition-all cursor-pointer",
                    activeSlideId === slide.id 
                      ? "bg-app-accent/10 border-app-accent shadow-[0_0_20px_-5px_rgba(var(--app-accent-rgb),0.3)]" 
                      : "bg-app-card border-app-border hover:border-app-text-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-app-accent uppercase tracking-widest">Slide {index + 1}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, 'up'); }} className="p-1 hover:text-app-text-bright"><ChevronUp size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, 'down'); }} className="p-1 hover:text-app-text-bright"><ChevronDown size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }} className="p-1 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  
                  <div className="h-20 rounded-lg bg-black/40 border border-app-border overflow-hidden flex items-center justify-center relative">
                    {slide.slideType === 'IMAGE' ? (
                      slide.imageUrl ? (
                        <img src={slide.imageUrl} alt="Slide Preview" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon size={18} className="text-app-text-muted" />
                          <span className="text-[8px] font-black text-app-text-muted uppercase">No Image</span>
                        </div>
                      )
                    ) : (
                      <div className="text-[10px] font-black text-app-text-muted uppercase text-center px-2 line-clamp-2">
                        {slide.slideType === 'WORD' ? slide.content : slide.slideType.replace('_', ' ')}
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-black text-white">
                      {slide.displayTime}s
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </aside>

        {/* Center - Workspace Canvas */}
        <main className="flex-1 bg-black/30 p-12 overflow-y-auto flex items-center justify-center relative">
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-8 text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em]">
             <span>Canvas Viewport</span>
             <div className="h-px w-24 bg-app-border" />
             <span>Draft {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="w-full max-w-4xl aspect-video bg-app-sidebar border border-app-border rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col items-center justify-center p-20 text-center relative group">
             {activeSlide ? (
               <>
                 {activeSlide.slideType === 'IMAGE' && (
                   <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                      {activeSlide.imageUrl ? (
                        <img src={activeSlide.imageUrl} alt="Slide Content" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                      ) : (
                        <div className="p-12 bg-app-card rounded-3xl border-2 border-dashed border-app-border flex flex-col items-center gap-4">
                           <ImageIcon size={48} className="text-app-text-muted" />
                           <p className="text-xs font-black text-app-text-muted uppercase tracking-widest">No Image Asset Configured</p>
                        </div>
                      )}
                   </div>
                 )}

                 {(activeSlide.slideType === 'WORD' || activeSlide.slideType === 'SITUATION' || activeSlide.slideType === 'INSTRUCTIONS') && (
                    <h2 
                      style={{ 
                        fontSize: activeSlide.slideType === 'WORD' 
                          ? `calc(${fontSizeMultiplier} * 4.5rem)` 
                          : activeSlide.slideType === 'SITUATION'
                          ? `calc(${fontSizeMultiplier} * 2.25rem)`
                          : `calc(${fontSizeMultiplier} * 1.5rem)`
                      }}
                      className={cn(
                        "font-black text-app-text-bright tracking-tight font-sans whitespace-pre-wrap",
                        activeSlide.slideType === 'WORD' ? "" : "italic leading-tight max-w-3xl"
                      )}
                    >
                      {activeSlide.content || 'ENTER CONTENT...'}
                    </h2>
                 )}

                 {activeSlide.slideType === 'BLACKOUT' && (
                   <div className="absolute inset-0 bg-black flex items-center justify-center">
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[1em]">Darkness Interval</span>
                   </div>
                 )}

                 {activeSlide.slideType === 'BREAK' && (
                   <div className="flex flex-col items-center gap-6">
                      <Clock size={64} className="text-app-accent animate-pulse" />
                      <h2 
                        style={{ fontSize: `calc(${fontSizeMultiplier} * 2.5rem)` }}
                        className="text-4xl font-black text-app-text-bright uppercase tracking-tighter italic font-sans"
                      >
                        Evaluation Intermission
                      </h2>
                      <p 
                        style={{ fontSize: `calc(${fontSizeMultiplier} * 1.125rem)` }}
                        className="text-app-text-muted font-sans italic"
                      >
                        The protocol will resume shortly.
                      </p>
                   </div>
                 )}

                 <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                    <Clock size={16} className="text-app-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-app-text-bright">Visible for {activeSlide.displayTime} seconds</span>
                 </div>
               </>
             ) : (
               <div className="text-app-text-muted font-black uppercase tracking-widest">
                  Initialize Protocol Slide to Commence Editing
               </div>
             )}
          </div>
        </main>

        {/* Right Sidebar - Properties Panel */}
        <aside className="w-80 bg-app-sidebar border-l border-app-border shrink-0 flex flex-col">
          <div className="p-6 border-b border-app-border">
             <div className="flex items-center gap-2 mb-1">
                <Settings size={14} className="text-app-accent" />
                <span className="text-[10px] font-black text-app-text-bright uppercase tracking-[0.2em]">Intelligence Panel</span>
             </div>
             <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-tighter">Adjust slide parameters</div>
          </div>

          {activeSlide ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Assessment Meta (Visible when no slide is active or as a separate section) */}
              <div className="p-4 bg-app-card rounded-2xl border border-app-border space-y-4">
                 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest italic">Protocol Identity</div>
                 <div className="space-y-3">
                   <input 
                    type="text" 
                    value={assessment?.title || ''} 
                    onChange={(e) => setAssessment(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full bg-transparent border-b border-app-border py-1 text-xs font-black text-app-text-bright focus:outline-none focus:border-app-accent transition-all"
                    placeholder="Protocol Title"
                   />
                   <textarea 
                    value={assessment?.description || ''} 
                    onChange={(e) => setAssessment(prev => prev ? { ...prev, description: e.target.value } : null)}
                    rows={2}
                    className="w-full bg-transparent border-b border-app-border py-1 text-[10px] font-medium text-app-text-muted focus:outline-none focus:border-app-accent transition-all resize-none"
                    placeholder="Brief objective..."
                   />
                 </div>
              </div>

              {/* Slide Type Grid */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Modality Type</label>
                <div className="grid grid-cols-2 gap-2">
                   {[
                    { id: 'INSTRUCTIONS', label: 'Manual', icon: Type },
                    { id: 'IMAGE', label: 'Visual', icon: ImageIcon },
                    { id: 'WORD', label: 'Lexical', icon: MessageSquare },
                    { id: 'SITUATION', label: 'Context', icon: Layout },
                    { id: 'BREAK', label: 'Pause', icon: Clock },
                    { id: 'BLACKOUT', label: 'Void', icon: Shield }
                   ].map(type => (
                     <button
                      key={type.id}
                      onClick={() => updateSlide(activeSlide.id, { slideType: type.id as SlideType })}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                        activeSlide.slideType === type.id 
                          ? "bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white border-app-accent shadow-lg shadow-app-accent/20" 
                          : "bg-app-card border-app-border text-app-text-muted hover:text-app-text-bright"
                      )}
                     >
                       <type.icon size={20} />
                       <span className="text-[9px] font-black uppercase tracking-widest">{type.label}</span>
                     </button>
                   ))}
                </div>
              </div>

              {/* Dynamic Content Fields */}
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {(activeSlide.slideType === 'WORD' || activeSlide.slideType === 'SITUATION' || activeSlide.slideType === 'INSTRUCTIONS') && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Protocol Content</label>
                    <textarea 
                      value={activeSlide.content || ''}
                      onChange={(e) => updateSlide(activeSlide.id, { content: e.target.value })}
                      rows={4}
                      className="w-full bg-app-card border border-app-border rounded-2xl p-4 text-xs font-medium focus:outline-none focus:border-app-accent transition-all text-app-text-bright resize-none"
                      placeholder="Input the core data point..."
                    />
                  </div>
                )}

                {activeSlide.slideType === 'IMAGE' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Visual Asset URI</label>
                    <input 
                      type="text"
                      value={activeSlide.imageUrl || ''}
                      onChange={(e) => updateSlide(activeSlide.id, { imageUrl: e.target.value })}
                      className="w-full bg-app-card border border-app-border rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-app-accent transition-all text-app-text-bright"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Exposure Duration</label>
                    <span className="text-xs font-black text-app-accent">{activeSlide.displayTime}s</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={activeSlide.displayTime}
                    onChange={(e) => updateSlide(activeSlide.id, { displayTime: parseInt(e.target.value) })}
                    className="w-full accent-app-accent"
                  />
                  <div className="flex justify-between text-[8px] font-black text-app-text-muted uppercase">
                    <span>Instinct (1s)</span>
                    <span>Deliberate (60s)</span>
                  </div>
                </div>

                <div className="space-y-3 border-t border-app-border/40 pt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Typography Scale</label>
                    <span className="text-xs font-black text-app-accent">{Math.round(fontSizeMultiplier * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.6" 
                    max="1.8" 
                    step="0.05"
                    value={fontSizeMultiplier}
                    onChange={(e) => setFontSizeMultiplier(Number(e.target.value))}
                    className="w-full accent-app-accent"
                  />
                  <div className="flex justify-between text-[8px] font-black text-app-text-muted uppercase">
                    <span>Compact (60%)</span>
                    <span>Enlarged (180%)</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-app-border">
                <button 
                  onClick={() => deleteSlide(activeSlide.id)}
                  className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Purge Component
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 opacity-40">
               <Layout size={40} className="text-app-text-muted" />
               <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest leading-relaxed">
                 Select a protocol component to adjust neurological parameters
               </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AssessmentEditor;
