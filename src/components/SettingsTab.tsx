import React from "react";
import { UserProfile, FocusSession, Project } from "../types";
import { 
  User, 
  Sparkles, 
  Zap, 
  Clock, 
  Trash2, 
  LogOut, 
  Settings2, 
  Layers, 
  HeartHandshake,
  CircleCheck,
  Sun,
  Moon,
  Download
} from "lucide-react";
import { logOut } from "../lib/firebase";

interface SettingsTabProps {
  user: any;
  profile: UserProfile;
  sessions: FocusSession[];
  projects: Project[];
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onSignOut: () => void;
  onDeleteHistory: () => Promise<void>;
  onFactoryReset: () => Promise<void>;
}

export default function SettingsTab({ user, profile, sessions, projects, onUpdateProfile, onSignOut, onDeleteHistory, onFactoryReset }: SettingsTabProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmMode, setConfirmMode] = React.useState<'history' | 'factory' | null>(null);

  const [feedbackName, setFeedbackName] = React.useState("");
  const [feedbackEmail, setFeedbackEmail] = React.useState("");
  const [feedbackMessage, setFeedbackMessage] = React.useState("");
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = React.useState(false);
  const [feedbackStatus, setFeedbackStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackMessage.trim()) return;
    setIsFeedbackSubmitting(true);
    setFeedbackStatus('idle');
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: feedbackName,
          email: feedbackEmail,
          feedback: feedbackMessage,
          originalUserEmail: user?.email || "unknown@focuson.io",
        })
      });
      if (response.ok) {
        setFeedbackStatus('success');
        setFeedbackName('');
        setFeedbackEmail('');
        setFeedbackMessage('');
      } else {
        setFeedbackStatus('error');
      }
    } catch (err) {
      console.error("Feedback submission error:", err);
      setFeedbackStatus('error');
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleToggleAdhd = async () => {
    try {
      await onUpdateProfile({ adhdMode: !profile.adhdMode });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateGoal = async (minutes: number) => {
    try {
      await onUpdateProfile({ weeklyGoalMinutes: minutes });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogOutClick = async () => {
    try {
      if (user) {
        await logOut();
      }
      onSignOut();
    } catch (err) {
      console.error(err);
      onSignOut();
    }
  };

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
    link.setAttribute("download", `focuson_export_${new Date().toISOString().split('T')[0]}.csv`);
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
    downloadAnchor.setAttribute("download", `focuson_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const currentTheme = profile.theme || "dark";

  return (
    <div className="w-full max-w-xl mx-auto py-4 px-1 space-y-7 animate-fade-in" id="settings-tab-viewport">
      
      {/* Title block */}
      <div className="space-y-1.5 text-center sm:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary transition-colors duration-300">
          System Controls
        </h2>
        <p className="text-text-secondary text-xs sm:text-sm transition-colors duration-300">
          Tailor your focus settings to match your natural rhythm.
        </p>
      </div>

      {/* User info Profile element */}
      <div className="p-4 rounded bg-bg-panel border border-border-app flex flex-col gap-4 transition-colors duration-300 shadow-[0_4px_20px_var(--shadow-intensity)]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3.5 text-left">
            {user && user.photoURL ? (
              <img src={user.photoURL} alt={profile.displayName || "User"} referrerPolicy="no-referrer" className="w-11 h-11 rounded border border-border-app" />
            ) : (
              <div className="w-11 h-11 rounded bg-bg-btn border border-border-app flex items-center justify-center transition-colors duration-300">
                <User className="w-5 h-5 text-text-muted" />
              </div>
            )}
            <div className="text-left">
              <h3 className="text-xs sm:text-sm font-medium text-text-primary leading-none transition-colors duration-300">
                {user ? (user.isAnonymous ? "Secure Client Sandbox" : (user.displayName || "Sync User")) : "Sandbox Visitor"}
              </h3>
              <p className="text-[10px] font-mono text-text-muted mt-1 transition-colors duration-300">
                {user ? (user.isAnonymous ? "session-local-sync" : (user.email || "synced-user")) : "guest@focuson.io"}
              </p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded bg-bg-btn border border-border-app text-[8px] font-mono text-text-secondary uppercase tracking-wider transition-colors duration-300">
                {user ? (user.isAnonymous ? "Secure Fallback Active" : "Cloud Sync active") : "Guest Mode only"}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogOutClick}
            id="logout-btn"
            className="px-3 py-2 bg-bg-btn hover:bg-bg-btn-hover border border-border-app text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer text-[11px] font-medium flex items-center gap-1.5"
            title="Sign out of current account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Workspace</span>
          </button>
        </div>
      </div>

      {/* Control cards container */}
      <div className="space-y-4">
        <h4 className="text-[9px] font-mono text-text-muted tracking-[0.25em] font-extrabold uppercase block transition-colors duration-300">ADHD & FLOW OPTIONS</h4>

        <div className="space-y-5">
          {/* Main Control Panel */}
          <div className="p-4 sm:p-5 bg-bg-card border border-border-app rounded-lg shadow-[2px_2px_0px_var(--border-app)] space-y-4 text-left transition-all duration-300">
            
            {/* Theme Selector - Row 1 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-app/40">
              <div className="space-y-0.5 max-w-sm">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-text-muted" />
                  <h5 className="text-[11px] font-mono uppercase tracking-widest text-text-primary font-bold">Visual Atmosphere</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Protect optical endurance with custom-balanced theme layouts.
                </p>
              </div>
              
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => onUpdateProfile({ theme: "dark" })}
                  className={`px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer flex items-center gap-1.5 ${
                    currentTheme === "dark"
                      ? "bg-text-primary border-text-primary text-bg-app font-bold"
                      : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Moon className="w-3 h-3" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => onUpdateProfile({ theme: "light" })}
                  className={`px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer flex items-center gap-1.5 ${
                    currentTheme === "light"
                      ? "bg-text-primary border-text-primary text-bg-app font-bold"
                      : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>Light</span>
                </button>
              </div>
            </div>

            {/* ADHD Overdrive Mode - Row 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-app/40">
              <div className="space-y-0.5 max-w-sm">
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 transition-colors ${profile.adhdMode ? "text-text-primary" : "text-text-muted"}`} />
                  <h5 className="text-[11px] font-mono uppercase tracking-widest text-text-primary font-bold">Overdrive Mode (ADHD)</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Low-friction defaults, warm active visual elements, and quick restarts.
                </p>
              </div>

              <button
                onClick={handleToggleAdhd}
                id="toggle-adhd-btn"
                className={`w-9 h-5.5 flex items-center rounded-full transition-all focus:outline-none relative cursor-pointer shrink-0 ${
                  profile.adhdMode ? "bg-text-primary" : "bg-bg-btn border border-border-app"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all absolute ${
                    profile.adhdMode ? "right-0.5 bg-bg-app" : "left-0.5 bg-text-muted"
                  }`}
                />
              </button>
            </div>

            {/* Weekly Allocation Goal - Row 3 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-app/40">
              <div className="space-y-0.5 max-w-sm">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <h5 className="text-[11px] font-mono uppercase tracking-widest text-text-primary font-bold">Weekly Allocation</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Allocation for mental blocks. Promotes healthy consistency.
                </p>
              </div>

              <div className="flex flex-wrap gap-1 shrink-0">
                {[60, 150, 300, 600].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleUpdateGoal(mins)}
                    className={`px-2 py-1 text-[9px] font-mono uppercase tracking-tight rounded transition-all border cursor-pointer ${
                      profile.weeklyGoalMinutes === mins
                        ? "bg-text-primary border-text-primary text-bg-app font-bold"
                        : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {mins === 60 ? "1h" : mins === 150 ? "2.5h" : mins === 300 ? "5h" : "10h"}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Focus Logs - Row 4 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 max-w-sm">
                <div className="flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-text-muted" />
                  <h5 className="text-[11px] font-mono uppercase tracking-widest text-text-primary font-bold">Export Focus Logs</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Download personal focus session draft indices.
                </p>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={handleExportCSV}
                  disabled={sessions.length === 0}
                  className="px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer flex-1 flex items-center justify-center gap-1 bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  disabled={sessions.length === 0}
                  className="px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer flex-1 flex items-center justify-center gap-1 bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>JSON</span>
                </button>
              </div>
            </div>

          </div>

          {/* Danger Zone & Customer Feedback - Side-by-side or stacked cleanly */}
          <div className="grid gap-4 sm:grid-cols-2">
            
            {/* Compact Danger Zone Card */}
            <div className="p-4 bg-bg-card border border-border-app rounded-lg shadow-[2px_2px_0px_var(--border-app)] text-left flex flex-col justify-between transition-all duration-300">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Trash2 className="w-3.5 h-3.5 text-text-muted" />
                  <h5 className="text-xs font-mono uppercase tracking-widest text-text-primary font-bold">Danger Zone</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed mb-3">
                  Reset custom settings, clean session logs, and restore configurations to default states.
                </p>
              </div>

              <div className="pt-2 border-t border-border-app/40">
                {confirmMode === 'history' ? (
                  <div className="space-y-2 p-2 bg-bg-btn border border-border-app rounded">
                    <span className="text-[9px] font-mono text-text-primary block uppercase">CONFIRM SESSIONS PURGE</span>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={async () => {
                          setIsDeleting(true);
                          await onDeleteHistory();
                          setIsDeleting(false);
                          setConfirmMode(null);
                        }}
                        disabled={isDeleting}
                        className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded transition-colors border cursor-pointer bg-text-primary border-text-primary text-bg-app disabled:opacity-50"
                      >
                        {isDeleting ? "..." : "Wipe Logs"}
                      </button>
                      <button
                        onClick={() => setConfirmMode(null)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded transition-colors border cursor-pointer bg-transparent hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : confirmMode === 'factory' ? (
                  <div className="space-y-2 p-2 bg-bg-btn border border-border-app rounded">
                    <span className="text-[9px] font-mono text-text-primary block uppercase">CONFIRM FACTORY RESET</span>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={async () => {
                          setIsDeleting(true);
                          await onFactoryReset();
                          setIsDeleting(false);
                          setConfirmMode(null);
                        }}
                        disabled={isDeleting}
                        className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded transition-colors border cursor-pointer bg-text-primary border-text-primary text-bg-app disabled:opacity-50"
                      >
                        {isDeleting ? "..." : "Reset All"}
                      </button>
                      <button
                        onClick={() => setConfirmMode(null)}
                        disabled={isDeleting}
                        className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded transition-colors border cursor-pointer bg-transparent hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setConfirmMode('factory')}
                      className="px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-primary flex-1 text-center"
                    >
                      Factory Reset
                    </button>
                    <button
                      onClick={() => setConfirmMode('history')}
                      className="px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all border cursor-pointer bg-transparent hover:bg-bg-btn border-border-app text-text-secondary hover:text-text-primary flex-1 text-center"
                    >
                      Clear Logs
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Compact Feedback Card */}
            <div className="p-4 bg-bg-card border border-border-app rounded-lg shadow-[2px_2px_0px_var(--border-app)] text-left flex flex-col justify-between transition-all duration-300" id="feedback-section">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <HeartHandshake className="w-3.5 h-3.5 text-text-muted" />
                  <h5 className="text-xs font-mono uppercase tracking-widest text-text-primary font-bold">Feedback Portal</h5>
                </div>
                <p className="text-[10px] text-text-muted leading-relaxed mb-3">
                  We use an external Google Form to collect feedback so we can continuously improve your FocusOn experience.
                </p>
              </div>

              <div className="pt-2 border-t border-border-app/40">
                <a
                  href="https://forms.gle/FYEdVhAjCryxPS9E8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer text-center no-underline border-none"
                >
                  Open Google Form ↗
                </a>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Trust banner */}
      <div className="p-4 bg-bg-panel border border-border-app rounded flex gap-3.5 items-start text-left transition-colors duration-300 shadow-[0_4px_20px_var(--shadow-intensity)]">
        <CircleCheck className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest block">SECURITY PROTOCOL</span>
          <p className="text-text-muted text-[10px] leading-relaxed mt-1">
            All user statistics, completed drafts, and intervals are encrypted via Firebase. Keystrokes are kept entirely in local client bounds.
          </p>
        </div>
      </div>

    </div>
  );
}
