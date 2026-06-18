import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  CheckCircle2, 
  Video, 
  Clock, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Grid, 
  List, 
  CalendarDays, 
  AlertTriangle, 
  Trash2, 
  Edit, 
  ExternalLink, 
  X, 
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Meeting {
  id: string;
  _id: string;
  submissionId: string;
  meetingType: 'psych' | 'to' | 'gto' | 'io';
  meetingTypeLabel: string;
  meetingDate: string;
  meetingLink: string;
  completed: boolean;
  status: 'Upcoming' | 'Completed' | 'Missed' | 'Today';
  student: {
    id: string;
    _id: string;
    name: string;
    email: string;
    chestNo: string;
    batch: string;
    profileImage?: string;
  };
  assessor: {
    id: string;
    _id: string;
    name: string;
    email: string;
  } | null;
}

interface Stats {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  missed: number;
}

const Meetings: React.FC = () => {
  const { user } = useAuth();
  
  // State variables
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, upcoming: 0, completed: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Pagination & Filters State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [meetingTypeFilter, setMeetingTypeFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('meetingDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // UI Display Toggles
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'calendar'>('table');
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // Action Modals & Drawer State
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [dragRescheduleOpen, setDragRescheduleOpen] = useState(false);
  
  // Form values for Rescheduling
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleLink, setRescheduleLink] = useState('');
  const [dragTarget, setDragTarget] = useState<{ meeting: Meeting; newDate: Date } | null>(null);
  
  // Reference for Search Input Focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Keyboard shortcut: pressing '/' focuses the search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch data from server API
  const fetchMeetings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (meetingTypeFilter) params.meetingType = meetingTypeFilter;
      if (batchFilter) params.batch = batchFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Call our newly added meetings endpoint
      const result = await (api as any).meetings.list(params);
      
      setMeetings(result.meetings || []);
      setTotalCount(result.totalCount || 0);
      if (result.stats) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [user, page, limit, debouncedSearch, statusFilter, meetingTypeFilter, batchFilter, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Mark meeting as completed
  const handleMarkAsComplete = async (meeting: Meeting) => {
    try {
      const prefix = meeting.meetingType;
      await api.submissions.update(meeting.submissionId, {
        [`${prefix}MeetingCompleted`]: true
      });
      // Update local state cleanly
      setMeetings(prev => prev.map(m => {
        if (m.id === meeting.id) {
          return { ...m, completed: true, status: 'Completed' };
        }
        return m;
      }));
      // Recalculate statistics
      setStats(prev => ({
        ...prev,
        completed: prev.completed + 1,
        upcoming: meeting.status === 'Upcoming' ? prev.upcoming - 1 : prev.upcoming,
        missed: meeting.status === 'Missed' ? prev.missed - 1 : prev.missed
      }));
      setIsDrawerOpen(false);
      setConfirmCompleteOpen(false);
    } catch (error) {
      console.error('Failed to complete meeting:', error);
    }
  };

  // Reschedule meeting date & link
  const handleReschedule = async (meeting: Meeting, newDateStr: string, newLinkStr: string) => {
    if (!newDateStr) return;
    try {
      const prefix = meeting.meetingType;
      await api.submissions.update(meeting.submissionId, {
        [`${prefix}MeetingDate`]: new Date(newDateStr).toISOString(),
        [`${prefix}MeetingLink`]: newLinkStr,
        [`${prefix}MeetingCompleted`]: false, // resets completed flag on reschedule
        triggerEmail: true,
        meetingRole: prefix
      });
      
      // Refresh list to updatederived statuses and sorted positions
      await fetchMeetings();
      setRescheduleModalOpen(false);
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to reschedule meeting:', error);
    }
  };

  // Cancel meeting (removes scheduled date and link)
  const handleCancelMeeting = async (meeting: Meeting) => {
    try {
      const prefix = meeting.meetingType;
      await api.submissions.update(meeting.submissionId, {
        [`${prefix}MeetingDate`]: null,
        [`${prefix}MeetingLink`]: '',
        [`${prefix}MeetingCompleted`]: false,
        triggerEmail: true,
        meetingRole: prefix
      });
      
      // Refresh list
      await fetchMeetings();
      setIsDrawerOpen(false);
      setConfirmCancelOpen(false);
    } catch (error) {
      console.error('Failed to cancel meeting:', error);
    }
  };

  // Sort handler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Helper: clear all filters
  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setMeetingTypeFilter('');
    setBatchFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Drag and Drop handlers for Month view calendar
  const handleDragStart = (e: React.DragEvent, meetingId: string) => {
    e.dataTransfer.setData('text/plain', meetingId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnDate = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const meetingId = e.dataTransfer.getData('text/plain');
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    // Set targets and prompt confirmation modal
    setDragTarget({ meeting, newDate: targetDate });
    setDragRescheduleOpen(true);
  };

  // Confirm Rescheduling via Drag & Drop
  const confirmDragReschedule = async () => {
    if (!dragTarget) return;
    const { meeting, newDate } = dragTarget;
    
    // Set targeted hour/minute from original meeting date to preserve time
    const originalDate = new Date(meeting.meetingDate);
    const updatedDate = new Date(newDate);
    updatedDate.setHours(originalDate.getHours());
    updatedDate.setMinutes(originalDate.getMinutes());

    await handleReschedule(meeting, updatedDate.toISOString(), meeting.meetingLink);
    setDragRescheduleOpen(false);
    setDragTarget(null);
  };

  // Render Skeletons for Loading States
  const renderSkeletons = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse bg-app-sidebar border border-app-border rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-1/3">
            <div className="w-12 h-12 rounded-xl bg-app-card shrink-0"></div>
            <div className="space-y-2 w-full">
              <div className="h-4 bg-app-card rounded w-3/4"></div>
              <div className="h-3 bg-app-card rounded w-1/2"></div>
            </div>
          </div>
          <div className="h-4 bg-app-card rounded w-1/4"></div>
          <div className="h-6 bg-app-card rounded w-16"></div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="h-10 bg-app-card rounded-xl w-24"></div>
            <div className="h-10 bg-app-card rounded-xl w-24"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // Render Table Layout
  const renderTableView = () => {
    const columns = [
      { key: 'candidateName', label: 'Candidate' },
      { key: 'chestNo', label: 'Chest No' },
      { key: 'batch', label: 'Batch' },
      { key: 'meetingTypeLabel', label: 'Meeting Type' },
      { key: 'assessorName', label: 'Assessor' },
      { key: 'meetingDate', label: 'Date & Time' },
      { key: 'status', label: 'Status' },
      { key: 'meetingLink', label: 'Link' },
      { key: 'actions', label: 'Actions', noSort: true }
    ];

    return (
      <div className="bg-app-sidebar border border-app-border rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-app-border bg-app-bg/40">
                {columns.map(col => (
                  <th 
                    key={col.key} 
                    onClick={() => !col.noSort && handleSort(col.key)}
                    className={cn(
                      "py-4 px-6 text-xs font-bold uppercase tracking-wider text-app-text-muted select-none",
                      !col.noSort && "cursor-pointer hover:text-app-text-bright transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {!col.noSort && sortBy === col.key && (
                        <span className="text-[10px] text-app-accent">
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border bg-app-sidebar/20">
              {meetings.map(m => {
                const meetingDate = new Date(m.meetingDate);
                const isCompleted = m.completed;
                return (
                  <tr 
                    key={m.id} 
                    className="hover:bg-app-card/60 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedMeeting(m);
                      setIsDrawerOpen(true);
                    }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0">
                          {m.student.profileImage ? (
                            <img src={m.student.profileImage} alt={m.student.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={18} className="text-app-text-muted" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-black text-app-text-bright group-hover:text-app-accent transition-colors">{m.student.name}</div>
                          <div className="text-[10px] text-app-text-muted font-mono">{m.student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-app-text-bright font-mono">{m.student.chestNo}</td>
                    <td className="py-4 px-6 text-sm font-bold text-app-text-bright font-mono">{m.student.batch}</td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-app-border text-[10px] font-black uppercase tracking-wider text-app-text-bright">
                        {m.meetingTypeLabel}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-app-text-bright">
                      {m.assessor ? m.assessor.name : <span className="text-app-text-muted italic">Unassigned</span>}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-app-text-bright">
                          {meetingDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-xs text-app-text-muted flex items-center gap-1 mt-0.5 font-mono">
                          <Clock size={12} />
                          {meetingDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        isCompleted && "bg-green-500/10 text-green-400 border border-green-500/20",
                        !isCompleted && m.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                        !isCompleted && m.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                        !isCompleted && m.status === 'Missed' && "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isCompleted && "bg-green-400",
                          !isCompleted && m.status === 'Today' && "bg-yellow-400 animate-ping",
                          !isCompleted && m.status === 'Upcoming' && "bg-blue-400",
                          !isCompleted && m.status === 'Missed' && "bg-red-400"
                        )}></span>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {m.meetingLink ? (
                        <a 
                          href={m.meetingLink}
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // prevent drawer opening
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold text-xs"
                        >
                          <Video size={14} /> Join
                        </a>
                      ) : (
                        <span className="text-app-text-muted italic text-xs">No Link</span>
                      )}
                    </td>
                    <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {!isCompleted && (
                          <button 
                            onClick={() => handleMarkAsComplete(m)}
                            className="p-1.5 hover:bg-green-500/20 text-green-400 hover:text-green-300 rounded-lg transition-colors"
                            title="Mark Complete"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedMeeting(m);
                            setRescheduleDate(new Date(m.meetingDate).toISOString().slice(0, 16));
                            setRescheduleLink(m.meetingLink);
                            setRescheduleModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300 rounded-lg transition-colors"
                          title="Reschedule"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render Card Layout
  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {meetings.map(m => {
        const meetingDate = new Date(m.meetingDate);
        const isCompleted = m.completed;
        return (
          <div 
            key={m.id} 
            className="bg-app-sidebar border border-app-border rounded-3xl p-6 shadow-xl flex flex-col hover:border-app-accent/50 transition-all cursor-pointer group"
            onClick={() => {
              setSelectedMeeting(m);
              setIsDrawerOpen(true);
            }}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                isCompleted && "bg-green-500/10 text-green-400 border border-green-500/20",
                !isCompleted && m.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                !isCompleted && m.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                !isCompleted && m.status === 'Missed' && "bg-red-500/10 text-red-400 border border-red-500/20"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isCompleted && "bg-green-400",
                  !isCompleted && m.status === 'Today' && "bg-yellow-400 animate-ping",
                  !isCompleted && m.status === 'Upcoming' && "bg-blue-400",
                  !isCompleted && m.status === 'Missed' && "bg-red-400"
                )}></span>
                {m.status}
              </span>
              <span className="px-2 py-0.5 rounded bg-black/40 border border-app-border text-[9px] font-black uppercase tracking-wider text-app-text-bright">
                {m.meetingTypeLabel}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-app-card border border-app-border overflow-hidden flex items-center justify-center shrink-0">
                {m.student.profileImage ? (
                  <img src={m.student.profileImage} alt={m.student.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={24} className="text-app-text-muted" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-app-text-bright group-hover:text-app-accent transition-colors">{m.student.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-black/30 border border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-bright whitespace-nowrap">
                    B: {m.student.batch} | C: {m.student.chestNo}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-app-card rounded-2xl p-4 border border-app-border space-y-3 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-muted">Scheduled Date:</span>
                <span className="font-bold text-app-text-bright">
                  {meetingDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-muted">Scheduled Time:</span>
                <span className="font-bold text-app-text-bright font-mono flex items-center gap-1">
                  <Clock size={12} className="text-app-accent" />
                  {meetingDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-muted">Assessor:</span>
                <span className="font-bold text-app-text-bright">
                  {m.assessor ? m.assessor.name : 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
              <a 
                href={m.meetingLink || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                <Video size={14} /> Join
              </a>
              {!isCompleted ? (
                <button 
                  onClick={() => handleMarkAsComplete(m)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <CheckCircle2 size={14} /> Complete
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setSelectedMeeting(m);
                    setRescheduleDate(new Date(m.meetingDate).toISOString().slice(0, 16));
                    setRescheduleLink(m.meetingLink);
                    setRescheduleModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Edit size={14} /> Reschedule
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render Calendar Layout
  const renderCalendarView = () => {
    // Generate days for current month
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // First day of current month
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Days in previous month (to fill the prefix gap)
    const prevDaysCount = new Date(year, month, 0).getDate();
    
    const calendarCells: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Fill previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      calendarCells.push({
        date: new Date(year, month - 1, prevDaysCount - i),
        isCurrentMonth: false
      });
    }
    
    // Fill current month days
    for (let i = 1; i <= daysInMonth; i++) {
      calendarCells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Fill next month padding days (up to 42 total slots representing 6 weeks)
    const totalSlots = 42;
    const nextMonthPadding = totalSlots - calendarCells.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      calendarCells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Render Month view grid
    const renderMonthGrid = () => (
      <div>
        <div className="grid grid-cols-7 border-b border-app-border bg-app-card/60 rounded-t-2xl">
          {weekDays.map(d => (
            <div key={d} className="py-3 px-2 text-center text-xs font-bold uppercase tracking-wider text-app-text-muted">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-b border-app-border">
          {calendarCells.map((cell, idx) => {
            const dateStr = cell.date.toDateString();
            const isTodayDate = new Date().toDateString() === dateStr;
            
            // Filter meetings for this specific calendar cell
            const cellMeetings = meetings.filter(m => new Date(m.meetingDate).toDateString() === dateStr);
            
            return (
              <div 
                key={idx} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnDate(e, cell.date)}
                className={cn(
                  "min-h-[120px] p-2 border-r border-t border-app-border flex flex-col justify-between transition-colors",
                  cell.isCurrentMonth ? "bg-app-sidebar/20" : "bg-black/40 opacity-40",
                  isTodayDate && "bg-app-accent/5 border-app-accent/30"
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={cn(
                    "text-xs font-black px-2 py-0.5 rounded-full font-mono",
                    isTodayDate ? "bg-app-accent text-black font-black" : "text-app-text-bright"
                  )}>
                    {cell.date.getDate()}
                  </span>
                  {cellMeetings.length > 0 && (
                    <span className="text-[9px] font-bold text-app-text-muted">{cellMeetings.length} Meeting(s)</span>
                  )}
                </div>
                
                <div className="space-y-1.5 overflow-y-auto max-h-[80px] custom-scrollbar flex-1 flex flex-col justify-start">
                  {cellMeetings.map(m => {
                    const timeStr = new Date(m.meetingDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const isCompleted = m.completed;
                    
                    return (
                      <div 
                        key={m.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, m.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeeting(m);
                          setIsDrawerOpen(true);
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-bold tracking-tight cursor-grab active:cursor-grabbing border truncate flex items-center justify-between",
                          isCompleted && "bg-green-500/10 text-green-400 border-green-500/20",
                          !isCompleted && m.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                          !isCompleted && m.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                          !isCompleted && m.status === 'Missed' && "bg-red-500/10 text-red-400 border-red-500/20"
                        )}
                        title={`${m.student.name} - ${m.meetingTypeLabel}`}
                      >
                        <span className="truncate">{m.student.name}</span>
                        <span className="font-mono text-[8px] opacity-70 shrink-0 ml-1">{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    // Render Week view columns
    const renderWeekGrid = () => {
      // Generate days of active week
      const activeWeekDays: Date[] = [];
      const currentDay = calendarDate.getDay();
      
      for (let i = 0; i < 7; i++) {
        const diff = i - currentDay;
        const d = new Date(calendarDate);
        d.setDate(calendarDate.getDate() + diff);
        activeWeekDays.push(d);
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-7 border border-app-border rounded-2xl overflow-hidden bg-app-sidebar/20">
          {activeWeekDays.map((date, idx) => {
            const dateStr = date.toDateString();
            const isTodayDate = new Date().toDateString() === dateStr;
            const cellMeetings = meetings.filter(m => new Date(m.meetingDate).toDateString() === dateStr);

            return (
              <div 
                key={idx} 
                className={cn(
                  "min-h-[300px] border-r border-app-border flex flex-col p-4",
                  isTodayDate && "bg-app-accent/5"
                )}
              >
                <div className="border-b border-app-border pb-3 mb-4 text-center">
                  <div className="text-xs uppercase text-app-text-muted font-bold">{weekDays[idx]}</div>
                  <div className={cn(
                    "text-xl font-black font-mono w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1",
                    isTodayDate ? "bg-app-accent text-black font-black" : "text-app-text-bright"
                  )}>
                    {date.getDate()}
                  </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                  {cellMeetings.length === 0 ? (
                    <div className="text-center text-[10px] text-app-text-muted italic py-10">No meetings</div>
                  ) : (
                    cellMeetings.map(m => {
                      const timeStr = new Date(m.meetingDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                      const isCompleted = m.completed;
                      
                      return (
                        <div 
                          key={m.id}
                          onClick={() => {
                            setSelectedMeeting(m);
                            setIsDrawerOpen(true);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border cursor-pointer hover:border-app-accent/50 transition-all",
                            isCompleted && "bg-green-500/10 text-green-400 border-green-500/20",
                            !isCompleted && m.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                            !isCompleted && m.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                            !isCompleted && m.status === 'Missed' && "bg-red-500/10 text-red-400 border-red-500/20"
                          )}
                        >
                          <div className="font-black text-[10px] truncate">{m.student.name}</div>
                          <div className="text-[9px] text-app-text-muted mt-1 uppercase font-bold">{m.meetingTypeLabel}</div>
                          <div className="flex items-center gap-1 text-[9px] font-mono mt-1.5 opacity-90">
                            <Clock size={10} /> {timeStr}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    // Render Day view columns
    const renderDayGrid = () => {
      const activeDateStr = calendarDate.toDateString();
      const cellMeetings = meetings.filter(m => new Date(m.meetingDate).toDateString() === activeDateStr);

      return (
        <div className="bg-app-sidebar border border-app-border rounded-2xl p-6 max-w-3xl mx-auto space-y-4">
          <div className="border-b border-app-border pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-app-text-bright">
                {calendarDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-xs text-app-text-muted mt-0.5 font-serif italic">Meetings for this day</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-app-accent/10 border border-app-accent/20 text-xs font-black text-app-accent uppercase tracking-wider">
              {cellMeetings.length} Scheduled
            </span>
          </div>

          <div className="space-y-3">
            {cellMeetings.length === 0 ? (
              <div className="text-center py-20 text-app-text-muted italic text-sm">
                No meetings scheduled for this day.
              </div>
            ) : (
              cellMeetings.map(m => {
                const timeStr = new Date(m.meetingDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                const isCompleted = m.completed;

                return (
                  <div 
                    key={m.id}
                    onClick={() => {
                      setSelectedMeeting(m);
                      setIsDrawerOpen(true);
                    }}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:border-app-accent/50 transition-colors",
                      isCompleted && "bg-green-500/10 text-green-400 border-green-500/20",
                      !isCompleted && m.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                      !isCompleted && m.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                      !isCompleted && m.status === 'Missed' && "bg-red-500/10 text-red-400 border-red-500/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-app-card overflow-hidden flex items-center justify-center shrink-0 border border-app-border">
                        {m.student.profileImage ? (
                          <img src={m.student.profileImage} alt={m.student.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={14} className="text-app-text-muted" />
                        )}
                      </div>
                      <div>
                        <div className="font-black text-sm">{m.student.name}</div>
                        <div className="text-[10px] text-app-text-muted mt-0.5 uppercase tracking-wider">{m.meetingTypeLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="text-xs font-mono font-bold flex items-center gap-1">
                        <Clock size={12} /> {timeStr}
                      </span>
                      {m.meetingLink && (
                        <a 
                          href={m.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                        >
                          <Video size={10} /> Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-app-border">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-app-text-bright tracking-tight select-none">
              {calendarView === 'month' && `${monthNames[month]} ${year}`}
              {calendarView === 'week' && `Week of ${calendarDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
              {calendarView === 'day' && calendarDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </h2>
            
            <div className="flex items-center bg-app-card border border-app-border rounded-xl p-1 shrink-0">
              <button 
                onClick={() => {
                  const d = new Date(calendarDate);
                  if (calendarView === 'month') d.setMonth(d.getMonth() - 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() - 7);
                  else d.setDate(d.getDate() - 1);
                  setCalendarDate(d);
                }}
                className="p-1 hover:bg-app-sidebar rounded-lg text-app-text-muted hover:text-app-text-bright transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCalendarDate(new Date())}
                className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-app-text-muted hover:text-app-text-bright transition-colors"
              >
                Today
              </button>
              <button 
                onClick={() => {
                  const d = new Date(calendarDate);
                  if (calendarView === 'month') d.setMonth(d.getMonth() + 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() + 7);
                  else d.setDate(d.getDate() + 1);
                  setCalendarDate(d);
                }}
                className="p-1 hover:bg-app-sidebar rounded-lg text-app-text-muted hover:text-app-text-bright transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex bg-app-card border border-app-border rounded-xl p-1">
            {(['month', 'week', 'day'] as const).map(view => (
              <button
                key={view}
                onClick={() => setCalendarView(view)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  calendarView === view ? "bg-app-accent text-black font-black" : "text-app-text-muted hover:text-app-text-bright"
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
        
        {/* Render Active View Grid */}
        {calendarView === 'month' && renderMonthGrid()}
        {calendarView === 'week' && renderWeekGrid()}
        {calendarView === 'day' && renderDayGrid()}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-app-sidebar border border-app-border rounded-[2.5rem] p-8 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-end gap-3 mb-1">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-app-text-bright">Scheduled Meetings</h1>
            <span className="w-3 h-3 bg-app-accent rounded-full mb-3 shadow-[0_0_10px_#C5A028]"></span>
          </div>
          <p className="text-app-text-muted text-base font-serif italic max-w-2xl leading-relaxed">
            Manage, reschedule, and join your feedback sessions and candidate assessments.
          </p>
        </div>
      </div>

      {/* Statistics Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Scheduled', value: stats.total, color: 'border-app-border text-app-text-bright' },
          { label: 'Meetings Today', value: stats.today, color: 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5' },
          { label: 'Upcoming', value: stats.upcoming, color: 'border-blue-500/20 text-blue-400 bg-blue-500/5' },
          { label: 'Completed', value: stats.completed, color: 'border-green-500/20 text-green-400 bg-green-500/5' },
          { label: 'Missed / Pending', value: stats.missed, color: 'border-red-500/20 text-red-400 bg-red-500/5' }
        ].map((s, idx) => (
          <div key={idx} className={cn("bg-app-sidebar border rounded-3xl p-5 shadow-lg flex flex-col justify-between hover:scale-[1.02] transition-transform", s.color)}>
            <span className="text-[10px] uppercase font-black tracking-wider text-app-text-muted">{s.label}</span>
            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight mt-3">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Sticky Filters & Search Control Bar */}
      <div className="sticky top-0 z-40 bg-app-bg/85 backdrop-blur-md py-4 mb-6 border-b border-app-border/40 flex flex-col gap-4">
        
        {/* Row 1: Global Search Bar (Right aligned, upper to filters) */}
        <div className="flex justify-end w-full">
          <div className="relative w-full lg:max-w-xs xl:max-w-sm group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted group-focus-within:text-app-accent transition-colors duration-200">
              <Search size={16} />
            </span>
            <input 
              ref={searchInputRef}
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Candidate, Chest #..." 
              className="w-full pl-11 pr-10 py-2.5 bg-app-sidebar/60 hover:bg-app-sidebar border border-app-border/80 focus:border-app-accent rounded-xl text-xs text-app-text-bright placeholder-app-text-muted/70 outline-none transition-all duration-200"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-bright transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Quick filters dropdown group (All in one line below search) */}
        <div className="flex flex-wrap items-center gap-3 w-full">
          
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-app-sidebar/40 border border-app-border/80 rounded-xl px-3 py-1.5 hover:border-app-border-bright transition-colors">
            <span className="text-[10px] text-app-text-muted font-bold tracking-wider uppercase select-none">Status:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-xs text-app-text-bright outline-none cursor-pointer pr-2 font-semibold"
            >
              <option value="" className="bg-app-sidebar text-app-text-bright">All</option>
              <option value="Today" className="bg-app-sidebar text-app-text-bright">Today</option>
              <option value="Upcoming" className="bg-app-sidebar text-app-text-bright">Upcoming</option>
              <option value="Completed" className="bg-app-sidebar text-app-text-bright">Completed</option>
              <option value="Missed" className="bg-app-sidebar text-app-text-bright">Missed</option>
            </select>
          </div>

          {/* Batch Filter */}
          <div className="flex items-center gap-2 bg-app-sidebar/40 border border-app-border/80 rounded-xl px-3 py-1.5 hover:border-app-border-bright transition-colors">
            <span className="text-[10px] text-app-text-muted font-bold tracking-wider uppercase select-none">Batch:</span>
            <input 
              type="text" 
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              placeholder="All"
              className="bg-transparent border-none text-xs text-app-text-bright outline-none w-16 placeholder-app-text-muted/50 font-semibold"
            />
          </div>

          {/* From Date Filter */}
          <div className="flex items-center gap-2 bg-app-sidebar/40 border border-app-border/80 rounded-xl px-3 py-1.5 hover:border-app-border-bright transition-colors">
            <span className="text-[10px] text-app-text-muted font-bold tracking-wider uppercase select-none">From:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-[11px] text-app-text-bright outline-none cursor-pointer w-24 font-mono font-medium"
            />
          </div>

          {/* To Date Filter */}
          <div className="flex items-center gap-2 bg-app-sidebar/40 border border-app-border/80 rounded-xl px-3 py-1.5 hover:border-app-border-bright transition-colors">
            <span className="text-[10px] text-app-text-muted font-bold tracking-wider uppercase select-none">To:</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-[11px] text-app-text-bright outline-none cursor-pointer w-24 font-mono font-medium"
            />
          </div>

          {/* Clear Filters Button */}
          {(search || statusFilter || meetingTypeFilter || batchFilter || startDate || endDate) && (
            <button 
              onClick={handleClearFilters}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              Clear
            </button>
          )}

          {/* View Mode Toggle Switch */}
          <div className="flex bg-app-sidebar/40 border border-app-border/80 rounded-xl p-1 shrink-0 ml-auto">
            {[
              { mode: 'table', icon: <List size={14} />, label: 'Table' },
              { mode: 'card', icon: <Grid size={14} />, label: 'Cards' },
              { mode: 'calendar', icon: <CalendarDays size={14} />, label: 'Calendar' }
            ].map(t => (
              <button
                key={t.mode}
                onClick={() => setViewMode(t.mode as any)}
                className={cn(
                  "p-1.5 rounded-lg text-app-text-muted hover:text-app-text-bright transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-wider",
                  viewMode === t.mode && "bg-app-accent text-black hover:text-black font-black"
                )}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Main Grid / Data Section */}
      <div className="space-y-6">
        {loading ? (
          renderSkeletons()
        ) : meetings.length === 0 ? (
          <div className="bg-app-sidebar p-20 rounded-[2.5rem] border border-app-border border-dashed text-center">
            <div className="w-20 h-20 bg-app-card border border-app-border rounded-3xl flex items-center justify-center mx-auto mb-6 text-app-text-muted opacity-20">
              <CalendarIcon size={40} />
            </div>
            <h3 className="text-xl font-bold text-app-text-bright mb-2 font-sans tracking-tight">No Meetings Found</h3>
            <p className="text-app-text-muted text-sm italic font-serif leading-relaxed mb-6">We couldn't identify any scheduled meetings matching your active filters.</p>
            {(search || statusFilter || meetingTypeFilter || batchFilter || startDate || endDate) && (
              <button 
                onClick={handleClearFilters}
                className="px-6 py-2.5 bg-app-accent hover:bg-app-accent-light text-black font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'table' && renderTableView()}
            {viewMode === 'card' && renderCardView()}
            {viewMode === 'calendar' && renderCalendarView()}
          </>
        )}
      </div>

      {/* Pagination Footer */}
      {viewMode !== 'calendar' && !loading && meetings.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-app-sidebar border border-app-border rounded-3xl p-6 shadow-xl">
          
          <div className="flex items-center gap-4 text-xs text-app-text-muted">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select 
                value={limit} 
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-app-card border border-app-border rounded-lg text-app-text-bright outline-none cursor-pointer"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <span>records per page</span>
            </div>
            <div className="h-4 w-px bg-app-border hidden sm:block"></div>
            <span>Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} records</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-text-muted hover:text-app-text-bright hover:border-app-accent/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            
            {/* Simple page numbers */}
            {(() => {
              const maxPages = Math.ceil(totalCount / limit);
              const pages = [];
              const startPage = Math.max(1, page - 2);
              const endPage = Math.min(maxPages, page + 2);
              
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "w-10 h-10 rounded-xl border text-xs font-bold font-mono transition-all",
                      page === i 
                        ? "bg-app-accent text-black border-app-accent font-black" 
                        : "bg-app-card border-app-border text-app-text-muted hover:text-app-text-bright"
                    )}
                  >
                    {i}
                  </button>
                );
              }
              return pages;
            })()}

            <button 
              disabled={page >= Math.ceil(totalCount / limit)}
              onClick={() => setPage(p => p + 1)}
              className="p-2.5 bg-app-card border border-app-border rounded-xl text-app-text-muted hover:text-app-text-bright hover:border-app-accent/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

        </div>
      )}

      {/* Detailed Slideout Side Panel */}
      {isDrawerOpen && selectedMeeting && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setIsDrawerOpen(false)}></div>
          
          <div className="relative w-full max-w-xl bg-app-sidebar border-l border-app-border shadow-2xl flex flex-col h-full z-10">
            {/* Header */}
            <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-card/60">
              <div>
                <h3 className="text-xl font-black text-app-text-bright">Meeting Workspace</h3>
                <p className="text-[10px] text-app-text-muted uppercase tracking-wider font-mono mt-0.5">ID: {selectedMeeting.id}</p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 hover:bg-app-card rounded-xl text-app-text-muted hover:text-app-text-bright transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Candidate Info Section */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-black tracking-wider text-app-text-muted">Candidate Details</h4>
                <div className="bg-app-card border border-app-border rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-app-bg border border-app-border overflow-hidden flex items-center justify-center shrink-0">
                    {selectedMeeting.student.profileImage ? (
                      <img src={selectedMeeting.student.profileImage} alt={selectedMeeting.student.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-app-text-muted" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-base font-black text-app-text-bright">{selectedMeeting.student.name}</h5>
                    <p className="text-xs text-app-text-muted mt-0.5 font-mono">{selectedMeeting.student.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-black/40 border border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-bright font-mono whitespace-nowrap">
                        Batch: {selectedMeeting.student.batch} | Chest #: {selectedMeeting.student.chestNo}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meeting Info Section */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-black tracking-wider text-app-text-muted">Session Information</h4>
                <div className="bg-app-card border border-app-border rounded-2xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-app-text-muted uppercase font-bold">Meeting Type</div>
                      <div className="text-sm font-black text-app-text-bright mt-1">{selectedMeeting.meetingTypeLabel}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-app-text-muted uppercase font-bold">Assessor</div>
                      <div className="text-sm font-bold text-app-text-bright mt-1">
                        {selectedMeeting.assessor ? selectedMeeting.assessor.name : <span className="text-app-text-muted italic">Unassigned</span>}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-app-border"></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-app-text-muted uppercase font-bold">Date</div>
                      <div className="text-sm font-bold text-app-text-bright mt-1 font-mono">
                        {new Date(selectedMeeting.meetingDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-app-text-muted uppercase font-bold">Time</div>
                      <div className="text-sm font-bold text-app-text-bright mt-1 font-mono flex items-center gap-1">
                        <Clock size={14} className="text-app-accent" />
                        {new Date(selectedMeeting.meetingDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-app-border"></div>

                  <div>
                    <div className="text-[10px] text-app-text-muted uppercase font-bold">Status</div>
                    <div className="mt-1">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        selectedMeeting.completed && "bg-green-500/10 text-green-400 border border-green-500/20",
                        !selectedMeeting.completed && selectedMeeting.status === 'Today' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                        !selectedMeeting.completed && selectedMeeting.status === 'Upcoming' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                        !selectedMeeting.completed && selectedMeeting.status === 'Missed' && "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          selectedMeeting.completed && "bg-green-400",
                          !selectedMeeting.completed && selectedMeeting.status === 'Today' && "bg-yellow-400 animate-ping",
                          !selectedMeeting.completed && selectedMeeting.status === 'Upcoming' && "bg-blue-400",
                          !selectedMeeting.completed && selectedMeeting.status === 'Missed' && "bg-red-400"
                        )}></span>
                        {selectedMeeting.status}
                      </span>
                    </div>
                  </div>

                  {selectedMeeting.meetingLink && (
                    <>
                      <div className="h-px bg-app-border"></div>
                      <div>
                        <div className="text-[10px] text-app-text-muted uppercase font-bold">Meeting URL</div>
                        <a 
                          href={selectedMeeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1.5 mt-1 truncate"
                        >
                          <Video size={14} className="shrink-0" />
                          {selectedMeeting.meetingLink}
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* History auditing timeline placeholder */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-black tracking-wider text-app-text-muted">Scheduling Logs</h4>
                <div className="bg-app-card border border-app-border rounded-2xl p-4 space-y-4">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0 mt-0.5">
                      <Clock size={10} />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-app-text-bright">Date Scheduled</div>
                      <div className="text-app-text-muted mt-0.5">{new Date(selectedMeeting.meetingDate).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick action controls footer */}
            <div className="p-6 border-t border-app-border bg-app-card/60 grid grid-cols-2 gap-3">
              {selectedMeeting.meetingLink && (
                <a 
                  href={selectedMeeting.meetingLink} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2 flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg"
                >
                  <Video size={16} /> Join Conference
                </a>
              )}
              
              {!selectedMeeting.completed ? (
                <button 
                  onClick={() => setConfirmCompleteOpen(true)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  <CheckCircle2 size={14} /> Mark Completed
                </button>
              ) : (
                <span className="flex items-center justify-center gap-2 py-2.5 bg-green-500/5 text-green-500/60 border border-green-500/10 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  ✓ Meeting Complete
                </span>
              )}
              
              <button 
                onClick={() => {
                  setRescheduleDate(new Date(selectedMeeting.meetingDate).toISOString().slice(0, 16));
                  setRescheduleLink(selectedMeeting.meetingLink);
                  setRescheduleModalOpen(true);
                }}
                className="flex items-center justify-center gap-2 py-2.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                <Edit size={14} /> Reschedule Session
              </button>

              <button 
                onClick={() => setConfirmCancelOpen(true)}
                className="col-span-2 flex items-center justify-center gap-2 py-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                <Trash2 size={14} /> Cancel Scheduled Meeting
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Rescheduling Form Modal */}
      {rescheduleModalOpen && selectedMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" onClick={() => setRescheduleModalOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-2xl space-y-6 z-10">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-app-text-bright">Reschedule Feedback</h3>
              <p className="text-xs text-app-text-muted">Provide updated date, time, and Google Meet details for candidate: <span className="text-app-accent font-bold">{selectedMeeting.student.name}</span></p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-muted">Meeting Date & Time (IST)</label>
                <input 
                  type="datetime-local" 
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-4 py-3 bg-app-card border border-app-border rounded-xl text-sm text-app-text-bright outline-none focus:border-app-accent/60 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-app-text-muted">Meeting Link / Video Link</label>
                <input 
                  type="url" 
                  value={rescheduleLink}
                  onChange={(e) => setRescheduleLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-4 py-3 bg-app-card border border-app-border rounded-xl text-sm text-app-text-bright placeholder-app-text-muted outline-none focus:border-app-accent/60 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={() => setRescheduleModalOpen(false)}
                className="py-3 bg-app-card border border-app-border hover:bg-black/40 text-app-text-muted hover:text-app-text-bright rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleReschedule(selectedMeeting, rescheduleDate, rescheduleLink)}
                className="py-3 bg-app-accent hover:bg-app-accent-light text-black font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Confirm / OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Reschedule Confirmation Modal */}
      {dragRescheduleOpen && dragTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs"></div>
          
          <div className="relative w-full max-w-md bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-2xl space-y-6 z-10">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-2xl font-black text-app-text-bright">Reschedule Session?</h3>
              <p className="text-xs text-app-text-muted leading-relaxed">
                Are you sure you want to reschedule <span className="font-bold text-app-text-bright">{dragTarget.meeting.student.name}</span>'s 
                feedback meeting to <span className="font-bold text-app-accent">{dragTarget.newDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setDragRescheduleOpen(false);
                  setDragTarget(null);
                }}
                className="py-3 bg-app-card border border-app-border hover:bg-black/40 text-app-text-muted hover:text-app-text-bright rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDragReschedule}
                className="py-3 bg-app-accent hover:bg-app-accent-light text-black font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Confirm / OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Mark Complete Modal */}
      {confirmCompleteOpen && selectedMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs"></div>
          
          <div className="relative w-full max-w-md bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-2xl space-y-6 z-10">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-2xl font-black text-app-text-bright">Complete Meeting?</h3>
              <p className="text-xs text-app-text-muted leading-relaxed">
                Confirming will officially mark the feedback session for <span className="font-bold text-app-text-bright">{selectedMeeting.student.name}</span> as completed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setConfirmCompleteOpen(false)}
                className="py-3 bg-app-card border border-app-border hover:bg-black/40 text-app-text-muted hover:text-app-text-bright rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleMarkAsComplete(selectedMeeting)}
                className="py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancellation Modal */}
      {confirmCancelOpen && selectedMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs"></div>
          
          <div className="relative w-full max-w-md bg-app-sidebar border border-app-border rounded-[2.5rem] p-6 shadow-2xl space-y-6 z-10">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-2xl font-black text-app-text-bright">Cancel Meeting?</h3>
              <p className="text-xs text-app-text-muted leading-relaxed">
                Are you sure you want to cancel the feedback meeting for <span className="font-bold text-app-text-bright">{selectedMeeting.student.name}</span>? 
                This action will unschedule the meeting date and time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setConfirmCancelOpen(false)}
                className="py-3 bg-app-card border border-app-border hover:bg-black/40 text-app-text-muted hover:text-app-text-bright rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => handleCancelMeeting(selectedMeeting)}
                className="py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Cancel Meeting
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Meetings;
