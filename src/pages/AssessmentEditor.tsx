import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, SlideType, ModuleId, ModuleConfig } from '../types';
import { 
  Save, Plus, Trash2, ChevronUp, ChevronDown, 
  Image as ImageIcon, Type, MessageSquare, 
  Clock, Play, Settings, ArrowLeft, Loader2,
  Layout, Eye, Shield, Timer, Navigation
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const EditableContent: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      className={className}
      data-placeholder={placeholder}
      style={{ minHeight: '1em' }}
    />
  );
};

const TextFormatToolbar: React.FC = () => {
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-app-sidebar border border-app-border rounded-xl p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] z-50">
      <button onClick={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="w-10 h-10 hover:bg-white/10 rounded-lg text-app-text-bright transition-colors font-serif font-bold text-lg" title="Bold">B</button>
      <button onClick={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="w-10 h-10 hover:bg-white/10 rounded-lg text-app-text-bright transition-colors font-serif italic text-lg" title="Italic">I</button>
      <div className="w-px h-6 bg-app-border mx-2" />
      <button onClick={(e) => { e.preventDefault(); document.execCommand('fontSize', false, '7'); }} className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-app-text-bright transition-colors font-black text-sm" title="Large Text">A+</button>
      <button onClick={(e) => { e.preventDefault(); document.execCommand('fontSize', false, '3'); }} className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-app-text-bright transition-colors font-black text-xs" title="Normal Text">A-</button>
    </div>
  );
};

const MODULE_ORDER: ModuleId[] = ['INTRO', 'TAT', 'WAT', 'SRT', 'SDT', 'CLOSING'];

const MODULE_LABELS: Record<ModuleId, { label: string; shortLabel: string; color: string }> = {
  INTRO:   { label: 'Introduction',  shortLabel: 'Intro',  color: 'text-blue-400' },
  TAT:     { label: 'TAT',           shortLabel: 'TAT',    color: 'text-purple-400' },
  WAT:     { label: 'WAT',           shortLabel: 'WAT',    color: 'text-emerald-400' },
  SRT:     { label: 'SRT',           shortLabel: 'SRT',    color: 'text-amber-400' },
  SDT:     { label: 'SDT',           shortLabel: 'SDT',    color: 'text-rose-400' },
  CLOSING: { label: 'Closing',       shortLabel: 'Close',  color: 'text-zinc-400' },
};

const DEFAULT_MODULE_CONFIG: ModuleConfig = { timingMode: 'per-slide', globalDuration: 0, navigable: false };

const AssessmentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [allSlides, setAllSlides] = useState<AssessmentSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>('INTRO');
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const assessmentData = await api.assessments.get(id);
        setAssessment(assessmentData);

        const fetchedSlides = await api.assessments.slides(id);
        setAllSlides(fetchedSlides);

        // Set initial active module to one with slides
        const firstModuleWithSlides = MODULE_ORDER.find(m => 
          fetchedSlides.some((s: AssessmentSlide) => s.module === m)
        );
        if (firstModuleWithSlides) {
          setActiveModule(firstModuleWithSlides);
          const firstSlide = fetchedSlides.find((s: AssessmentSlide) => s.module === firstModuleWithSlides);
          if (firstSlide) setActiveSlideId(firstSlide.id);
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

  // Slides filtered by current module
  const moduleSlides = useMemo(() => 
    allSlides
      .filter(s => s.module === activeModule)
      .sort((a, b) => a.order - b.order),
    [allSlides, activeModule]
  );

  // Module slide counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    MODULE_ORDER.forEach(m => { counts[m] = allSlides.filter(s => s.module === m).length; });
    return counts;
  }, [allSlides]);

  const activeSlide = allSlides.find(s => s.id === activeSlideId);

  // Get current module config
  const currentModuleConfig: ModuleConfig = assessment?.modules?.[activeModule] || DEFAULT_MODULE_CONFIG;

  const updateModuleConfig = (updates: Partial<ModuleConfig>) => {
    if (!assessment) return;
    const updatedModules = { ...(assessment.modules || {}) };
    updatedModules[activeModule] = { ...currentModuleConfig, ...updates };
    setAssessment({ ...assessment, modules: updatedModules as Record<ModuleId, ModuleConfig> });
  };

  const addSlide = () => {
    const newSlide: AssessmentSlide = {
      id: `new-${Date.now()}`,
      assessmentId: id!,
      module: activeModule,
      slideType: activeModule === 'SRT' ? 'SITUATION' : 
                 activeModule === 'WAT' ? 'WORD' :
                 activeModule === 'TAT' ? 'IMAGE' : 'INSTRUCTIONS',
      content: activeModule === 'SRT' ? 'New situation...' :
               activeModule === 'WAT' ? 'WORD' : 'New Slide Content',
      displayTime: activeModule === 'WAT' ? 15 : activeModule === 'TAT' ? 30 : 5,
      order: 0, // Will be reassigned
    };

    const currentModuleSlides = allSlides
      .filter(s => s.module === activeModule)
      .sort((a, b) => a.order - b.order);

    const activeIndex = activeSlideId 
      ? currentModuleSlides.findIndex(s => s.id === activeSlideId)
      : currentModuleSlides.length - 1;

    const insertIndex = activeIndex >= 0 ? activeIndex + 1 : currentModuleSlides.length;
    
    currentModuleSlides.splice(insertIndex, 0, newSlide);
    const withNewOrders = currentModuleSlides.map((s, i) => ({ ...s, order: i }));

    const otherSlides = allSlides.filter(s => s.module !== activeModule);
    setAllSlides([...otherSlides, ...withNewOrders]);
    setActiveSlideId(newSlide.id);
  };

  const updateSlide = (slideId: string, updates: Partial<AssessmentSlide>) => {
    setAllSlides(prev => prev.map(s => s.id === slideId ? { ...s, ...updates } : s));
  };

  const deleteSlide = (slideId: string) => {
    const newAll = allSlides.filter(s => s.id !== slideId);
    // Reorder within module
    let moduleOrder = 0;
    const reordered = newAll.map(s => {
      if (s.module === activeModule) {
        return { ...s, order: moduleOrder++ };
      }
      return s;
    });
    setAllSlides(reordered);
    if (activeSlideId === slideId) {
      const remaining = reordered.filter(s => s.module === activeModule);
      setActiveSlideId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const moveSlide = (slideId: string, direction: 'up' | 'down') => {
    const currentModuleSlides = allSlides
      .filter(s => s.module === activeModule)
      .sort((a, b) => a.order - b.order);
    
    const index = currentModuleSlides.findIndex(s => s.id === slideId);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentModuleSlides.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...currentModuleSlides];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const withNewOrders = reordered.map((s, i) => ({ ...s, order: i }));

    // Merge back into allSlides
    const otherSlides = allSlides.filter(s => s.module !== activeModule);
    setAllSlides([...otherSlides, ...withNewOrders]);
  };

  const saveChanges = async () => {
    if (!id || !assessment) return;
    setSaving(true);
    try {
      // Update assessment (includes modules config)
      await api.assessments.update(id, assessment);

      // Save all slides batch (across all modules)
      const updatedSlides = await api.assessments.saveSlidesBatch(id, allSlides);
      setAllSlides(updatedSlides);
      
      setToast({ message: 'The Presentation has been saved.', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Failed to save changes:', error);
      setToast({ message: 'Failed to save. Check console for details.', type: 'error' });
      setTimeout(() => setToast(null), 4000);
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
    <div className="h-screen flex flex-col bg-app-bg text-app-text-main overflow-hidden font-sans relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={cn(
              "absolute top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-md",
              toast.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-red-500/20 border-red-500/30 text-red-400"
            )}
          >
            {toast.type === 'success' ? <Save size={16} /> : <Trash2 size={16} />}
            <span className="text-sm font-black tracking-wide">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
              {assessment?.title || 'Untitled Assessment'}
            </h1>
            <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-tighter">
              Assessment Editor — {allSlides.length} slides total
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(`/assessment/${id}?module=${activeModule}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-card border border-app-border text-xs font-black text-app-text-bright hover:bg-white/5 transition-all"
          >
            <Eye size={16} /> Preview Module
          </button>
          <button 
            onClick={() => navigate(`/assessment/${id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-card border border-app-border text-xs font-black text-app-text-bright hover:bg-white/5 transition-all"
          >
            <Eye size={16} /> Preview All
          </button>
          <button 
            onClick={saveChanges}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-app-accent/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Save
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar — Module Tabs + Slide List */}
        <aside className="w-72 bg-app-sidebar border-r border-app-border flex flex-col shrink-0">
          {/* Module Tabs */}
          <div className="p-3 border-b border-app-border">
            <div className="grid grid-cols-3 gap-1.5">
              {MODULE_ORDER.map(mod => (
                <button
                  key={mod}
                  onClick={() => {
                    setActiveModule(mod);
                    const firstSlide = allSlides.find(s => s.module === mod);
                    setActiveSlideId(firstSlide?.id || null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border transition-all text-center",
                    activeModule === mod
                      ? "bg-app-accent/10 border-app-accent shadow-[0_0_12px_-3px_rgba(var(--app-accent-rgb),0.3)]"
                      : "bg-app-card border-app-border hover:border-app-text-muted"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider",
                    activeModule === mod ? MODULE_LABELS[mod].color : "text-app-text-muted"
                  )}>
                    {MODULE_LABELS[mod].shortLabel}
                  </span>
                  <span className="text-[8px] font-bold text-app-text-muted">
                    {moduleCounts[mod]} slides
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Slide list header + add button */}
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
            <span className={cn("text-[10px] font-black uppercase tracking-[0.15em]", MODULE_LABELS[activeModule].color)}>
              {MODULE_LABELS[activeModule].label} Slides
            </span>
            <button 
              onClick={addSlide}
              className="p-1.5 hover:bg-app-accent hover:text-white rounded-lg text-app-accent border border-app-accent/20 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          
          {/* Slide thumbnails */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            <AnimatePresence initial={false}>
              {moduleSlides.map((slide, index) => (
                <motion.div
                  key={slide.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setActiveSlideId(slide.id)}
                  className={cn(
                    "group relative flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer",
                    activeSlideId === slide.id 
                      ? "bg-app-accent/10 border-app-accent shadow-[0_0_15px_-4px_rgba(var(--app-accent-rgb),0.3)]" 
                      : "bg-app-card border-app-border hover:border-app-text-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">
                      {index + 1}. {slide.slideType}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, 'up'); }} className="p-0.5 hover:text-app-text-bright"><ChevronUp size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, 'down'); }} className="p-0.5 hover:text-app-text-bright"><ChevronDown size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }} className="p-0.5 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  
                  <div className="h-14 rounded-lg bg-black/40 border border-app-border overflow-hidden flex items-center justify-center relative">
                    {slide.slideType === 'IMAGE' ? (
                      slide.imageUrl ? (
                        <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={14} className="text-app-text-muted" />
                      )
                    ) : (
                      <div className="text-[9px] font-bold text-app-text-muted text-center px-2 line-clamp-2">
                        {slide.slideType === 'WORD' ? slide.content : 
                         slide.slideType === 'BLACKOUT' ? '■ BLACKOUT' :
                         slide.slideType === 'BREAK' ? '⏸ BREAK' :
                         (slide.content || '').substring(0, 60)}
                      </div>
                    )}
                    <div className="absolute bottom-0.5 right-1 bg-black/60 px-1 py-0.5 rounded text-[7px] font-bold text-white">
                      {slide.displayTime}s
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {moduleSlides.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3 opacity-40">
                <Layout size={32} className="text-app-text-muted" />
                <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">
                  No slides in {MODULE_LABELS[activeModule].label}
                </p>
                <button 
                  onClick={addSlide}
                  className="text-[10px] font-black text-app-accent underline uppercase tracking-widest hover:opacity-80"
                >
                  Add First Slide
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center — Workspace Canvas */}
        <main className="flex-1 bg-black/30 p-8 overflow-y-auto flex items-center justify-center relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-6 text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">
             <span className={MODULE_LABELS[activeModule].color}>{MODULE_LABELS[activeModule].label} Module</span>
             <div className="h-px w-16 bg-app-border" />
             <span>Canvas Preview</span>
          </div>

          <div className="w-full max-w-4xl aspect-video bg-app-sidebar border border-app-border rounded-[2rem] shadow-[0_30px_80px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col items-center justify-center p-16 text-center relative group">
             {activeSlide ? (
               <>
                 {activeSlide.slideType === 'IMAGE' && (
                   <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      {activeSlide.imageUrl ? (
                        <img src={activeSlide.imageUrl} alt="Slide Content" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                      ) : (
                        <div className="p-10 bg-app-card rounded-2xl border-2 border-dashed border-app-border flex flex-col items-center gap-3">
                           <ImageIcon size={40} className="text-app-text-muted" />
                           <p className="text-xs font-black text-app-text-muted uppercase tracking-widest">No Image Configured</p>
                        </div>
                      )}
                   </div>
                 )}

                 {(activeSlide.slideType === 'WORD' || activeSlide.slideType === 'SITUATION' || activeSlide.slideType === 'INSTRUCTIONS') && (
                    <>
                      <TextFormatToolbar />
                      <EditableContent 
                        value={activeSlide.content || ''}
                        onChange={(val) => updateSlide(activeSlide.id, { content: val })}
                        placeholder="ENTER CONTENT..."
                        className={cn(
                          "font-black text-app-text-bright tracking-tight font-sans bg-transparent border-none outline-none text-center w-full focus:ring-0 focus:outline-none",
                          activeSlide.slideType === 'WORD' ? "text-7xl" : 
                          activeSlide.slideType === 'SITUATION' ? "text-2xl italic leading-relaxed max-w-4xl" :
                          "text-xl leading-relaxed max-w-4xl"
                        )}
                      />
                    </>
                 )}

                 {activeSlide.slideType === 'BLACKOUT' && (
                   <div className="absolute inset-0 bg-black flex items-center justify-center">
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[1em]">Darkness Interval</span>
                   </div>
                 )}

                 {activeSlide.slideType === 'BREAK' && (
                   <div className="flex flex-col items-center gap-4">
                      <Clock size={48} className="text-app-accent animate-pulse" />
                      <h2 className="text-3xl font-black text-app-text-bright uppercase tracking-tighter italic">Break</h2>
                      <p className="text-app-text-muted font-sans italic">Intermission period</p>
                   </div>
                 )}

                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <Clock size={14} className="text-app-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-app-text-bright">
                      {currentModuleConfig.timingMode === 'global' 
                        ? `Global: ${Math.floor(currentModuleConfig.globalDuration / 60)}min`
                        : `${activeSlide.displayTime}s per slide`
                      }
                    </span>
                 </div>
               </>
             ) : (
               <div className="text-app-text-muted font-black uppercase tracking-widest text-sm">
                  Select or add a slide to begin editing
               </div>
             )}
          </div>
        </main>

        {/* Right Sidebar — Properties Panel */}
        <aside className="w-80 bg-app-sidebar border-l border-app-border shrink-0 flex flex-col">
          <div className="p-5 border-b border-app-border">
             <div className="flex items-center gap-2 mb-1">
                <Settings size={14} className="text-app-accent" />
                <span className="text-[10px] font-black text-app-text-bright uppercase tracking-[0.15em]">Properties</span>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {/* Module Config Section */}
            <div className="p-4 bg-app-card rounded-xl border border-app-border space-y-4">
              <div className="flex items-center gap-2">
                <Timer size={14} className={MODULE_LABELS[activeModule].color} />
                <span className="text-[10px] font-black uppercase tracking-widest text-app-text-muted">
                  {MODULE_LABELS[activeModule].label} Module Settings
                </span>
              </div>

              {/* Timing Mode Toggle */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Timing Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateModuleConfig({ timingMode: 'per-slide' })}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all",
                      currentModuleConfig.timingMode === 'per-slide'
                        ? "bg-app-accent/15 border-app-accent text-app-accent"
                        : "bg-app-card border-app-border text-app-text-muted hover:text-app-text-bright"
                    )}
                  >
                    Per-Slide
                  </button>
                  <button
                    onClick={() => updateModuleConfig({ timingMode: 'global', globalDuration: currentModuleConfig.globalDuration || 1800 })}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all",
                      currentModuleConfig.timingMode === 'global'
                        ? "bg-app-accent/15 border-app-accent text-app-accent"
                        : "bg-app-card border-app-border text-app-text-muted hover:text-app-text-bright"
                    )}
                  >
                    Global Timer
                  </button>
                </div>
              </div>

              {/* Global Duration (only when global) */}
              {currentModuleConfig.timingMode === 'global' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Total Duration</label>
                    <span className="text-xs font-black text-app-accent">{Math.floor(currentModuleConfig.globalDuration / 60)} min</span>
                  </div>
                  <input 
                    type="range" min="60" max="3600" step="60"
                    value={currentModuleConfig.globalDuration}
                    onChange={(e) => updateModuleConfig({ globalDuration: parseInt(e.target.value) })}
                    className="w-full accent-app-accent"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-app-text-muted uppercase">
                    <span>1 min</span><span>60 min</span>
                  </div>
                </div>
              )}

              {/* Navigable Toggle */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => updateModuleConfig({ navigable: !currentModuleConfig.navigable })}
                  className={cn(
                    "w-8 h-5 rounded-full border transition-all relative",
                    currentModuleConfig.navigable
                      ? "bg-app-accent border-app-accent"
                      : "bg-app-card border-app-border"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all",
                    currentModuleConfig.navigable ? "left-[14px]" : "left-[3px]"
                  )} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Navigation size={12} className="text-app-text-muted" />
                  <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest group-hover:text-app-text-bright transition-colors">
                    Student Can Navigate
                  </span>
                </div>
              </label>
            </div>

            {/* Active Slide Properties */}
            {activeSlide ? (
              <>
                {/* Slide Type Grid */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Slide Type</label>
                  <div className="grid grid-cols-3 gap-1.5">
                     {[
                      { id: 'INSTRUCTIONS', label: 'Text', icon: Type },
                      { id: 'IMAGE', label: 'Image', icon: ImageIcon },
                      { id: 'WORD', label: 'Word', icon: MessageSquare },
                      { id: 'SITUATION', label: 'Situation', icon: Layout },
                      { id: 'BREAK', label: 'Break', icon: Clock },
                      { id: 'BLACKOUT', label: 'Blackout', icon: Shield }
                     ].map(type => (
                       <button
                        key={type.id}
                        onClick={() => updateSlide(activeSlide.id, { slideType: type.id as SlideType })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all",
                          activeSlide.slideType === type.id 
                            ? "bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white border-app-accent shadow-lg shadow-app-accent/20" 
                            : "bg-app-card border-app-border text-app-text-muted hover:text-app-text-bright"
                        )}
                       >
                         <type.icon size={16} />
                         <span className="text-[8px] font-black uppercase tracking-wider">{type.label}</span>
                       </button>
                     ))}
                  </div>
                </div>

                {/* Content Fields */}
                <div className="space-y-4">


                  {activeSlide.slideType === 'IMAGE' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Image URL</label>
                      <input 
                        type="text"
                        value={activeSlide.imageUrl || ''}
                        onChange={(e) => updateSlide(activeSlide.id, { imageUrl: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-app-accent transition-all text-app-text-bright"
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  {/* Duration (only for per-slide timing) */}
                  {currentModuleConfig.timingMode === 'per-slide' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Duration</label>
                        <span className="text-xs font-black text-app-accent">{activeSlide.displayTime}s</span>
                      </div>
                      <input 
                        type="range" min="1" max="900" 
                        value={activeSlide.displayTime}
                        onChange={(e) => updateSlide(activeSlide.id, { displayTime: parseInt(e.target.value) })}
                        className="w-full accent-app-accent"
                      />
                      <div className="flex justify-between text-[8px] font-bold text-app-text-muted uppercase">
                        <span>1s</span><span>15 min</span>
                      </div>
                    </div>
                  )}

                  {currentModuleConfig.timingMode === 'global' && (
                    <div className="p-3 bg-app-accent/5 border border-app-accent/20 rounded-xl">
                      <p className="text-[10px] font-bold text-app-accent italic">
                        ⏱ This module uses a global timer ({Math.floor(currentModuleConfig.globalDuration / 60)} min). 
                        Per-slide durations are ignored during the test.
                      </p>
                    </div>
                  )}
                </div>

                {/* Delete */}
                <div className="pt-4 border-t border-app-border">
                  <button 
                    onClick={() => deleteSlide(activeSlide.id)}
                    className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Delete Slide
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3 opacity-40">
                 <Layout size={32} className="text-app-text-muted" />
                 <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest leading-relaxed">
                   Select a slide to edit its properties
                 </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AssessmentEditor;
