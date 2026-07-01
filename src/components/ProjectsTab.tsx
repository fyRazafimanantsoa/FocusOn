import React, { useState, useMemo } from "react";
import { Project, FocusSession, UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  FolderKanban, 
  Plus, 
  Trash2, 
  Archive, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  Edit2, 
  FolderOpen,
  Zap,
  Tag
} from "lucide-react";

interface ProjectsTabProps {
  sessions: FocusSession[];
  projects: Project[];
  onCreateProject: (name: string, color: string) => Promise<void>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  profile: UserProfile | null;
}

export default function ProjectsTab({ 
  sessions, 
  projects, 
  onCreateProject, 
  onUpdateProject, 
  onDeleteProject,
  profile 
}: ProjectsTabProps) {
  const theme = profile?.theme || "dark";
  const [expandedProjId, setExpandedProjId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjColor, setNewProjColor] = useState("#3B82F6");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);

  // Edit states
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Confirmation state for deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Get start of current week (Sunday)
  const startOfWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const sunday = new Date(now.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }, []);

  // Compute stats for each project
  const projectStats = useMemo(() => {
    return projects.map(proj => {
      const projSessions = sessions.filter(s => s.completed && s.projectId === proj.id);
      const totalSecs = projSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);

      // Current week focused seconds
      const weekSessions = projSessions.filter(s => {
        const sessDate = new Date(s.createdAt);
        return sessDate >= startOfWeek;
      });
      const weekSecs = weekSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0);
      const weekHours = weekSecs / 3600;

      return {
        id: proj.id,
        hours,
        mins,
        weekHours,
        sessionCount: projSessions.length,
        lastActive: projSessions.length > 0 ? new Date(projSessions[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Never",
      };
    });
  }, [projects, sessions, startOfWeek]);

  // Compute stats for Unassigned / Loose
  const looseStats = useMemo(() => {
    const looseSessions = sessions.filter(s => s.completed && !s.projectId);
    const totalSecs = looseSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);

    const weekSessions = looseSessions.filter(s => {
      const sessDate = new Date(s.createdAt);
      return sessDate >= startOfWeek;
    });
    const weekSecs = weekSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0);
    const weekHours = weekSecs / 3600;

    return {
      hours,
      mins,
      weekHours,
      sessionCount: looseSessions.length,
      lastActive: looseSessions.length > 0 ? new Date(looseSessions[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Never",
    };
  }, [sessions, startOfWeek]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim() || isCreatingLoading) return;
    setIsCreatingLoading(true);
    try {
      await onCreateProject(newProjName.trim(), newProjColor);
      setNewProjName("");
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingLoading(false);
    }
  };

  const startEditing = (proj: Project) => {
    setEditingProjId(proj.id);
    setEditName(proj.name);
    setEditColor(proj.color);
  };

  const handleSaveEdit = async (projId: string) => {
    if (!editName.trim()) return;
    try {
      await onUpdateProject(projId, { name: editName.trim(), color: editColor });
      setEditingProjId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (projId: string) => {
    try {
      await onDeleteProject(projId);
      if (expandedProjId === projId) {
        setExpandedProjId(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-1 space-y-6 animate-fade-in" id="projects-tab-viewport">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left border-b border-[#2A2A2A] pb-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-zinc-300" />
            Workload Registry
          </h2>
          <p className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
            Configure focused environments, goals, and customized session lengths.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold uppercase tracking-wider rounded transition-colors cursor-pointer self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        )}
      </div>

      {/* Inline Create Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.form
            onSubmit={handleCreate}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden p-5 bg-black border border-[#2A2A2A] rounded space-y-4 text-left shadow-[2px_2px_0px_#000000]"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">New Workload Stream</span>
              <button 
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewProjName("");
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-mono text-[#888888] uppercase block mb-1 tracking-wider">Project Name</label>
                <input 
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="e.g. Thesis Draft, Code Sprint"
                  className="w-full h-10 px-3 bg-[#121212] border border-[#2A2A2A] text-white text-xs rounded outline-none focus:border-white transition-colors font-mono"
                  maxLength={25}
                  required
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-[#888888] uppercase block mb-2 tracking-wider">Color Signature</label>
                <div className="flex flex-wrap gap-2 items-center h-10">
                  {[
                    "#FFFFFF", // White/Slate
                    "#3B82F6", // Blue
                    "#8B5CF6", // Violet
                    "#EC4899", // Pink
                    "#F43F5E", // Rose
                    "#F59E0B", // Amber
                    "#10B981", // Emerald
                    "#06B6D4"  // Teal
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewProjColor(color)}
                      className="w-6 h-6 rounded-full border transition-all cursor-pointer relative flex items-center justify-center"
                      style={{ 
                        backgroundColor: color,
                        borderColor: newProjColor === color ? "#FFFFFF" : "transparent"
                      }}
                    >
                      {newProjColor === color && (
                        <Check className="w-3 h-3 text-black mix-blend-difference" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                disabled={!newProjName.trim() || isCreatingLoading}
                className="flex-1 py-2 bg-white text-black text-[10px] font-mono font-bold uppercase rounded transition-colors disabled:opacity-50 cursor-pointer text-center"
              >
                {isCreatingLoading ? "Spawning..." : "Save Stream"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewProjName("");
                }}
                className="px-4 py-2 bg-[#121212] hover:bg-[#1C1C1C] border border-[#2A2A2A] text-[#888888] hover:text-white text-[10px] font-mono uppercase rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Projects List Container */}
      <div className="space-y-4">
        
        {projects.map((proj) => {
          const stats = projectStats.find(s => s.id === proj.id) || { hours: 0, mins: 0, weekHours: 0, sessionCount: 0, lastActive: "Never" };
          const isExpanded = expandedProjId === proj.id;
          const hasGoal = !!proj.weeklyGoalHours;
          const hasOverride = !!proj.customDuration;

          // Calculate current progress towards weekly goal
          const weeklyTargetHours = proj.weeklyGoalHours || 0;
          const completedWeeklyHours = stats.weekHours;
          const targetPct = weeklyTargetHours > 0 ? Math.min(100, Math.round((completedWeeklyHours / weeklyTargetHours) * 100)) : 0;

          return (
            <div 
              key={proj.id}
              className={`border rounded overflow-hidden transition-all duration-300 text-left bg-[#121212]/80 backdrop-blur-md ${
                isExpanded 
                  ? "border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.03)]" 
                  : "border-[#2A2A2A]/80 hover:border-[#444444]"
              }`}
            >
              {/* Card Header Accordion Trigger */}
              <div 
                onClick={() => setExpandedProjId(isExpanded ? null : proj.id)}
                className="p-5 flex justify-between items-center cursor-pointer select-none relative group"
              >
                <div className="space-y-2 flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                    
                    {editingProjId === proj.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-0.5 bg-black border border-white/50 rounded text-xs text-white outline-none font-mono"
                          maxLength={25}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(proj.id)}
                          className="p-1 hover:text-white text-zinc-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingProjId(null)}
                          className="p-1 hover:text-white text-zinc-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-sm font-semibold text-white tracking-tight truncate max-w-[200px]">
                        {proj.name}
                      </h3>
                    )}

                    {/* Active override / archived indicators */}
                    <div className="flex gap-1.5 flex-wrap">
                      {proj.isArchived && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-red-950/40 border border-red-900/40 text-red-400">
                          <Archive className="w-2 h-2" /> Archived
                        </span>
                      )}
                      {hasOverride && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-emerald-950/40 border border-emerald-900/40 text-emerald-400">
                          <Clock className="w-2 h-2" /> {proj.customDuration}m Loop
                        </span>
                      )}
                      {hasGoal && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-blue-950/40 border border-blue-900/40 text-blue-400">
                          <TrendingUp className="w-2 h-2" /> {proj.weeklyGoalHours}h Goal
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      Total: <span className="text-zinc-300 font-bold">{stats.hours}h {stats.mins}m</span>
                    </span>
                    <span>•</span>
                    <span>{stats.sessionCount} Focus Blocks</span>
                    <span>•</span>
                    <span>Last active: {stats.lastActive}</span>
                  </div>

                  {/* Inline Weekly Goal Progress bar */}
                  {hasGoal && (
                    <div className="w-full max-w-[280px] space-y-1 pt-1">
                      <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                        <span>WEEK TARGET</span>
                        <span>{completedWeeklyHours.toFixed(1)}h / {weeklyTargetHours}h ({targetPct}%)</span>
                      </div>
                      <div className="h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${targetPct}%`,
                            backgroundColor: proj.color 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(proj);
                    }}
                    className="p-1.5 text-zinc-600 hover:text-white transition-colors"
                    title="Rename / customize style"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  )}
                </div>
              </div>

              {/* Expandable Panel */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-[#1C1C1C]"
                  >
                    <div className="p-5 bg-black/60 space-y-6">
                      
                      {/* Section: Productive Toggle Management */}
                      <div className="space-y-4">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] font-extrabold block">
                          Toggles & Rulesets
                        </span>

                        <div className="grid gap-3">
                          
                          {/* Toggle 1: Archive Project */}
                          <div className="p-4 bg-zinc-950/60 border border-[#202020] rounded flex justify-between items-center gap-4 hover:border-zinc-800 transition-colors">
                            <div className="space-y-1 flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <Archive className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-200">Archive/Hide Stream</span>
                              </div>
                              <p className="text-[9.5px] text-zinc-500 leading-normal">
                                Temporarily hide this project from flow dropdown lists to prevent cognitive overload.
                              </p>
                            </div>
                            <button
                              onClick={() => onUpdateProject(proj.id, { isArchived: !proj.isArchived })}
                              className={`w-9 h-5 flex items-center rounded-full transition-colors relative cursor-pointer ${
                                proj.isArchived ? "bg-white" : "bg-[#1A1A1A] border border-[#2A2A2A]"
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-full transition-all absolute ${
                                  proj.isArchived ? "right-0.5 bg-black" : "left-0.5 bg-[#888888]"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Toggle 2: Custom Timer Duration Override */}
                          <div className="p-4 bg-zinc-950/60 border border-[#202020] rounded space-y-3.5 hover:border-zinc-800 transition-colors">
                            <div className="flex justify-between items-center gap-4">
                              <div className="space-y-1 flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                  <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-200">Custom Duration Loop</span>
                                </div>
                                <p className="text-[9.5px] text-zinc-500 leading-normal">
                                  Override the universal ADHD Mode timer length for sessions matching this project.
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  onUpdateProject(proj.id, { 
                                    customDuration: proj.customDuration ? undefined : 45 
                                  });
                                }}
                                className={`w-9 h-5 flex items-center rounded-full transition-colors relative cursor-pointer ${
                                  hasOverride ? "bg-white" : "bg-[#1A1A1A] border border-[#2A2A2A]"
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded-full transition-all absolute ${
                                    hasOverride ? "right-0.5 bg-black" : "left-0.5 bg-[#888888]"
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Options if Enabled */}
                            {hasOverride && (
                              <div className="pt-2 border-t border-[#1C1C1C] flex flex-col gap-2 animate-fade-in text-left">
                                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Select target period</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[15, 25, 45, 60, 90].map((mins) => (
                                    <button
                                      key={mins}
                                      onClick={() => onUpdateProject(proj.id, { customDuration: mins })}
                                      className={`px-2 py-1 text-[9px] font-mono rounded cursor-pointer border ${
                                        proj.customDuration === mins
                                          ? "bg-white border-white text-black font-semibold"
                                          : "bg-[#121212] hover:bg-zinc-900 border-[#2A2A2A] text-zinc-400 hover:text-white"
                                      }`}
                                    >
                                      {mins}m
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Toggle 3: Weekly Goal Configuration */}
                          <div className="p-4 bg-zinc-950/60 border border-[#202020] rounded space-y-3.5 hover:border-zinc-800 transition-colors">
                            <div className="flex justify-between items-center gap-4">
                              <div className="space-y-1 flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                                  <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-zinc-200">Structured Goal Metric</span>
                                </div>
                                <p className="text-[9.5px] text-zinc-500 leading-normal">
                                  Set a custom target amount of focused hours that you aim to record every single week.
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  onUpdateProject(proj.id, {
                                    weeklyGoalHours: proj.weeklyGoalHours ? undefined : 5
                                  });
                                }}
                                className={`w-9 h-5 flex items-center rounded-full transition-colors relative cursor-pointer ${
                                  hasGoal ? "bg-white" : "bg-[#1A1A1A] border border-[#2A2A2A]"
                                }`}
                              >
                                <div
                                  className={`w-3.5 h-3.5 rounded-full transition-all absolute ${
                                    hasGoal ? "right-0.5 bg-black" : "left-0.5 bg-[#888888]"
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Slider if Enabled */}
                            {hasGoal && (
                              <div className="pt-2 border-t border-[#1C1C1C] flex flex-col gap-2.5 animate-fade-in text-left">
                                <div className="flex justify-between items-center text-[9px] font-mono">
                                  <span className="text-zinc-500 uppercase tracking-widest">Focused target quantity</span>
                                  <span className="text-white font-bold" style={{ color: proj.color }}>{proj.weeklyGoalHours} Hours / Week</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="range"
                                    min="1"
                                    max="30"
                                    step="1"
                                    value={proj.weeklyGoalHours || 5}
                                    onChange={(e) => onUpdateProject(proj.id, { weeklyGoalHours: parseInt(e.target.value) })}
                                    className={`flex-1 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                      {/* Section: Micro Logs for this Project */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] font-extrabold block text-left">
                          Past Intervals
                        </span>

                        {sessions.filter(s => s.completed && s.projectId === proj.id).length === 0 ? (
                          <div className="p-4 rounded border border-dashed border-[#1C1C1C] text-center text-xs text-zinc-600 font-mono">
                            No cycles associated with this workload.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {sessions
                              .filter(s => s.completed && s.projectId === proj.id)
                              .slice(0, 4)
                              .map((sess) => (
                                <div 
                                  key={sess.id}
                                  className="p-3 rounded bg-zinc-950/40 border border-[#1A1A1A] flex justify-between items-center text-xs font-mono"
                                >
                                  <div className="min-w-0 flex-1 text-left space-y-0.5 pr-2">
                                    <div className="text-white font-medium truncate">{sess.taskName}</div>
                                    <div className="text-[10px] text-zinc-500">
                                      {new Date(sess.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {Math.round(sess.actualDurationSeconds / 60)} mins
                                    </div>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-[#222] text-zinc-400">
                                    DONE
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Delete Workload Stream */}
                      <div className="pt-4 border-t border-[#1C1C1C] flex justify-between items-center">
                        <div className="text-left space-y-0.5 pr-4">
                          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest block font-bold">Destructive Zone</span>
                          <span className="text-[9px] text-zinc-600 block leading-tight">
                            Purging this workload will detach all associated history into loose logs.
                          </span>
                        </div>

                        {confirmDeleteId === proj.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(proj.id)}
                              className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 text-[10px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(proj.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] hover:bg-red-950/30 border border-[#2A2A2A] hover:border-red-900 text-zinc-500 hover:text-red-400 text-[10px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Purge Stream
                          </button>
                        )}
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Unassigned / Loose Section (Not an expandable settings block but shows spend time stats clearly) */}
        <div className="border border-dashed border-[#2A2A2A]/80 rounded p-5 bg-transparent text-left flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-zinc-600" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                Projectless / Loose Streams
              </h3>
            </div>
            <p className="text-[10px] text-zinc-650 leading-normal">
              Standalone cycles completed without an explicit project tag allocation.
            </p>
          </div>

          <div className="text-right">
            <span className="text-sm font-bold text-zinc-300 font-mono block">
              {looseStats.hours}h {looseStats.mins}m
            </span>
            <span className="text-[9px] font-mono text-zinc-600 block uppercase mt-0.5">
              {looseStats.sessionCount} sessions completed
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
