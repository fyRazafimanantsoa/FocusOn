import React, { useState, useMemo } from "react";
import { FocusSession, UserProfile } from "../types";
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
  BrainCircuit
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ProgressTabProps {
  sessions: FocusSession[];
  profile: UserProfile | null;
  onDeleteSession: (id: string) => Promise<void>;
}

type TimeView = 'day' | 'week' | 'month';

export default function ProgressTab({ sessions, profile, onDeleteSession }: ProgressTabProps) {
  const [view, setView] = useState<TimeView>('day');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const insights = calculateInsights(sessions);

  // Parse weekly goal minutes from profile, fallback to 150 minutes
  const weeklyGoalMin = profile?.weeklyGoalMinutes ?? 150;
  
  // Calculate completed sessions overall minutes
  const totalCompletedMinutes = useMemo(() => {
    return sessions
      .filter(s => s.completed)
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
      const date = new Date(s.dateStr);

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

  return (
    <div className="w-full max-w-xl mx-auto py-2 px-1 space-y-6 animate-fade-in" id="progress-tab-viewport">
      
      {/* Title Block */}
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
          <BrainCircuit className="w-6 h-6 text-zinc-300" />
          Focus Sandbox Insights
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm">
          A transparent, metrics-driven view of your mental flow cycles.
        </p>
      </div>

      {/* Bento Grid layout of Key Stats */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {/* Stat Card 1: TOTAL FOCUS HOURS & PROGRESS */}
        <motion.div 
          variants={cardVariants} 
          className="bg-[#121212]/80 backdrop-blur-md border border-[#2A2A2A]/80 rounded p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Total Focus</span>
            </div>
            <span className="text-[9px] font-mono text-[#888888] bg-[#1A1A1A] border border-[#2A2A2A] px-1.5 py-0.5 rounded">
              {sessions.filter(s => s.completed).length} Blocks
            </span>
          </div>
          <div className="py-2">
            <p className="text-4xl font-medium text-white tracking-tight leading-none">
              {insights.totalHours} <span className="text-sm font-normal text-[#666666]">hours</span>
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Cumulative flow time
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] font-mono text-[#888888]">
              <span>Weekly Goal ({weeklyGoalMin}m)</span>
              <span>{goalCompletionPercentage}%</span>
            </div>
            <div className="w-full h-1 bg-[#1A1A1A] overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500" 
                style={{ width: `${goalCompletionPercentage}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stat Card 2: STARTING STREAK */}
        <motion.div 
          variants={cardVariants} 
          className="bg-[#121212]/80 backdrop-blur-md border border-[#2A2A2A]/80 rounded p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Active Streak</span>
            </div>
            <span className="text-[9px] font-mono text-[#666666] uppercase">
              Steady
            </span>
          </div>
          <div className="py-2">
            <p className="text-4xl font-medium text-white tracking-tight leading-none">
              {insights.activeStreak} <span className="text-sm font-normal text-[#666666]">days</span>
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Consecutive starting days
            </p>
          </div>
          <p className="text-[10px] text-[#666666] leading-normal">
            {insights.activeStreak > 0 
              ? `You kept the distraction barriers low for ${insights.activeStreak} days.` 
              : "Keep startup friction minimal by planning your first tiny step today."
            }
          </p>
        </motion.div>

        {/* Stat Card 3: CORE RESILIENCE RATIO */}
        <motion.div 
          variants={cardVariants} 
          className="bg-[#121212]/80 backdrop-blur-md border border-[#2A2A2A]/80 rounded p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Steering Resilience</span>
            </div>
          </div>
          <div className="py-2">
            <p className="text-4xl font-medium text-white tracking-tight leading-none">
              {insights.learningRatio}% <span className="text-sm font-normal text-[#666666]">recovery</span>
            </p>
            <p className="text-[10px] text-[#666666] pt-1.5 font-mono uppercase tracking-wider">
              Distraction Recovery Rate
            </p>
          </div>
          <p className="text-[10px] text-[#666666]">
            Percentage of cognitive drifts steered back to constructive tasks.
          </p>
        </motion.div>

        {/* Stat Card 4: PEAK FLOW TIMESPOT */}
        <motion.div 
          variants={cardVariants} 
          className="bg-[#121212]/80 backdrop-blur-md border border-[#2A2A2A]/80 rounded p-4 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0">{getBestTimeIcon(insights.bestTimeOfDay)}</span>
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">Peak Focus Zone</span>
            </div>
          </div>
          <div className="py-2">
            <p className="text-3xl font-medium text-white tracking-tight leading-none capitalize">
              {insights.bestTimeOfDay}
            </p>
            <p className="text-[10px] text-[#666666] pt-2 font-mono uppercase tracking-wider">
              Natural Focus Window
            </p>
          </div>
          <p className="text-[10px] text-[#666666]">
            Your sessions primarily settle into {insights.bestTimeOfDay.toLowerCase()} cycles.
          </p>
        </motion.div>
      </motion.div>

      {/* Time Usage Chart with Premium Visuals */}
      {sessions.length > 0 ? (
        <div className="bg-[#121212]/85 backdrop-blur-md border border-[#2A2A2A]/80 rounded p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#888888] shrink-0" />
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest font-bold">Flow Allocation Activity (m)</span>
            </div>
            <div className="flex gap-1 border border-[#2A2A2A]/80 rounded p-0.5">
              {['day', 'week', 'month'].map((v) => (
                <button
                  key={v}
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
          
          <div className="h-44 w-full mt-2 min-h-[176px]">
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.88} />
                    <stop offset="100%" stopColor="#27272A" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                  className="font-mono"
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)', radius: [0, 0, 0, 0] }}
                  contentStyle={{ backgroundColor: '#090a0c', border: '1px solid #27272a', borderRadius: '4px', fontSize: '11px' }}
                  labelStyle={{ color: '#a1a1aa', fontWeight: 600, marginBottom: '2px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#f4f4f5', fontWeight: 600 }}
                  formatter={(value) => [`${value} mins`, 'Focus Period']}
                />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGradient)" 
                  radius={[0, 0, 0, 0]} 
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* Clinical Cognitive Advice Section */}
      <div className="p-4 rounded bg-[#121212] border border-[#2A2A2A] flex gap-3 text-left">
        <Lightbulb className="w-5 h-5 text-white shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-[#888888] tracking-wider uppercase block">Personalized Adaptive Advice</span>
          <p className="text-white text-xs leading-relaxed">
            {sessions.length === 0 
              ? "Your Sandbox has no registered focus sessions. Complete your first focus cycle in the Flow tab, and this adaptive system will automatically evaluate your logs to output optimization parameters."
              : insights.activeStreak > 2 
                ? "Excellent consistency. Keep startup friction minimal by planning your first tiny step today."
                : `Based on your logs, your peak focus hour resides in the ${insights.bestTimeOfDay.toLowerCase()} period. Align high-stakes tasks in this zone.`}
          </p>
        </div>
      </div>

      {/* Session History Log */}
      <div className="space-y-4 pb-12">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest block text-left">
            Completed Sessions log ({sessions.length})
          </h3>
          <span className="text-[9px] font-mono text-[#666666]">Secure Local Datastore</span>
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
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {sessions.map((sess) => (
                <motion.div
                  key={sess.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  viewport={{ once: true }}
                  className="p-4 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors group relative overflow-hidden"
                >
                  <div className="space-y-1.5 shrink-0 flex-1 text-left w-full sm:max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#888888] shrink-0" />
                      <h4 className="text-white text-xs sm:text-sm font-medium leading-tight truncate">{sess.taskName}</h4>
                    </div>
                    <div className="text-[#666666] text-[11px] font-mono flex flex-wrap items-center gap-1.5">
                      <span className="text-[#888888]">Starting point:</span> 
                      <span className="text-[#CCCCCC] truncate max-w-[200px]">{sess.tinyStep}</span>
                    </div>
                    
                    {sess.reflectionNotes && (
                      <p className="text-[#666666] text-[11px] leading-relaxed italic border-l border-[#2A2A2A] pl-2 mt-1">
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
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
