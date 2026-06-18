import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, Assessment, UserProfile } from '../types';
import { useAuth } from '../components/AuthProvider';
import {
  ArrowLeft, FileText, Calendar, MessageSquare,
  User as UserIcon, Clock, ShieldCheck,
  CheckCircle2, Sparkles, AlertCircle, Maximize2,
  FileSearch, Layers, ChevronLeft, ChevronRight,
  Loader2, Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AssessmentMiniViewer } from './AssessmentMiniViewer';

// Base URL for serving uploaded files from the PsychBattery server
// The PsychBattery server (tsx server.ts) serves /uploads at the same port as the Vite dev server (5173)
const SERVER_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5173'
  : 'https://psych.ssbwithisv.in';

const PIQ_STATUS_STYLES: Record<string, string> = {
  PENDING:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
  PARSED:     'bg-green-500/10 text-green-400 border-green-500/20',
  FAILED:     'bg-red-500/10 text-red-400 border-red-500/20',
};

const PSYCH_TRAITS = {
  'Factor I: Planning & Organizing': {
    effective_intelligence: 'Effective Intelligence',
    reasoning_ability: 'Reasoning Ability',
    organizing_ability: 'Organizing Ability',
    power_of_expression: 'Power of Expression'
  },
  'Factor II: Social Adjustment': {
    social_adaptability: 'Social Adaptability',
    cooperation: 'Cooperation',
    sense_of_responsibility: 'Sense of Responsibility'
  },
  'Factor III: Social Effectiveness': {
    initiative: 'Initiative',
    self_confidence: 'Self Confidence',
    speed_of_decision: 'Speed of Decision',
    ability_to_influence_the_group: 'Influence the Group',
    liveliness: 'Liveliness'
  },
  'Factor IV: Dynamic': {
    determination: 'Determination',
    courage: 'Courage',
    stamina: 'Stamina'
  }
};

const SPECIALIZED_TRAITS = {
  Psych: PSYCH_TRAITS,
  GTO: PSYCH_TRAITS,
  IO: PSYCH_TRAITS,
  TO: PSYCH_TRAITS
};

const PSYCH_GRID_CONFIG = {
  factors: [
    { label: <>FACTOR I:<br/>PLANNING & ORGANIZING</>, colSpan: 4 },
    { label: <>FACTOR II:<br/>SOCIAL ADJUSTMENT</>, colSpan: 3 },
    { label: <>FACTOR III:<br/>SOCIAL EFFECTIVENESS</>, colSpan: 5 },
    { label: <>FACTOR IV:<br/>DYNAMIC</>, colSpan: 3 }
  ],
  traits: [
    { id: 'effective_intelligence', code: 'EI', num: 1, name: 'Effective Intelligence', factor: 'Factor I' },
    { id: 'reasoning_ability', code: 'RA', num: 2, name: 'Reasoning Ability', factor: 'Factor I' },
    { id: 'organizing_ability', code: 'OA', num: 3, name: 'Organizing Ability', factor: 'Factor I' },
    { id: 'power_of_expression', code: 'POE', num: 4, name: 'Power of Expression', factor: 'Factor I' },
    
    { id: 'social_adaptability', code: 'SA', num: 5, name: 'Social Adaptability', factor: 'Factor II' },
    { id: 'cooperation', code: 'COOP', num: 6, name: 'Cooperation', factor: 'Factor II' },
    { id: 'sense_of_responsibility', code: 'SOR', num: 7, name: 'Sense of Responsibility', factor: 'Factor II' },
    
    { id: 'initiative', code: 'INIT', num: 8, name: 'Initiative', factor: 'Factor III' },
    { id: 'self_confidence', code: 'SC', num: 9, name: 'Self Confidence', factor: 'Factor III' },
    { id: 'speed_of_decision', code: 'SOD', num: 10, name: 'Speed of Decision', factor: 'Factor III' },
    { id: 'ability_to_influence_the_group', code: 'AIG', num: 11, name: 'Influence Group', factor: 'Factor III' },
    { id: 'liveliness', code: 'LIV', num: 12, name: 'Liveliness', factor: 'Factor III' },
    
    { id: 'determination', code: 'D', num: 13, name: 'Determination', factor: 'Factor IV' },
    { id: 'courage', code: 'C', num: 14, name: 'Courage', factor: 'Factor IV' },
    { id: 'stamina', code: 'S', num: 15, name: 'Stamina', factor: 'Factor IV' }
  ]
};

const ASSESSOR_GRID_CONFIG = {
  Psych: PSYCH_GRID_CONFIG,
  GTO: PSYCH_GRID_CONFIG,
  IO: PSYCH_GRID_CONFIG,
  TO: PSYCH_GRID_CONFIG
};

interface ModernDateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ModernDateTimePicker: React.FC<ModernDateTimePickerProps> = ({ value, onChange, disabled }) => {
  const initialDate = value ? new Date(value) : new Date();
  
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  
  const [tempDate, setTempDate] = useState<Date | null>(value ? new Date(value) : null);
  const [selectedHour, setSelectedHour] = useState(tempDate ? tempDate.getHours() : 10);
  const [selectedMinute, setSelectedMinute] = useState(tempDate ? tempDate.getMinutes() : 0);
  
