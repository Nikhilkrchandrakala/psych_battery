import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Assessment, AssessmentSlide, ModuleId } from '../types';

export const MODULE_ORDER: ModuleId[] = ['INTRO', 'TAT', 'WAT', 'SRT', 'SDT', 'CLOSING'];

export function useAssessmentData(id?: string, previewModule?: string | null) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [allSlides, setAllSlides] = useState<AssessmentSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const assessmentData = await api.assessments.get(id);
        setAssessment(assessmentData);
        
        const slidesList = await api.assessments.slides(id);
        setAllSlides(slidesList);
      } catch (err) {
        console.error('Failed to fetch assessment:', err);
        setError('Failed to load assessment data');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [id]);

  // Group slides by module
  const moduleSlideMap = useMemo(() => {
    const map: Record<ModuleId, AssessmentSlide[]> = { INTRO: [], TAT: [], WAT: [], SRT: [], SDT: [], CLOSING: [] };
    allSlides.forEach(s => {
      if (map[s.module]) map[s.module].push(s);
    });
    // Sort within each module
    Object.keys(map).forEach(k => map[k as ModuleId].sort((a, b) => (a.order || 0) - (b.order || 0)));
    return map;
  }, [allSlides]);

  // Only modules that have slides
  const activeModules = useMemo(() => {
    const modules = MODULE_ORDER.filter(m => moduleSlideMap[m].length > 0);
    if (previewModule && modules.includes(previewModule as ModuleId)) {
      return [previewModule as ModuleId];
    }
    return modules;
  }, [moduleSlideMap, previewModule]);

  return {
    assessment,
    allSlides,
    loading,
    error,
    moduleSlideMap,
    activeModules
  };
}
