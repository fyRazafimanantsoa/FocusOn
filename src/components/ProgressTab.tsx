import React, { useState, useMemo } from "react";
import { FocusSession, UserProfile, Project } from "../types";
import { calculateInsights } from "../lib/db";
import { 
  Flame, 
  Clock, 
  Calendar,
  Lightbulb,
  Trash2,
  BarChart2,
  CalendarDays,
  Gauge,
  Target,
  Sun,
  Sunset,
  Moon,
  TrendingUp,
  BrainCircuit,
  Plus,
  Folder,
  Tag,
  FolderPlus,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileText,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ProgressTabProps {
  sessions: FocusSession[];
  profile: UserProfile | null;
  onDeleteSession: (id: string) => Promise<void>;
  projects: Project[];
  onCreateProject: (name: string, color: string) => Promise<void>;
  onUpdateSessionProject: (sessionId: string, projectId: string | null) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

type TimeView = 'day' | 'week' | 'month';

export default function ProgressTab({ 
  sessions, 
  profile, 
  onDeleteSession,
  projects,
  onCreateProject,
  onUpdateSessionProject,
  onLoadMore,
  hasMore = false
}: ProgressTabProps) {
  const [view, setView] = useState<TimeView>('day');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Search, Filter, and Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(10);

  // Project Creation & Drag Over States
  const [isCreatingProj, setIsCreatingProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjColor, setNewProjColor] = useState("#FFFFFF");
  const [isCreatingProjLoading, setIsCreatingProjLoading] = useState(false);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [activeDropdownSessId, setActiveDropdownSessId] = useState<string | null>(null);

  const insights = calculateInsights(sessions);

  // Project list and time spent calculations
  const projectStats = useMemo(() => {
    const completed = sessions.filter(s => s.completed);
    const statsMap: Record<string, number> = {}; // projectId -> seconds
    
    completed.forEach(s => {
      const pid = s.projectId || "unassigned";
      statsMap[pid] = (statsMap[pid] || 0) + s.actualDurationSeconds;
    });

    const totalSecs = completed.reduce((acc, s) => acc + s.actualDurationSeconds, 0);

    const projsData = projects.map(proj => {
      const secs = statsMap[proj.id] || 0;
      const mins = Math.round(secs / 60);
      const hours = Math.round((secs / 3600) * 10) / 10;
      const pct = totalSecs > 0 ? Math.round((secs / totalSecs) * 100) : 0;
      return {
        ...proj,
        mins,
        hours,
        pct
      };
    });

    const unassignedSecs = statsMap["unassigned"] || 0;
    const unassignedMins = Math.round(unassignedSecs / 60);
    const unassignedHours = Math.round((unassignedSecs / 3600) * 10) / 10;
    const unassignedPct = totalSecs > 0 ? Math.round((unassignedSecs / totalSecs) * 100) : 0;

    return {
      projects: projsData,
      unassigned: {
        id: "unassigned",
        name: "Projectless",
        color: "#666666",
        mins: unassignedMins,
        hours: unassignedHours,
        pct: unassignedPct
      },
      totalSecs
    };
  }, [sessions, projects]);

  // Parse weekly goal minutes from profile, fallback to 150 minutes
  const weeklyGoalMin = profile?.weeklyGoalMinutes ?? 150;
  
  // Calculate completed sessions for the current week only (resets when a new week starts)
  const totalCompletedMinutes = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const distanceToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return sessions
      .filter(s => {
        if (!s.completed) return false;
        try {
          // Parse using createdAt timestamp which is standard ISO and timezone-aware
          const sessionDate = new Date(s.createdAt);
          return sessionDate >= startOfWeek;
        } catch {
          return false;
        }
      })
      .reduce((acc, s) => acc + (s.actualDurationSeconds / 60), 0);
  }, [sessions]);

  // Calculate percentage of weekly goal completed (capped at 100%)
  const goalCompletionPercentage = useMemo(() => {
    if (weeklyGoalMin <= 0) return 0;
    return Math.min(100, Math.round((totalCompletedMinutes / weeklyGoalMin) * 100));
  }, [totalCompletedMinutes, weeklyGoalMin]);

  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};

    sessions.forEach(s => {
      let key = s.dateStr;
      
      // Parse YYYY-MM-DD as a local date to prevent standard JS UTC timezone shifts
      const parts = s.dateStr.split('-');
      const date = parts.length === 3 
        ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        : new Date(s.createdAt || s.dateStr);

      if (view === 'day') {
        key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (view === 'week') {
        const diff = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
        const mon = new Date(new Date(date).setDate(diff));
        key = `Wk ${mon.getMonth() + 1}/${mon.getDate()}`;
      } else if (view === 'month') {
        key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }

      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += s.actualDurationSeconds / 60; // in minutes
    });

    // sort properly and take last 10 entries max for chart readability
    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value: Math.round(value)
    })).slice(-10);
  }, [sessions, view]);

  // Helper to format actual date and time elegantly for each session
  const formatSessionDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "Unknown date";
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "Unknown date";
    }
  };

  const getBestTimeIcon = (timeStr: string) => {
    const norm = timeStr.toLowerCase();
    if (norm.includes("morning")) return <Sun className="w-4 h-4 text-amber-400 shrink-0" />;
    if (norm.includes("afternoon")) return <Sunset className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <Moon className="w-4 h-4 text-indigo-400 shrink-0" />;
  };

  const handleDeleteClick = async (id: string) => {
    setIsDeleting(id);
    try {
      await onDeleteSession(id);
    } catch (err) {
      console.error("Failed to delete session record:", err);
    } finally {
      setIsDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  const currentWeekStats = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeeksSessions = sessions.filter(s => {
      if (!s.completed) return false;
      try {
        const sessionDate = new Date(s.createdAt);
        return sessionDate >= startOfWeek;
      } catch {
        return false;
      }
    });

    const totalMinutes = thisWeeksSessions.reduce((acc, s) => acc + (s.actualDurationSeconds / 60), 0);
    const count = thisWeeksSessions.length;
    
    // Group by projects
    const projMinutesMap: Record<string, number> = {};
    thisWeeksSessions.forEach(s => {
      const pid = s.projectId || "unassigned";
      projMinutesMap[pid] = (projMinutesMap[pid] || 0) + (s.actualDurationSeconds / 60);
    });

    const projectBreakdown = Object.entries(projMinutesMap).map(([pid, mins]) => {
      const proj = projects.find(p => p.id === pid);
      return {
        name: proj ? proj.name : "Projectless",
        color: proj ? proj.color : "#666666",
        minutes: Math.round(mins)
      };
    }).sort((a, b) => b.minutes - a.minutes);

    const startFormatted = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      sessions: thisWeeksSessions,
      totalMinutes: Math.round(totalMinutes),
      count,
      projectBreakdown,
      startFormatted
    };
  }, [sessions, projects]);

  const handleExportCSV = () => {
    const completed = sessions.filter(s => s.completed);
    if (completed.length === 0) return;
    
    // Header row
    const headers = ["Date", "Task Name", "Project Name", "Initial Micro-step", "Duration (Minutes)", "Reflection Notes", "Suggested Next Step"];
    
    // Data rows
    const rows = completed.map(s => {
      const projName = projects.find(p => p.id === s.projectId)?.name || "Projectless";
      const durationMins = Math.round(s.actualDurationSeconds / 60);
      const cleanedReflection = s.reflectionNotes ? s.reflectionNotes.replace(/"/g, '""') : "";
      const cleanedTinyStep = s.tinyStep ? s.tinyStep.replace(/"/g, '""') : "";
      const cleanedNextStep = s.nextStepSuggested ? s.nextStepSuggested.replace(/"/g, '""') : "";
      
      return [
        s.dateStr,
        `"${s.taskName.replace(/"/g, '""')}"`,
        `"${projName.replace(/"/g, '""')}"`,
        `"${cleanedTinyStep}"`,
        durationMins,
        `"${cleanedReflection}"`,
        `"${cleanedNextStep}"`
      ];
    });
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cognitive_flow_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const completed = sessions.filter(s => s.completed);
    if (completed.length === 0) return;
    
    const blob = new Blob([JSON.stringify(completed, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `cognitive_flow_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Staggered animation cards
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  // Filtered and searched sessions for history listing
  const filteredSessions = useMemo(() => {
    return sessions.filter((sess) => {
      // 1. Text Search query
      const matchesSearch =
        !searchQuery.trim() ||
        sess.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sess.reflectionNotes && sess.reflectionNotes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sess.tinyStep && sess.tinyStep.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sess.nextStepSuggested && sess.nextStepSuggested.toLowerCase().includes(searchQuery.toLowerCase()));

      // 2. Project Filter
      let matchesProject = true;
      if (filterProjectId === "loose") {
        matchesProject = !sess.projectId;
      } else if (filterProjectId !== "all") {
        matchesProject = sess.projectId === filterProjectId;
      }

      return matchesSearch && matchesProject;
    });
  }, [sessions, searchQuery, filterProjectId]);

  const handleLoadMoreClick = () => {
    if (visibleLimit < filteredSessions.length) {
      setVisibleLimit((prev) => prev + 15);
    } else if (hasMore && onLoadMore) {
      onLoadMore();
      setVisibleLimit((prev) => prev + 15);
    }
  };

  const showLoadMore = visibleLimit < filteredSessions.length || (hasMore && filteredSessions.length > 0);

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-1 space-y-6 animate-fade-in" id="progress-tab-viewport">
      
      {/* Title Block & Topline Badges */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left border-b border-[#2A2A2A] pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-zinc-300" />
            Performance & Diagnostics Telemetry
          </h2>
          <p className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            Sovereign ADHD Flow State Optimization Index
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="px-2.5 py-1 rounded bg-[#121212] border border-[#2A2A2A] text-[9px] font-mono text-[#888888] flex items-center gap-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Adaptive Core Engaged
          </div>
          <div className="px-2.5 py-1 rounded bg-[#121212] border border-[#2A2A2A] text-[9px] font-mono text-white select-none">
            Total Logs: {sessions.filter(s => s.completed).length} Cycles
          </div>
        </div>
      </div>

      {/* 4 KPI Cards Grid at the Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Circular Gauge Card */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded p-4 flex flex-col justify-between h-48 relative overflow-hidden text-left">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Weekly Target</span>
            <span className="text-[9px] font-mono text-[#888888] bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#2A2A2A]">
              Goal: {weeklyGoalMin}m
            </span>
          </div>
          <div className="flex items-center gap-4 py-1">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-zinc-800"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-white transition-all duration-1000"
                  strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - goalCompletionPercentage / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold font-mono text-white leading-none">{goalCompletionPercentage}%</span>
                <span className="text-[7.5px] font-mono text-zinc-500 uppercase mt-0.5">done</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-medium text-white tracking-tight leading-none font-mono">
                {Math.round(totalCompletedMinutes)} <span className="text-xs font-normal text-zinc-500">mins</span>
              </p>
              <p className="text-[9px] text-[#666666] font-mono uppercase tracking-wider">
                Completed flow time
              </p>
            </div>
          </div>
          <p className="text-[9.5px] text-[#666666] leading-relaxed">
            {goalCompletionPercentage >= 100 
              ? "Weekly goal reached! Take some time to celebrate, breathe, and rest." 
              : `${Math.round(Math.max(0, weeklyGoalMin - totalCompletedMinutes))} mins left to meet weekly focus goal.`
            }
          </p>
        </div>

        {/* Active Streak Indicator Card */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded p-4 flex flex-col justify-between h-48 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Active Streak</span>
            </div>
            <span className="text-[9px] font-mono text-[#888888] bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#2A2A2A]">
              Steady
            </span>
          </div>
          <div className="py-1">
            <p className="text-4xl font-medium text-white tracking-tight leading-none font-mono">
              {insights.activeStreak} <span className="text-xs font-normal text-[#666666]">days</span>
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Consecutive starting days
            </p>
          </div>
          
          {/* Minimal Week Activity Indicator dots */}
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }).map((_, idx) => {
                const isActive = idx < insights.activeStreak;
                return (
                  <div 
                    key={idx} 
                    className={`h-1.5 flex-1 rounded-sm ${
                      isActive 
                        ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.45)]" 
                        : "bg-zinc-800/80"
                    }`} 
                    title={isActive ? "Flow registered" : "Rest cycle"}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[7px] font-mono text-[#666666] uppercase tracking-wider">
              <span>Day 1</span>
              <span>Day 7</span>
            </div>
          </div>
        </div>

        {/* Distraction Recovery Card */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded p-4 flex flex-col justify-between h-48 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Distraction Recovery</span>
            </div>
          </div>
          <div className="py-1">
            <p className="text-4xl font-medium text-white tracking-tight leading-none font-mono">
              {insights.learningRatio}% <span className="text-xs font-normal text-[#666666]">re-centered</span>
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Distraction Recovery Rate
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-[#1A1A1A] relative rounded-sm overflow-hidden border border-zinc-900">
              <div 
                className="h-full bg-white transition-all duration-1000" 
                style={{ width: `${insights.learningRatio}%` }} 
              />
            </div>
            <div className="flex justify-between text-[7.5px] font-mono text-[#666666] uppercase">
              <span>Distracted</span>
              <span>Focused</span>
            </div>
          </div>
        </div>

        {/* Peak Focus Zone Card */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded p-4 flex flex-col justify-between h-48 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0">{getBestTimeIcon(insights.bestTimeOfDay)}</span>
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Peak Focus Zone</span>
            </div>
          </div>
          <div className="py-1">
            <p className="text-3xl font-medium text-white tracking-tight leading-none capitalize font-mono">
              {insights.bestTimeOfDay}
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Natural Focus Window
            </p>
          </div>
          
          {/* Minimalist Day Phase Line */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              {['Morning', 'Afternoon', 'Evening'].map((phase) => {
                const isPeak = insights.bestTimeOfDay.toLowerCase() === phase.toLowerCase();
                return (
                  <div 
                    key={phase} 
                    className={`text-[8px] font-mono text-center flex-1 py-1 rounded-sm border ${
                      isPeak 
                        ? "border-white bg-[#1A1A1A] text-white" 
                        : "border-[#2A2A2A] bg-transparent text-zinc-500"
                    }`}
                  >
                    {phase.slice(0, 3)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Main Flow Allocation Graph & Cognitive Advice */}
      <div className="space-y-4">
        
        {/* Activity Graph Card */}
        {sessions.length > 0 ? (
          <div className="bg-[#121212] border border-[#2A2A2A] rounded p-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#888888] shrink-0" />
                <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest font-bold">
                  Flow Allocation Activity (m)
                </span>
              </div>
              <div className="flex gap-1 border border-[#2A2A2A]/80 rounded p-0.5">
                {['day', 'week', 'month'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v as TimeView)}
                    className={`px-2.5 py-1 text-[9px] uppercase font-mono font-medium tracking-wider rounded transition-colors cursor-pointer ${
                      view === v 
                        ? 'bg-[#1A1A1A] text-white' 
                        : 'text-[#666666] hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-48 w-full mt-2 min-h-[192px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="w-full h-full"
                >
                  <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--text-accent)" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="var(--bg-app)" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="name" 
                        stroke="var(--text-muted)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                        className="font-mono"
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.02)', radius: [0, 0, 0, 0] }}
                        contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-app)', borderRadius: '4px', fontSize: '11px' }}
                        labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px', fontFamily: 'monospace' }}
                        itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                        formatter={(value) => [`${value} mins`, 'Focus Period']}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="url(#barGradient)" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={28}
                        isAnimationActive={true}
                        animationDuration={800}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="py-12 border border-dashed border-[#2A2A2A] rounded flex flex-col items-center justify-center text-center p-6 space-y-2 bg-[#121212]/30">
            <BarChart2 className="w-8 h-8 text-[#555555] stroke-[1.5]" />
            <h4 className="text-white text-xs font-mono uppercase tracking-wider">No focus data yet</h4>
            <p className="text-zinc-500 text-[11px] max-w-xs leading-relaxed">
              Log a focus session to see your focus distribution graph.
            </p>
          </div>
        )}

        {/* ADHD Companion Tips Section */}
        <div className="p-4 rounded bg-[#121212] border border-[#2A2A2A] flex gap-3 text-left">
          <Lightbulb className="w-5 h-5 text-white shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-[#888888] tracking-wider uppercase block">ADHD Focus Tips</span>
            <p className="text-white text-xs leading-relaxed">
              {sessions.length === 0
                ? "No focus sessions recorded yet. Try a focus cycle in the Flow tab and helpful focus tips will show up here!"
                : insights.activeStreak > 2
                  ? "Excellent consistency! Break down your next task to make starting completely effortless."
                  : `Based on your logs, your brain focuses best in the ${insights.bestTimeOfDay.toLowerCase()}! Try planning your most important tasks during this window.`}
            </p>
          </div>
        </div>

        {/* This Week's Summary */}
        <div className="bg-[#121212] border border-[#2A2A2A] rounded p-5 space-y-4 text-left">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#2A2A2A] pb-3">
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest font-bold block">This Week's Summary</span>
              <p className="text-[10px] text-zinc-500 font-mono">Starting {currentWeekStats.startFormatted}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {/* Left side: Stats breakdown */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1A1A1C] border border-zinc-850 rounded p-3 text-left">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">Completed</span>
                  <p className="text-2xl font-bold text-white font-mono mt-0.5">
                    {currentWeekStats.count} <span className="text-[10px] text-zinc-500 font-normal">cycles</span>
                  </p>
                </div>
                <div className="bg-[#1A1A1C] border border-zinc-850 rounded p-3 text-left">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">Duration</span>
                  <p className="text-2xl font-bold text-white font-mono mt-0.5">
                    {currentWeekStats.totalMinutes} <span className="text-[10px] text-zinc-500 font-normal">mins</span>
                  </p>
                </div>
              </div>

              <p className="text-zinc-400 text-xs leading-relaxed">
                {currentWeekStats.count === 0 
                  ? "No focus sessions completed this week yet. Switch to the Flow tab to trigger your first focus period."
                  : `You completed ${currentWeekStats.count} high-intensity focus periods this week, logging ${currentWeekStats.totalMinutes} minutes of focused cognitive effort. High focus levels keep you shielded against executive drift.`
                }
              </p>
            </div>

            {/* Right side: Project focus allocation of this week */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Weekly Project Focus Distribution</span>
              
              {currentWeekStats.projectBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center py-6 border border-dashed border-zinc-800 rounded bg-zinc-900/10">
                  <span className="text-[10px] font-mono text-zinc-600 uppercase">No project data this week</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                  {currentWeekStats.projectBreakdown.map((proj) => {
                    const pct = currentWeekStats.totalMinutes > 0 
                      ? Math.round((proj.minutes / currentWeekStats.totalMinutes) * 100) 
                      : 0;
                    return (
                      <div key={proj.name} className="space-y-1 text-left">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                            {proj.name}
                          </span>
                          <span className="text-zinc-500 font-bold">{proj.minutes}m ({pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-700" 
                            style={{ backgroundColor: proj.color, width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Projects Tracker Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 text-left">
            <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest block">
              Time Spent by Projects
            </h3>
            <p className="text-[10px] text-[#666666]">
              Drag a session from the log below and drop it here to categorize.
            </p>
          </div>
          {!isCreatingProj && (
            <button
              onClick={() => setIsCreatingProj(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-mono uppercase bg-[#121212] hover:bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border border-[#2A2A2A] hover:border-[#444444] rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> New Project
            </button>
          )}
        </div>

        {isCreatingProj && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#121212] border border-[#2A2A2A] rounded space-y-3 text-left"
          >
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-wider">Configure Custom Project</span>
              <button 
                onClick={() => {
                  setIsCreatingProj(false);
                  setNewProjName("");
                }}
                className="text-[#666666] hover:text-white text-[10px] font-mono uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[8px] font-mono text-[#666666] block mb-1 uppercase tracking-wider">Project Title</label>
                <input
                  type="text"
                  placeholder="e.g. Development, Writing, Research"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="w-full premium-input text-white text-xs rounded px-3 py-2 outline-none font-mono bg-black border border-[#2A2A2A]"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-[8px] font-mono text-[#666666] block mb-1.5 uppercase tracking-wider">Accent Circle</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "#3B82F6", // Blue
                    "#8B5CF6", // Violet
                    "#10B981", // Emerald
                    "#F43F5E", // Rose
                    "#F59E0B", // Amber
                    "#06B6D4", // Teal
                    "#EC4899", // Pink
                    "#FFFFFF"  // White
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewProjColor(color)}
                      className="w-5 h-5 rounded-full border transition-all cursor-pointer"
                      style={{ 
                        backgroundColor: color,
                        borderColor: newProjColor === color ? "#FFFFFF" : "transparent",
                        transform: newProjColor === color ? "scale(1.15)" : "none",
                        boxShadow: newProjColor === color ? "0 0 4px rgba(255, 255, 255, 0.4)" : "none"
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                disabled={!newProjName.trim() || isCreatingProjLoading}
                onClick={async () => {
                  if (!newProjName.trim()) return;
                  setIsCreatingProjLoading(true);
                  try {
                    await onCreateProject(newProjName.trim(), newProjColor);
                    setNewProjName("");
                    setIsCreatingProj(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsCreatingProjLoading(false);
                  }
                }}
                className="px-3 py-1.5 bg-white hover:bg-[#F0F0F0] text-black font-semibold text-[10px] font-mono uppercase tracking-wider rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCreatingProjLoading ? "Saving..." : "Add Project"}
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Projects List */}
          {projectStats.projects.map((proj) => {
            const isOver = dragOverProjectId === proj.id;
            return (
              <div
                key={proj.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverProjectId(proj.id);
                }}
                onDragLeave={() => setDragOverProjectId(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  const sessionId = e.dataTransfer.getData("text/plain");
                  if (sessionId) {
                    await onUpdateSessionProject(sessionId, proj.id);
                  }
                  setDragOverProjectId(null);
                }}
                className={`p-4 rounded border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isOver 
                    ? "border-white bg-[#1A1A1A] scale-[1.02]" 
                    : "border-[#2A2A2A] bg-[#121212] hover:border-[#444444]"
                }`}
                style={{ 
                  borderLeft: `3px solid ${proj.color}`
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#888888] tracking-wide block uppercase truncate max-w-[80%]">
                      {proj.name}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                  </div>
                  <div className="text-base font-semibold tracking-tight text-white font-mono">
                    {proj.hours > 0 ? `${proj.hours}h` : `${proj.mins}m`}
                  </div>
                </div>
                <div className="text-[9px] text-[#555555] font-mono mt-2 flex justify-between items-center">
                  <span>{sessions.filter(s => s.completed && s.projectId === proj.id).length} cycles</span>
                  <span className="text-[8px] bg-[#1A1A1A] px-1 rounded text-[#888888]">{proj.pct}%</span>
                </div>
              </div>
            );
          })}

          {/* Unassigned Card */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverProjectId("unassigned");
            }}
            onDragLeave={() => setDragOverProjectId(null)}
            onDrop={async (e) => {
              e.preventDefault();
              const sessionId = e.dataTransfer.getData("text/plain");
              if (sessionId) {
                await onUpdateSessionProject(sessionId, null);
              }
              setDragOverProjectId(null);
            }}
            className={`p-4 rounded border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              dragOverProjectId === "unassigned"
                ? "border-white bg-[#1A1A1A] scale-[1.02]"
                : "border-dashed border-[#2A2A2A] bg-transparent hover:border-[#444444]"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#666666] tracking-wide block uppercase">
                  Loose / Projectless
                </span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#333333]" />
              </div>
              <div className="text-base font-semibold tracking-tight text-[#888888] font-mono">
                {projectStats.unassigned.hours > 0 ? `${projectStats.unassigned.hours}h` : `${projectStats.unassigned.mins}m`}
              </div>
            </div>
            <div className="text-[9px] text-[#555555] font-mono mt-2 flex justify-between items-center">
              <span>{sessions.filter(s => s.completed && !s.projectId).length} cycles</span>
              <span className="text-[8px] bg-[#121212] border border-[#2A2A2A] px-1 rounded text-[#666666]">{projectStats.unassigned.pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Session History Log */}
      <div className="space-y-4 pb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest block text-left">
            Completed Sessions log ({filteredSessions.length === sessions.length ? sessions.length : `${filteredSessions.length} of ${sessions.length}`})
          </h3>
          <span className="text-[9px] font-mono text-[#666666]">Secure Local Datastore</span>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#121212] border border-[#2A2A2A] rounded">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search session tasks, notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(10); // Reset local visibility limit on search to avoid out-of-bounds scrolling
              }}
              className="w-full bg-black border border-[#2A2A2A] rounded pl-8 pr-12 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-500 hover:text-white uppercase tracking-wider"
              >
                Clear
              </button>
            )}
          </div>

          {/* Project dropdown selection */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider hidden xs:inline">
              Project:
            </span>
            <select
              value={filterProjectId}
              onChange={(e) => {
                setFilterProjectId(e.target.value);
                setVisibleLimit(10); // Reset local visibility limit on filter to keep listing clean
              }}
              className="bg-black border border-[#2A2A2A] rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500 transition-colors cursor-pointer"
            >
              <option value="all">All Projects</option>
              <option value="loose">Loose (Projectless)</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {sessions.length === 0 ? (
          <div className="py-12 border border-[#2A2A2A] rounded flex flex-col items-center justify-center text-center p-6 space-y-3 bg-[#121212]">
            <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-[#888888]" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-white font-medium text-xs tracking-wider">No active session logs detected.</h4>
              <p className="text-[#666666] text-xs leading-relaxed">
                Your completed micro-actions and reflections will appear here dynamically.
              </p>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 border border-dashed border-[#2A2A2A] rounded flex flex-col items-center justify-center text-center p-6 space-y-2 bg-[#0C0D0E]">
            <span className="text-xs text-zinc-500 font-mono">No matching sessions found.</span>
            <p className="text-[#666666] text-[11px] max-w-xs">
              Adjust your search keywords or project dropdown filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredSessions.slice(0, visibleLimit).map((sess) => {
                const sessProj = projects.find(p => p.id === sess.projectId);
                return (
                  <motion.div
                    key={sess.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    viewport={{ once: true }}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", sess.id);
                    }}
                    className="p-4 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors group relative overflow-hidden cursor-grab active:cursor-grabbing"
                  >
                    <div className="space-y-1.5 shrink-0 flex-1 text-left w-full sm:max-w-[70%]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span 
                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: sessProj ? sessProj.color : "#888888" }} 
                        />
                        <h4 className="text-white text-xs sm:text-sm font-medium leading-tight truncate">{sess.taskName}</h4>
                        
                        {/* Interactive Project Tag with Quick Dropdown Selection */}
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownSessId(activeDropdownSessId === sess.id ? null : sess.id);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-[#121212] border border-[#2A2A2A] hover:border-[#666666] text-[#888888] hover:text-white transition-all cursor-pointer select-none"
                            style={{ 
                              borderColor: sessProj ? `${sessProj.color}40` : undefined,
                              color: sessProj ? sessProj.color : undefined
                            }}
                          >
                            {sessProj ? sessProj.name : "Loose"}
                          </button>

                          {activeDropdownSessId === sess.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 bg-transparent" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownSessId(null);
                                }}
                              />
                              <div 
                                className="absolute left-0 mt-1.5 w-40 bg-[#0C0D0E] border border-[#2A2A2A] rounded shadow-2xl z-50 p-1 flex flex-col gap-0.5 animate-fade-in"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[7.5px] font-mono text-zinc-500 px-2 py-1 uppercase tracking-widest block text-left border-b border-[#1A1A1A] mb-1">
                                  Quick Assign
                                </span>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateSessionProject(sess.id, null);
                                    setActiveDropdownSessId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-[9px] font-mono text-zinc-400 hover:text-white hover:bg-[#1A1A1A]/80 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#666666]" />
                                  Loose (Projectless)
                                </button>

                                {projects.map(proj => (
                                  <button
                                    key={proj.id}
                                    type="button"
                                    onClick={() => {
                                      onUpdateSessionProject(sess.id, proj.id);
                                      setActiveDropdownSessId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-[9px] font-mono text-[#888888] hover:text-white hover:bg-[#1A1A1A]/80 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                                    {proj.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    <div className="text-[#666666] text-[11px] font-mono flex flex-wrap items-center gap-1.5">
                      <span className="text-[#888888]">Starting point:</span> 
                      <span className="text-[#CCCCCC] truncate max-w-[200px]">{sess.tinyStep}</span>
                    </div>
                    
                    {sess.reflectionNotes && (
                      <p className={`${profile?.theme === "light" ? "text-black font-medium" : "text-[#666666]"} text-[11px] leading-relaxed italic border-l border-[#2A2A2A] pl-2 mt-1`}>
                        "{sess.reflectionNotes}"
                      </p>
                    )}

                    {sess.nextStepSuggested && (
                      <p className="text-[#666666] text-[10px] leading-relaxed font-mono flex items-center gap-1.5">
                        <span className="text-[#888888]">Next milestone:</span>
                        <span className="text-[#CCCCCC]">{sess.nextStepSuggested}</span>
                      </p>
                    )}
                  </div>

                  {/* Date and actions */}
                  <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-[#2A2A2A] sm:border-0 gap-3">
                    <div className="flex flex-col items-start sm:items-end font-mono">
                      <span className="text-[10px] text-[#666666] font-medium whitespace-nowrap">
                        {formatSessionDateTime(sess.createdAt)}
                      </span>
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-[#121212] border border-[#2A2A2A] w-fit text-[#888888] text-[8px] font-mono uppercase mt-1 tracking-wider">
                        {Math.round(sess.actualDurationSeconds / 60)}m logged
                      </span>
                    </div>
                    {confirmDeleteId === sess.id ? (
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => sess.id && handleDeleteClick(sess.id)}
                          disabled={isDeleting === sess.id}
                          className="px-2 py-1 bg-[#121212] hover:bg-[#1A1A1A] text-white text-[10px] font-mono uppercase rounded border border-[#2A2A2A] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {isDeleting === sess.id ? "Purging" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeleting === sess.id}
                          className="px-2 py-1 bg-transparent hover:bg-[#121212] text-[#888888] hover:text-white text-[10px] font-mono uppercase rounded border border-[#2A2A2A] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => sess.id && setConfirmDeleteId(sess.id)}
                        disabled={isDeleting !== null}
                        className="p-2 bg-[#121212] rounded text-[#666666] hover:text-white border border-[#2A2A2A] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 cursor-pointer"
                        title="Purge session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Load More Button */}
            {showLoadMore && (
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMoreClick}
                  className="px-6 py-2 bg-[#121212] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-zinc-500 text-zinc-300 hover:text-white text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all duration-300 cursor-pointer"
                >
                  Load More Sessions
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