  const [isConfirmed, setIsConfirmed] = useState(!!value);
  const [isCollapsed, setIsCollapsed] = useState(!!value);

  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      setTempDate(parsed);
      setSelectedHour(parsed.getHours());
      setSelectedMinute(parsed.getMinutes());
      setIsConfirmed(true);
      setIsCollapsed(true);
    } else {
      setTempDate(null);
      setIsConfirmed(false);
      setIsCollapsed(false);
    }
  }, [value]);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const createDateObject = (day: number, hour: number, minute: number) => {
    const d = new Date();
    d.setFullYear(currentYear);
    d.setMonth(currentMonth);
    d.setDate(day);
    d.setHours(hour);
    d.setMinutes(minute);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
  };

  const handleDayClick = (day: number) => {
    const newDate = createDateObject(day, selectedHour, selectedMinute);
    setTempDate(newDate);
    setIsConfirmed(false);
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setIsConfirmed(false);
    
    if (tempDate) {
      const updatedDate = new Date(tempDate);
      updatedDate.setHours(hour);
      updatedDate.setMinutes(minute);
      setTempDate(updatedDate);
    } else {
      const today = new Date();
      const newDate = createDateObject(today.getDate(), hour, minute);
      setTempDate(newDate);
    }
  };

  const handleConfirm = () => {
    if (!tempDate) return;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedDateStr = `${tempDate.getFullYear()}-${pad(tempDate.getMonth() + 1)}-${pad(tempDate.getDate())}T${pad(selectedHour)}:${pad(selectedMinute)}`;
    onChange(formattedDateStr);
    setIsConfirmed(true);
    setIsCollapsed(true);
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const TIME_SLOTS = [
    { label: '09:00 AM', h: 9, m: 0 },
    { label: '10:00 AM', h: 10, m: 0 },
    { label: '11:00 AM', h: 11, m: 0 },
    { label: '12:00 PM', h: 12, m: 0 },
    { label: '02:00 PM', h: 14, m: 0 },
    { label: '03:00 PM', h: 15, m: 0 },
    { label: '04:00 PM', h: 16, m: 0 },
    { label: '05:00 PM', h: 17, m: 0 },
    { label: '06:00 PM', h: 18, m: 0 },
  ];

  const isSelectedDay = (day: number) => {
    return tempDate && 
           tempDate.getDate() === day && 
           tempDate.getMonth() === currentMonth && 
           tempDate.getFullYear() === currentYear;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === currentMonth && 
           today.getFullYear() === currentYear;
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (isCollapsed && tempDate) {
    return (
      <div className="bg-app-card border border-green-500/20 rounded-3xl p-5 shadow-xl flex items-center justify-between animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-app-text-muted tracking-wider">Confirmed Meeting Time</div>
            <div className="text-base font-black text-app-text-bright tracking-tight mt-0.5">
              {tempDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="px-4 py-2 bg-black/40 border border-app-border hover:border-app-accent hover:text-app-accent text-app-text-muted text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-xl space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-app-text-bright tracking-wider">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h4>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-xl bg-black/30 border border-app-border hover:border-app-accent hover:text-app-accent transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-xl bg-black/30 border border-app-border hover:border-app-accent hover:text-app-accent transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-app-text-muted tracking-widest">
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="p-2" />;
              }
              const selected = isSelectedDay(day);
              const today = isToday(day);

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "p-2 rounded-xl text-center transition-all cursor-pointer relative font-bold",
                    selected 
                      ? "bg-app-accent text-black font-black shadow-lg" 
                      : today 
                        ? "bg-app-accent/10 border border-app-accent/40 text-app-accent" 
                        : "hover:bg-white/5 text-app-text-bright"
                  )}
                >
                  {day}
                  {today && !selected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-app-accent rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-app-border/40 pt-6 md:pt-0 md:pl-6 space-y-4">
          <h4 className="text-xs font-black uppercase text-app-text-bright tracking-wider">
            Select Time
          </h4>

          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map((slot) => {
              const active = selectedHour === slot.h && selectedMinute === slot.m;
              return (
                <button
                  key={slot.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTimeChange(slot.h, slot.m)}
                  className={cn(
                    "py-2 px-3 rounded-xl text-[10px] font-black tracking-wider transition-all cursor-pointer text-center",
                    active 
                      ? "bg-app-accent text-black shadow-lg" 
                      : "bg-black/35 border border-app-border text-app-text-muted hover:text-app-text-bright hover:border-app-accent/50"
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Custom Time</span>
            <div className="flex items-center gap-2">
              <select
                value={selectedHour}
                onChange={(e) => handleTimeChange(parseInt(e.target.value, 10), selectedMinute)}
                className="flex-1 bg-black/45 border border-app-border rounded-xl p-2 text-xs text-app-text-bright focus:outline-none focus:border-app-accent font-bold"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i} className="bg-app-sidebar text-white">
                    {i === 0 ? '12 AM (00:00)' : i === 12 ? '12 PM (12:00)' : i > 12 ? `${i - 12} PM (${pad(i)}:00)` : `${i} AM (${pad(i)}:00)`}
                  </option>
                ))}
              </select>
              <span className="text-app-text-muted font-bold">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => handleTimeChange(selectedHour, parseInt(e.target.value, 10))}
                className="flex-1 bg-black/45 border border-app-border rounded-xl p-2 text-xs text-app-text-bright focus:outline-none focus:border-app-accent font-bold"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i * 5} value={i * 5} className="bg-app-sidebar text-white">
                    {pad(i * 5)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-app-border/40 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="text-xs text-app-text-bright font-serif italic text-left w-full sm:w-auto">
          {tempDate ? (
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-app-text-muted not-italic tracking-wider">Selected Session:</span>
              <span className="font-sans font-black uppercase text-app-accent tracking-wider text-sm mt-0.5">
                {tempDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ) : (
            <span className="text-app-text-muted">No date & time selected yet.</span>
          )}
        </div>
        
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !tempDate || isConfirmed}
          className={cn(
            "w-full sm:w-auto px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer",
            isConfirmed 
              ? "bg-green-500/10 text-green-400 border border-green-500/25 cursor-default" 
              : "bg-app-accent text-black hover:scale-102 hover:shadow-lg active:scale-98"
          )}
        >
          {isConfirmed ? (
            <>
              <CheckCircle2 size={14} className="text-green-400" /> Confirmed
            </>
          ) : (
            "Confirm Date & Time"
          )}
        </button>
      </div>
    </div>
  );
};

const SubmissionReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [student, setStudent] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'dossier' | 'evaluation' | 'meeting' | 'feedback'>('dossier');
  const [showEthicsModal, setShowEthicsModal] = useState(() => {
    return localStorage.getItem('ssb_ethics_agreed') !== 'true';
  });
  const [doNotShowEthics, setDoNotShowEthics] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  
  // Attempted Psych Battery details state
  const [loadingSlides, setLoadingSlides] = useState(false);

  // Dossier viewer state
  const [activePiqIndex, setActivePiqIndex] = useState(0);
  const [activeAnswerIndex, setActiveAnswerIndex] = useState(0);
  const [viewerMode, setViewerMode] = useState<'piq' | 'dossier'>('piq');
  const [selectedPiqTab, setSelectedPiqTab] = useState<'piq1' | 'piq2'>('piq1');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    setActivePiqIndex(0);
  }, [viewerMode, selectedPiqTab]);

  // Form states
  const [remarks, setRemarks] = useState('');
  const [scores, setScores] = useState<Record<string, number | string>>({});
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  const [activeAssessorType, setActiveAssessorType] = useState<'Psych' | 'GTO' | 'TO' | 'IO'>('Psych');

  useEffect(() => {
    if (profile?.assessorType) {
      setActiveAssessorType(profile.assessorType);
    }
  }, [profile]);

  // Tab and index redirection based on assessor role
  useEffect(() => {
    if (activeAssessorType === 'GTO') {
      setActiveTab('evaluation');
    } else {
      setActiveTab('dossier');
    }

    if (activeAssessorType === 'IO') {
      setViewerMode('piq');
      setSelectedPiqTab('piq2');
      setActivePiqIndex(0);
    } else {
      setActivePiqIndex(0);
    }
  }, [activeAssessorType]);

  const showRoleToggle = !profile?.assessorType;

  // Determine if the current active assessor has finalized their evaluation
  const isAssessorCompleted = (() => {
    if (!submission) return false;
    const prefix = activeAssessorType.toLowerCase();
    const statusField = `${prefix}Status`;
    return (submission as any)[statusField] === 'COMPLETED';
  })();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const subData = await api.submissions.get(id);

        // The server populates userId → { name, email } and assessmentId → { title, duration }
        // Extract the embedded objects directly — no separate API calls needed
        const populatedStudent = subData.userId && typeof subData.userId === 'object'
          ? subData.userId
          : null;
        const populatedAssessment = subData.assessmentId && typeof subData.assessmentId === 'object'
          ? subData.assessmentId
          : null;

        // Normalize the submission: replace populated objects with their IDs for state
        const normalizedSub = {
          ...subData,
          userId: populatedStudent?._id || populatedStudent?.id || subData.userId,
          assessmentId: populatedAssessment?._id || populatedAssessment?.id || subData.assessmentId,
        };

        setSubmission(normalizedSub);
        setRemarks(subData.assessorRemarks || '');
        const roleScoresField = `${activeAssessorType.toLowerCase()}Scores`;
        const roleScores = (subData as any)[roleScoresField];
        if (roleScores && Object.keys(roleScores).length > 0) {
          setScores(roleScores);
        } else {
          const initialScores: Record<string, number | string> = {};
          Object.values(SPECIALIZED_TRAITS).forEach(groups => {
            Object.values(groups).forEach(traits => {
              Object.keys(traits).forEach(k => {
                initialScores[k] = 0;
              });
            });
          });
          setScores(initialScores);
        }
        // Use populated data directly — avoids permission errors and wrong ID lookups
        if (populatedStudent) {
          setStudent(populatedStudent);
        }
        if (populatedAssessment) {
          setAssessment(populatedAssessment);
        }
      } catch (error) {
        console.error('Failed to fetch review data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!submission) return;
    if (activeAssessorType === 'Psych') {
      setRemarks(submission.psychRemarks || submission.assessorRemarks || '');
    } else if (activeAssessorType === 'GTO') {
      setRemarks((submission as any).gtoRemarks || '');
    } else if (activeAssessorType === 'IO') {
      setRemarks((submission as any).ioRemarks || '');
    } else if (activeAssessorType === 'TO') {
      setRemarks((submission as any).toRemarks || '');
    }

    const roleScoresField = `${activeAssessorType.toLowerCase()}Scores`;
    const roleScores = (submission as any)[roleScoresField];
    if (roleScores && Object.keys(roleScores).length > 0) {
      setScores(roleScores);
    } else {
      const initialScores: Record<string, number | string> = {};
      Object.values(SPECIALIZED_TRAITS).forEach(groups => {
        Object.values(groups).forEach(traits => {
          Object.keys(traits).forEach(k => {
            initialScores[k] = 0;
          });
        });
      });
      setScores(initialScores);
    }

    // Role-based meeting link logic
    const prefix = activeAssessorType.toLowerCase();
    const sub = submission as any;
    const dateField = sub[`${prefix}MeetingDate`];
    const linkField = sub[`${prefix}MeetingLink`];

    if (dateField) {
      const date = new Date(dateField);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const localDateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      setMeetingDate(localDateStr);
    } else {
      setMeetingDate('');
    }
    setMeetingLink(linkField || '');
  }, [activeAssessorType, submission]);

  const handleUploadRemarks = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: any = {};
      if (activeAssessorType === 'Psych') {
        updateData.psychRemarks = remarks;
        updateData.assessorRemarks = remarks; // Sync compatibility
      } else if (activeAssessorType === 'GTO') {
        updateData.gtoRemarks = remarks;
      } else if (activeAssessorType === 'IO') {
        updateData.ioRemarks = remarks;
      } else if (activeAssessorType === 'TO') {
        updateData.toRemarks = remarks;
      }
      await api.submissions.update(id, updateData);
      setSubmission(prev => prev ? { ...prev, ...updateData } : null);
      alert("Remarks uploaded successfully to Super Admin.");

    } catch (error) {
      console.error('Failed to upload remarks:', error);
      alert('Failed to upload remarks.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMarks = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updateData: any = {
        [`${activeAssessorType.toLowerCase()}Scores`]: scores,
      };
      await api.submissions.update(id, updateData);
      setSubmission(prev => prev ? { ...prev, ...updateData } : null);
      alert("Marks uploaded successfully to Super Admin.");
    } catch (error) {
      console.error('Failed to upload marks:', error);
      alert('Failed to upload marks.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (status: AssessmentSubmission['status']) => {
    if (!id) return;
    
    // Strict completeness check for finalizing evaluations
    const currentGridConfig = ASSESSOR_GRID_CONFIG[activeAssessorType] || ASSESSOR_GRID_CONFIG.Psych;
    const isCompleted = status === 'COMPLETED';

    if (isCompleted) {
      const unfilledTraits = currentGridConfig.traits.filter(t => !scores[t.id] || scores[t.id] === 0);
      const unfilledMarks = !scores.marks || scores.marks === 0;
      
      if (unfilledTraits.length > 0 || unfilledMarks) {
        alert(
          `Verification Failed:\n\nPlease assign grades to all traits and fill in the Overall Marks before finalizing the evaluation.\n\n` +
          `• Unassigned traits: ${unfilledTraits.map(t => t.code).join(', ') || 'None'}\n` +
          `• Overall Marks: ${unfilledMarks ? 'Missing' : 'Filled'}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const updateData: any = {
        [`${activeAssessorType.toLowerCase()}Scores`]: scores,
      };

      // Isolated status and remarks routing
      if (activeAssessorType === 'Psych') {
        updateData.psychRemarks = remarks;
        updateData.psychStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
        updateData.assessorRemarks = remarks; // Sync compatibility
      } else if (activeAssessorType === 'GTO') {
        updateData.gtoRemarks = remarks;
        updateData.gtoStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      } else if (activeAssessorType === 'IO') {
        updateData.ioRemarks = remarks;
        updateData.ioStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      } else if (activeAssessorType === 'TO') {
        updateData.toRemarks = remarks;
        updateData.toStatus = isCompleted ? 'COMPLETED' : 'UNDER_REVIEW';
      }

      // Calculate main submission status transition intelligently
      let allFinished = true;
      if (student) {
        if (student.assignedPsych && activeAssessorType !== 'Psych' && submission?.psychStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedGTO && activeAssessorType !== 'GTO' && (submission as any)?.gtoStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedIO && activeAssessorType !== 'IO' && (submission as any)?.ioStatus !== 'COMPLETED') allFinished = false;
        if (student.assignedTO && activeAssessorType !== 'TO' && (submission as any)?.toStatus !== 'COMPLETED') allFinished = false;
      }

      if (isCompleted && allFinished) {
        updateData.status = 'COMPLETED';
      } else {
        updateData.status = 'REVIEW_PENDING';
      }

      const prefix = activeAssessorType.toLowerCase();
      if (meetingDate) updateData[`${prefix}MeetingDate`] = new Date(meetingDate).toISOString();
      if (meetingLink) updateData[`${prefix}MeetingLink`] = meetingLink;
      
      if (status === 'MEETING_SCHEDULED') {
        updateData.triggerEmail = true;
        updateData.meetingRole = prefix;
      }

      await api.submissions.update(id, updateData);
      setSubmission(prev => prev ? { ...prev, ...updateData } : null);

      if (isCompleted) {
        navigate('/assessor');
      } else if (status === 'MEETING_SCHEDULED') {
        setShowMeetingModal(true);
      }
    } catch (error) {
      console.error('Failed to update submission:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPiq = async (piqType: 'piq1' | 'piq2') => {
    try {
      const fieldName = `${piqType}Status`;
      const updatePayload: any = { [fieldName]: 'VERIFIED' };
      // Also update piqStatus compatibility for piq1
      if (piqType === 'piq1') {
        updatePayload.piqStatus = 'PARSED';
      }
      const updated = await api.submissions.update(id!, updatePayload);
      setSubmission(prev => prev ? { ...prev, ...updated } : null);
      alert(`${piqType === 'piq2' ? 'PIQ 2 (Final)' : 'PIQ 1 (Initial)'} has been verified.`);
    } catch (err) {
      console.error(err);
      alert("Failed to verify PIQ.");
    }
  };

  const buildFileUrl = (path: string, globalIndex?: number) => {
    if (path.startsWith('db://')) {
      const token = localStorage.getItem('auth_token');
      // If path is db:// and we have a global index, use it. Otherwise find index in piqFiles.
      const idx = globalIndex !== undefined ? globalIndex : (submission?.piqFiles || []).indexOf(path);
      const safeIdx = idx !== -1 ? idx : 0;
      return `${SERVER_BASE}/api/submissions/${id}/piq-file/${safeIdx}?token=${token}`;
    }
    
    let url = path;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && url.startsWith('https://api.ssbwithisv.in')) {
      url = url.replace('https://api.ssbwithisv.in', 'http://localhost:5001');
    }
    
    if (url.startsWith('http')) return url;
    return `${SERVER_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const isPdf = (path: string) => path.toLowerCase().endsWith('.pdf');

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!submission) return (
    <div className="text-app-text-bright p-12 text-center">Protocol record not identified.</div>
  );

  const piqFiles: string[] = (submission as any).piqFiles || [];
  const answerFiles: string[] = submission.uploadedFiles || [];
  const isDossierUploaded = answerFiles.length > 0;
  const piqStatus: string = (submission as any).piqStatus || 'PENDING';
  const ocrTranscript: string = (submission as any).piqParsedData || '';

  // Graceful fallbacks if population was incomplete
  const studentName = student?.name || 'Candidate';
  const studentEmail = student?.email || '';
  const assessmentTitle = assessment?.title || 'Assessment';
  const assessmentDuration = (assessment as any)?.duration || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button
            onClick={() => navigate('/assessor')}
            className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
          >
            <ArrowLeft size={14} /> Back to Candidates
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
              {student?.profileImage ? (
                <img src={student.profileImage} alt={studentName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={32} className="text-app-text-muted" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tighter text-app-text-bright">{studentName}</h1>
                <span className="px-2.5 py-1 rounded-lg bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-[0.15em] text-app-text-bright whitespace-nowrap">
                  Batch: {student?.batch || '--'} | Chest: {student?.chestNo || '--'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">{assessmentTitle}</span>
                <span className="w-1 h-1 bg-app-border rounded-full" />
                <span className="px-2 py-0.5 rounded bg-app-accent/10 border border-app-accent/20 text-[9px] font-black text-app-accent uppercase tracking-[0.15em] leading-none">
                  {submission.status.replace(/_/g, ' ')}
                </span>

              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-3">
            {isAssessorCompleted ? (
              <div className="px-6 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={16} />
                Evaluation Finalized & Locked
              </div>
            ) : (
                <button
                  onClick={() => handleUpdate('COMPLETED')}
                  disabled={saving || ((activeAssessorType === 'Psych' || activeAssessorType === 'TO') && !isDossierUploaded)}
                  className="px-6 py-3 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Finalize Evaluation
                </button>
            )}
          </div>
          
          {/* Temporal Markers */}
          <div className="flex items-center gap-4 text-[10px] font-black text-app-text-muted uppercase tracking-wider px-1">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-app-text-muted/65" />
              <span>Started: {submission?.startedAt || submission?.createdAt ? new Date(submission.startedAt || submission.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
            </div>
            {submission?.completedAt && (
              <div className="flex items-center gap-1.5 text-app-accent">
                <ShieldCheck size={12} className="text-app-accent" />
                <span>Sealed: {new Date(submission.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs and Sidebar Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-1 bg-app-sidebar/50 p-1 rounded-2xl border border-app-border w-fit shadow-inner">
          {[
            { id: 'dossier', label: 'Document Viewer', icon: FileSearch },
            { id: 'meeting', label: activeAssessorType === 'IO' ? 'Mock Interview' : 'Feedback Scheduler', icon: Calendar },
            { id: 'evaluation', label: 'Assessment', icon: MessageSquare },
            ...(submission.status === 'REPORT_RELEASED' ? [{ id: 'feedback', label: 'All Assessor Feedback', icon: Users }] : [])
          ].filter(tab => {
            if (activeAssessorType === 'GTO' && tab.id === 'dossier') return false;
            if (tab.id === 'meeting' && !['Psych', 'TO', 'IO'].includes(activeAssessorType)) return false;
            return true;
          }).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2.5 rounded-[0.85rem] text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
                activeTab === tab.id ? "bg-app-accent text-white shadow-xl" : "text-app-text-muted hover:text-app-text-bright"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'dossier' && viewerMode === 'dossier' && (activeAssessorType === 'Psych' || activeAssessorType === 'TO') && assessment && (
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-4 py-2.5 rounded-2xl bg-app-card border border-app-border text-[10px] font-black uppercase tracking-widest text-app-text-muted hover:text-app-text-bright hover:border-app-accent/50 transition-all flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
          >
            <Maximize2 size={14} className="text-app-accent" />
            {showSidebar ? 'Hide Test Preview' : 'Show Test Preview'}
          </button>
        )}
      </div>

      {/* Main Content Area: 2-Column Layout */}
      <div className={cn(
        "grid gap-8 items-start",
        (activeTab === 'dossier' && viewerMode === 'dossier' && (activeAssessorType === 'Psych' || activeAssessorType === 'TO') && assessment && showSidebar)
          ? "grid-cols-1 lg:grid-cols-2" 
          : "grid-cols-1"
      )}>
        
        {/* LEFT COLUMN: Tabs Content */}
        <div className="space-y-8 min-w-0">
          {/* Awaiting Dossier Warning Banner */}
          {((activeAssessorType === 'Psych' || activeAssessorType === 'TO') && !isDossierUploaded) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              Awaiting Candidate Dossier Upload: Meeting scheduling and assessment uploads are disabled until the candidate uploads their dossier.
            </div>
          )}
          
          {/* ── DOSSIER VIEWER TAB ─────────────────────────────────────────── */}
          {activeTab === 'dossier' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Selector Tabs at the Top */}
              {activeAssessorType !== 'IO' && (
                <div className="flex gap-2 bg-app-card/30 p-1 border border-app-border rounded-2xl w-fit">
                  <button
                    type="button"
                    onClick={() => setViewerMode('piq')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      viewerMode === 'piq'
                        ? "bg-app-accent text-white shadow-lg"
                        : "text-app-text-muted hover:text-app-text-bright"
                    )}
                  >
                    PIQ Forms ({piqFiles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewerMode('dossier')}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      viewerMode === 'dossier'
                        ? "bg-app-accent text-white shadow-lg"
                        : "text-app-text-muted hover:text-app-text-bright"
                    )}
                  >
                    Dossier Sheets ({answerFiles.length})
                  </button>
                </div>
              )}

              {/* Dynamic View Section */}
              {(() => {
                const piq1Files = piqFiles.filter(f => f.includes('/piq1_') || !f.includes('/piq2_'));
                const piq2Files = piqFiles.filter(f => f.includes('/piq2_'));
                const activeFiles = viewerMode === 'piq' 
                  ? (selectedPiqTab === 'piq1' ? piq1Files : piq2Files) 
                  : answerFiles;
                  
                const sectionTitle = viewerMode === 'piq' 
                  ? (selectedPiqTab === 'piq1' ? 'Initial Assessment PIQ (PIQ 1)' : 'Final/Interview Prep PIQ (PIQ 2)') 
                  : 'Completed Psychology Dossier';
                  
                const noFileText = viewerMode === 'piq' 
                  ? `No files uploaded yet for ${selectedPiqTab === 'piq1' ? 'PIQ 1' : 'PIQ 2'}.` 
                  : 'No Dossier sheets uploaded yet by the candidate.';

                const isAssessorAuthorized = ['Psych', 'TO'].includes(activeAssessorType) || profile?.role === 'admin' || profile?.role === 'owner';
                const currentStatus = selectedPiqTab === 'piq1' 
                  ? (submission as any).piq1Status || (piq1Files.length > 0 ? 'VERIFIED' : 'PENDING') 
                  : (submission as any).piq2Status || 'PENDING';

                return (
                  <div className="space-y-4">
                    {viewerMode === 'piq' && activeAssessorType !== 'IO' && (
                      <div className="flex gap-2 p-1 bg-black/30 border border-app-border rounded-xl w-fit">
                        <button
                          type="button"
                          onClick={() => setSelectedPiqTab('piq1')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                            selectedPiqTab === 'piq1' ? "bg-app-accent text-white shadow" : "text-app-text-muted hover:text-app-text-bright"
                          )}
                        >
                          PIQ 1: Initial Assessment [{piq1Files.length}]
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPiqTab('piq2')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                            selectedPiqTab === 'piq2' ? "bg-app-accent text-white shadow" : "text-app-text-muted hover:text-app-text-bright"
                          )}
                        >
                          PIQ 2: Final/Interview Prep [{piq2Files.length}]
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 border-b border-app-border pb-3">
                      <FileText className="text-app-accent" size={20} />
                      <h2 className="text-sm font-black text-app-text-bright uppercase tracking-widest">{sectionTitle}</h2>
                      
                      {viewerMode === 'piq' && (
                        <>
                          <span className={cn('px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest', 
                            currentStatus === 'VERIFIED' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}>
                            Status: {currentStatus}
                          </span>
                          {currentStatus !== 'VERIFIED' && activeFiles.length > 0 && isAssessorAuthorized && (
                            <button
                              type="button"
                              onClick={() => handleVerifyPiq(selectedPiqTab)}
                              className="ml-auto px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow"
                            >
                              Verify {selectedPiqTab === 'piq1' ? 'PIQ 1' : 'PIQ 2'}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {activeFiles.length > 0 ? (
                      <div className="flex flex-col gap-8">
                        {/* Top: PDF / Image Viewer */}
                        <div className="w-full space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2">
                            <span>{viewerMode === 'piq' && activeAssessorType === 'IO' ? 'Personal Information Questionnaire (PIQ)' : `File ${activePiqIndex + 1} of ${activeFiles.length}`}</span>
                            {(viewerMode !== 'piq' || activeAssessorType !== 'IO') && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActivePiqIndex(i => Math.max(0, i - 1))}
                                  disabled={activePiqIndex === 0}
                                  className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivePiqIndex(i => Math.min(activeFiles.length - 1, i + 1))}
                                  disabled={activePiqIndex === activeFiles.length - 1}
                                  className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent/50 disabled:opacity-30 transition-all"
                                >
                                  <ChevronRight size={12} />
                                </button>
                                <a
                                  href={buildFileUrl(activeFiles[activePiqIndex], piqFiles.indexOf(activeFiles[activePiqIndex]))}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-accent text-app-text-muted hover:text-app-accent transition-all"
                                  title="Open full screen"
                                >
                                  <Maximize2 size={12} />
                                </a>
                              </div>
                            )}
                          </div>

                          <div className="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-2xl" style={{ height: '720px' }}>
                            {isPdf(activeFiles[activePiqIndex]) ? (
                              <iframe
                                key={`${viewerMode}-${selectedPiqTab}-${activePiqIndex}`}
                                src={`${buildFileUrl(activeFiles[activePiqIndex], piqFiles.indexOf(activeFiles[activePiqIndex]))}#toolbar=0&navpanes=0`}
                                className="w-full h-full border-0"
                                title={`${viewerMode} Document ${activePiqIndex + 1}`}
                              />
                            ) : (
                              <img
                                key={`${viewerMode}-${selectedPiqTab}-${activePiqIndex}`}
                                src={buildFileUrl(activeFiles[activePiqIndex], piqFiles.indexOf(activeFiles[activePiqIndex]))}
                                alt={`${viewerMode} Page ${activePiqIndex + 1}`}
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>

                          {/* File tabs if multiple */}
                          {activeFiles.length > 1 && (viewerMode !== 'piq' || activeAssessorType !== 'IO') && (
                            <div className="flex gap-2 flex-wrap">
                              {activeFiles.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setActivePiqIndex(i)}
                                  className={cn(
                                    'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all',
                                    i === activePiqIndex
                                      ? 'bg-app-accent text-white border-app-accent'
                                      : 'bg-app-card text-app-text-muted border-app-border hover:border-app-accent/50'
                                  )}
                                >
                                  {viewerMode === 'piq' ? (i === 0 ? 'PIQ Page 1' : 'PIQ Page 2') : `Page ${i + 1}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-app-sidebar border border-app-border border-dashed rounded-[3rem] p-20 text-center opacity-50 space-y-4">
                        <FileText size={48} className="mx-auto text-app-border" />
                        <p className="text-app-text-muted font-serif italic text-xl">{noFileText}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

      {/* ── CLINICAL REMARKS TAB ─────────────────────────────────────── */}
      {activeTab === 'evaluation' && (() => {
        const gridConfig = ASSESSOR_GRID_CONFIG[activeAssessorType] || ASSESSOR_GRID_CONFIG.Psych;
        return (
          <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Evaluation Card */}
            <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-8 w-full">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-app-accent">
                  <Sparkles size={24} className="fill-current" />
                  <h3 className="text-2xl font-black text-app-text-bright tracking-tight">
                    {activeAssessorType === 'Psych' ? 'Psychologist Evaluation Suite' :
                     activeAssessorType === 'GTO' ? 'GTO Case Scorecard' :
                     activeAssessorType === 'IO' ? 'Interview Assessment Dossier' :
                     'Technical Aptitude Evaluation'}
                  </h3>
                </div>
                <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                  Record your detailed observations and clinical/professional grades for the allotted candidate below.
                </p>
              </div>

              {showRoleToggle && (
                <div className="space-y-2">
                  <div className="text-[9px] font-black text-app-text-muted uppercase tracking-widest px-1">Testing Role Selector (Preview Mode)</div>
                  <div className="flex gap-2 p-1 bg-app-card border border-app-border rounded-xl w-fit">
                    {(['Psych', 'GTO', 'IO', 'TO'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setActiveAssessorType(t)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all",
                          activeAssessorType === t 
                            ? "bg-app-accent text-black shadow-sm" 
                            : "text-app-text-muted hover:text-app-text-bright"
                        )}
                      >
                        {t === 'Psych' ? 'Psychologist' : t === 'GTO' ? 'GTO Assessor' : t === 'IO' ? 'Interviewing Officer' : 'Technical Officer'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {/* Remarks Textarea */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Comprehensive Remarks & Dossier Analysis</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={isAssessorCompleted}
                    placeholder={
                      activeAssessorType === 'Psych' ? 'Enter comprehensive psychological profile and timeline analysis...' :
                      activeAssessorType === 'GTO' ? 'Enter GTO group dynamic behavior and outdoor performance marks...' :
                      activeAssessorType === 'IO' ? 'Enter comprehensive personal interview assessment and motivations...' :
                      'Enter technical aptitude, analytical comprehension, and structural thinking...'
                    }
                    rows={6}
                    className="w-full bg-app-card border border-app-border rounded-3xl p-6 text-app-text-bright font-serif text-lg italic focus:outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent/20 transition-all placeholder:text-app-text-muted/30"
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleUploadRemarks}
                      disabled={saving || isAssessorCompleted || ((activeAssessorType === 'Psych' || activeAssessorType === 'TO') && !isDossierUploaded)}
                      className="px-6 py-2.5 bg-app-card border border-app-border hover:border-app-accent text-app-text-bright rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Upload Remarks
                    </button>
                  </div>
                </div>

                {/* Scoring Table Row */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-app-accent uppercase tracking-[0.2em] px-2 block">
                    TICKS and MARKS
                  </label>

                    <div className="w-full bg-app-card border border-app-border rounded-3xl overflow-hidden shadow-xl">
                      <div className="w-full overflow-hidden">
                        {(() => {
                          const traineeWidth = 'w-[13%]';
                          const marksWidth = 'w-[9%]';
                          const traitWidth = 'w-[5.2%]';
                          
                          return (
                            <table className="w-full border-collapse text-left table-fixed">
                              <colgroup>
                                <col className={traineeWidth} />
                                {gridConfig.traits.map((t) => (
                                  <col key={t.id} className={traitWidth} />
                                ))}
                                <col className={marksWidth} />
                              </colgroup>
                              <thead>
                                {/* Factor Headers Row */}
                                <tr className="bg-black/30 border-b border-app-border divide-x divide-app-border/40 text-xs font-black text-app-accent uppercase tracking-widest text-center">
                                  <th className="px-2 py-3 text-left overflow-hidden text-ellipsis whitespace-nowrap">Trainee / Chest No</th>
                                  {gridConfig.factors.map((f, i) => (
                                    <th key={i} colSpan={f.colSpan} className="px-1 py-2 leading-tight">
                                      {f.label}
                                    </th>
                                  ))}
                                  <th rowSpan={2} className="px-1 py-3 text-center align-middle font-bold text-app-accent bg-app-accent/10 overflow-hidden text-ellipsis whitespace-nowrap">
                                    MARKS
                                  </th>
                                </tr>
                                {/* OLQ Codes Row */}
                                <tr className="bg-black/10 border-b border-app-border divide-x divide-app-border/40 text-xs font-black text-app-text-bright uppercase tracking-wider text-center">
                                  <td className="px-2 py-2 text-left text-app-text-muted text-[10px] overflow-hidden text-ellipsis whitespace-nowrap">Code</td>
                                  {gridConfig.traits.map((t) => (
                                    <td key={t.id} className="px-1 py-2 font-mono text-xs hover:bg-black/20 group relative cursor-help overflow-hidden text-ellipsis whitespace-nowrap">
                                      <span className="underline decoration-dotted decoration-app-text-muted/50">{t.code}</span>
                                      {/* Tooltip for description */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black border border-app-border text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap z-50">
                                        {t.name}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {/* Trainee Row */}
                                <tr className="divide-x divide-app-border/40 hover:bg-black/10 transition-colors">
                                  <td className="px-2 py-3">
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="text-xs font-black text-app-text-bright uppercase tracking-wide leading-tight truncate mb-1">
                                        {student?.name || 'Trainee'}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="px-1 py-0.5 rounded bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-bright truncate whitespace-nowrap">
                                          B: {student?.batch || '--'} | C: {student?.chestNo || '--'}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  {gridConfig.traits.map((t) => (
                                    <td key={t.id} className="p-0.5 text-center">
                                      <input
                                        type="number"
                                        min={0}
                                        max={9}
                                        disabled={isAssessorCompleted}
                                        value={scores[t.id] ?? ''}
                                        onChange={(e) => {
                                          const valStr = e.target.value;
                                          if (valStr === '') {
                                            setScores((prev) => ({ ...prev, [t.id]: '' }));
                                            return;
                                          }
                                          const parsed = parseInt(valStr, 10);
                                          if (isNaN(parsed)) {
                                            setScores((prev) => ({ ...prev, [t.id]: '' }));
                                            return;
                                          }
                                          const val = parsed % 10;
                                          setScores((prev) => ({ ...prev, [t.id]: val }));
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="--"
                                        className="w-full bg-transparent border-0 text-center text-sm font-black text-app-text-bright focus:outline-none focus:ring-1 focus:ring-app-accent/50 focus:bg-black/30 rounded py-2 px-0.5 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </td>
                                  ))}
                                  <td className="p-0.5 text-center bg-app-accent/5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={999}
                                      disabled={isAssessorCompleted}
                                      value={scores['marks'] ?? ''}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') {
                                          setScores((prev) => ({ ...prev, marks: '' }));
                                          return;
                                        }
                                        const parsed = parseInt(valStr, 10);
                                        if (isNaN(parsed)) {
                                          setScores((prev) => ({ ...prev, marks: '' }));
                                          return;
                                        }
                                        if (parsed > 999) return;
                                        setScores((prev) => ({ ...prev, marks: parsed }));
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      placeholder="--"
                                      className="w-full bg-app-accent/15 border-0 text-center text-sm font-black text-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent/80 focus:bg-app-accent/20 rounded py-2 px-1 transition-all font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                      <div className="flex justify-end p-4 border-t border-app-border/40">
                        <button
                          type="button"
                          onClick={handleUploadMarks}
                          disabled={saving || isAssessorCompleted || ((activeAssessorType === 'Psych' || activeAssessorType === 'TO') && !isDossierUploaded)}
                          className="px-6 py-2.5 bg-app-card border border-app-border hover:border-app-accent text-app-text-bright rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Upload Marks
                        </button>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── INTERVENTION PLAN TAB ──────────────────────────────────────── */}
      {activeTab === 'meeting' && (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-app-accent">
                <Calendar size={24} />
                <h3 className="text-2xl font-black text-app-text-bright tracking-tight">
                  {activeAssessorType === 'IO' ? 'Mock Interview' : `${activeAssessorType} Feedback Scheduler`}
                </h3>
              </div>
              <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                {activeAssessorType === 'IO'
                  ? 'Schedule a mock interview with the candidate to evaluate their performance.'
                  : `Schedule a follow-up feedback session or review with the candidate to discuss their performance from the ${activeAssessorType} perspective.`}
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">
                  {activeAssessorType === 'IO' ? 'Mock Interview Date & Hour' : `${activeAssessorType} Feedback Meeting Date & Hour`}
                </label>
                <ModernDateTimePicker
                  value={meetingDate}
                  onChange={setMeetingDate}
                  disabled={isAssessorCompleted}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 block">Secure Meeting Link</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  disabled={isAssessorCompleted}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="w-full bg-app-card border border-app-border rounded-2xl p-4 text-sm font-black text-app-text-bright focus:outline-none focus:border-app-accent transition-all placeholder:text-app-text-muted/20"
                />
              </div>

              <button
                onClick={() => handleUpdate('MEETING_SCHEDULED')}
                disabled={saving || isAssessorCompleted || ((activeAssessorType === 'Psych' || activeAssessorType === 'TO') && !isDossierUploaded)}
                className="w-full py-4 bg-app-card border border-app-border hover:border-app-accent text-app-text-bright rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-black/40 hover:bg-app-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Confirm & Transmit Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL ASSESSOR FEEDBACK TAB ──────────────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-app-sidebar border border-app-border rounded-[3rem] p-12 shadow-2xl space-y-8 w-full">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-app-accent">
                <Users size={24} className="fill-current" />
                <h3 className="text-2xl font-black text-app-text-bright tracking-tight">Final Broadcasted Feedback</h3>
              </div>
              <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                Review the qualitative feedback from all assessors across different evaluations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Psychology Evaluation', remarks: submission.psychRemarks },
                { title: 'GTO Outdoor Case', remarks: (submission as any).gtoRemarks },
                { title: 'IO Personal Interview', remarks: (submission as any).ioRemarks },
                { title: 'Technical Officer Aptitude', remarks: (submission as any).toRemarks },
              ].map((feedback, idx) => (
                <div key={idx} className="bg-app-card border border-app-border rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="border-b border-app-border pb-3">
                    <h4 className="text-xs font-black uppercase text-app-text-bright tracking-widest">{feedback.title}</h4>
                  </div>
                  <div className="bg-black/30 border border-app-border p-4 rounded-2xl min-h-[140px] overflow-y-auto leading-relaxed text-sm font-serif italic text-app-text-bright">
                    {feedback.remarks ? feedback.remarks : 'No qualitative comments recorded.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>

        {/* RIGHT COLUMN: Presenter Sticky Panel */}
        {activeTab === 'dossier' && viewerMode === 'dossier' && (activeAssessorType === 'Psych' || activeAssessorType === 'TO') && assessment && showSidebar && (
          <div className="flex flex-col w-full space-y-4">
            <div className="flex items-center gap-3 border-b border-app-border pb-3">
              <Sparkles className="text-app-accent animate-pulse" size={20} />
              <h2 className="text-sm font-black text-app-text-bright uppercase tracking-widest">
                Assessment Preview
              </h2>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em] px-2 h-[26px]">
                <span>Question Reference Sheet</span>
              </div>

              <div className="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-2xl flex flex-col relative w-full" style={{ height: '720px' }}>
                <AssessmentMiniViewer assessmentId={assessment._id || assessment.id} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ethics & Integrity Consent Modal */}
      {showEthicsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full text-center relative overflow-hidden shadow-2xl space-y-8 animate-in scale-in-95 duration-300">
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-app-card rounded-3xl border border-app-border flex items-center justify-center mx-auto mb-6 text-app-accent shadow-inner">
                <ShieldCheck size={32} />
              </div>
              
              <h2 className="text-3xl font-black tracking-tight text-app-text-bright uppercase">
                Ethics & Integrity Protocols
              </h2>
              
              <p className="text-app-text-muted text-sm font-serif italic leading-relaxed">
                As an authorized assessor, you hold absolute professional accountability for candidate evaluation. Please review and agree to the following protocols to initialize review:
              </p>

              <div className="space-y-4 pt-4 text-left">
                <div className="flex gap-4 p-4 bg-app-card rounded-2xl border border-app-border/40 hover:border-app-accent/30 transition-all">
                  <div className="w-2.5 h-2.5 bg-app-accent rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_#C5A028]"></div>
                  <div>
                    <h4 className="text-xs font-black text-app-text-bright uppercase tracking-widest mb-1">Confidentiality Mandate</h4>
                    <p className="text-xs text-app-text-muted leading-relaxed">All student info and data under review must be kept strictly confidential.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4 bg-app-card rounded-2xl border border-app-border/40 hover:border-app-accent/30 transition-all">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_#EF4444]"></div>
                  <div>
                    <h4 className="text-xs font-black text-app-text-bright uppercase tracking-widest mb-1">Recording Prohibition</h4>
                    <p className="text-xs text-app-text-muted leading-relaxed">Recording, photographing, or taking screenshots of any candidate material or answers is strictly illegal.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <label className="flex items-center gap-2 cursor-pointer group w-fit mx-auto">
                  <input
                    type="checkbox"
                    checked={doNotShowEthics}
                    onChange={(e) => setDoNotShowEthics(e.target.checked)}
                    className="w-4 h-4 rounded border-app-border bg-app-card text-app-accent focus:ring-app-accent focus:ring-offset-app-sidebar cursor-pointer"
                  />
                  <span className="text-xs font-bold text-app-text-muted group-hover:text-app-text-bright transition-colors uppercase tracking-widest">
                    Do not show this again
                  </span>
                </label>
                <button
                  onClick={() => {
                    if (doNotShowEthics) {
                      localStorage.setItem('ssb_ethics_agreed', 'true');
                    }
                    setShowEthicsModal(false);
                  }}
                  className="w-full py-4 bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-app-accent/30 active:scale-95 cursor-pointer"
                >
                  I Agree & Continue
                </button>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-64 h-64 bg-app-accent/5 rounded-full blur-[100px] -ml-32 -mt-32" />
          </div>
        </div>
      )}

      {/* Meeting Link Sent Success Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl animate-in scale-in-95 duration-300">
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-3xl border border-green-500/20 flex items-center justify-center mx-auto text-green-500 shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-app-text-bright">Meeting Link Sent</h2>
                <p className="text-app-text-muted text-sm font-serif italic">
                  The candidate's dashboard has been updated and an email notification has been dispatched.
                </p>
              </div>

              <button
                onClick={() => setShowMeetingModal(false)}
                className="w-full py-4 bg-app-card border border-app-border text-app-text-bright rounded-2xl text-[11px] font-black uppercase tracking-widest hover:border-app-accent hover:text-app-accent transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                Continue
              </button>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/5 rounded-full blur-[80px] -mr-24 -mt-24" />
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionReview;
