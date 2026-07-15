import React from "react";
import { UserProfile, FocusSession, Project } from "../types";
import SecureProgressModal from "./SecureProgressModal";
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
  Download,
  Database,
  Check,
  ArrowUpRight
} from "lucide-react";

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
  const [isSecureModalOpen, setIsSecureModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmMode, setConfirmMode] = React.useState<'history' | 'factory' | null>(null);

  const [feedbackName, setFeedbackName] = React.useState("");
  const [feedbackEmail, setFeedbackEmail] = React.useState("");
  const [feedbackMessage, setFeedbackMessage] = React.useState("");
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = React.useState(false);
  const [feedbackStatus, setFeedbackStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  // Supabase state management
  const [supabaseStatus, setSupabaseStatus] = React.useState<'idle' | 'testing' | 'success' | 'error' | 'schema_missing'>('idle');
  const [supabaseMsg, setSupabaseMsg] = React.useState("");
  const [showSQL, setShowSQL] = React.useState(false);
  const [checkoutStatus, setCheckoutStatus] = React.useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [lastCheckoutId, setLastCheckoutId] = React.useState("");

  const handleTestSupabase = async () => {
    setSupabaseStatus('testing');
    try {
      const res = await fetch("/api/supabase/test-connection", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.schemaMissing) {
          setSupabaseStatus('schema_missing');
          setSupabaseMsg(data.message);
        } else {
          setSupabaseStatus('success');
          setSupabaseMsg(data.message);
        }
      } else {
        setSupabaseStatus('error');
        setSupabaseMsg(data.error || "Connection failed.");
      }
    } catch (err: any) {
      setSupabaseStatus('error');
      setSupabaseMsg(err.message || "Network error.");
    }
  };

  const handleSimulateCheckout = async () => {
    setCheckoutStatus('sending');
    const checkoutId = `chk_${Date.now()}`;
    const payload = {
      id: checkoutId,
      user_id: user?.uid || "local-user",
      email: user?.email || "sandbox_visitor@focuson.io",
      amount: "9.99",
      currency: "USD",
      plan_type: "focuson_premium_monthly",
      status: "completed",
      stripe_session_id: `cs_test_${Math.random().toString(36).substring(2, 11)}`,
      created_at: new Date().toISOString()
    };

    try {
      const res = await fetch("/api/supabase/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutStatus('success');
        setLastCheckoutId(checkoutId);
      } else {
        setCheckoutStatus('error');
        alert(data.error || "Failed to log checkout. Please ensure tables are created first using the SQL script!");
      }
    } catch (err: any) {
      setCheckoutStatus('error');
      alert(err.message || "Failed to make request.");
    }
  };

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
    onSignOut();
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
      <div className="p-4 rounded bg-bg-panel border border-border-app flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors duration-300 shadow-[0_4px_20px_var(--shadow-intensity)]">
        <div className="flex items-center gap-3.5 text-left">
          {user && user.photoURL ? (
            <img src={user.photoURL} alt={profile.displayName || "User"} referrerPolicy="no-referrer" className="w-11 h-11 rounded border border-border-app" />
          ) : (
            <div className="w-11 h-11 rounded bg-bg-btn border border-border-app flex items-center justify-center transition-colors duration-300">
              <User className="w-5 h-5 text-text-muted" />
            </div>
          )}
          <div className="text-left">
            <h3 className="text-xs sm:text-sm font-medium text-text-primary leading-none transition-colors duration-300">{user && user.uid !== "local-user" ? user.displayName : "Sandbox Visitor"}</h3>
            <p className="text-[10px] font-mono text-text-muted mt-1 transition-colors duration-300">{user && user.uid !== "local-user" ? user.email : "guest@focuson.io"}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded bg-bg-btn border border-border-app text-[8px] font-mono text-text-secondary uppercase tracking-wider transition-colors duration-300">
              {user && user.uid !== "local-user" ? "Cloud Sync active" : "Guest Mode: Temporary Session"}
            </span>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {(!user || user.uid === "local-user") && (
            <button
              onClick={() => setIsSecureModalOpen(true)}
              className="flex-1 sm:flex-initial px-3 py-2 bg-amber-500 hover:bg-amber-600 border border-amber-600/30 text-black rounded transition-all cursor-pointer text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(245,158,11,0.2)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Secure Progress</span>
            </button>
          )}
          <button
            onClick={handleLogOutClick}
            id="logout-btn"
            className="flex-1 sm:flex-initial px-3 py-2 bg-bg-btn hover:bg-bg-btn-hover border border-border-app text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer text-[11px] font-medium flex items-center justify-center gap-1.5"
            title={!user || user.uid === "local-user" ? "Discard progress and reset workspace" : "Sign out of current account"}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{!user || user.uid === "local-user" ? "Discard Progress" : "Exit Workspace"}</span>
          </button>
        </div>
      </div>

      {/* Control cards container */}
      <div className="space-y-4">
        <h4 className="text-[9px] font-mono text-text-muted tracking-[0.25em] font-extrabold uppercase block transition-colors duration-300">ADHD & FLOW OPTIONS</h4>

        <div className="grid gap-6">

          {/* Theme Selector block */}
          <div className="p-6 pt-8 pb-4 bg-bg-card border border-border-app rotate-[-0.5deg] space-y-4 text-left relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-text-muted" />
              <h4 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-[0.85] transition-colors duration-300">Visual Atmosphere</h4>
            </div>
            
            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase leading-relaxed mt-2 transition-colors duration-300">
              Choose your work aesthetic. Our interface, typography, cards, and backgrounds automatically shift to protect optical endurance.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onUpdateProfile({ theme: "dark" })}
                className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest rounded-none transition-all border cursor-pointer flex-1 flex items-center justify-center gap-2 ${
                  currentTheme === "dark"
                    ? "bg-text-primary border-text-primary text-bg-app font-bold shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                    : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark Butterfly</span>
              </button>
              <button
                onClick={() => onUpdateProfile({ theme: "light" })}
                className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest rounded-none transition-all border cursor-pointer flex-1 flex items-center justify-center gap-2 ${
                  currentTheme === "light"
                    ? "bg-text-primary border-text-primary text-bg-app font-bold shadow-[0_0_15px_rgba(0,0,0,0.05)]"
                    : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light Butterfly</span>
              </button>
            </div>
          </div>
          
          {/* ADHD Switch block */}
          <div className="p-6 pt-8 pb-4 bg-bg-card border border-border-app rotate-[1.5deg] space-y-4 text-left relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 transition-colors ${profile.adhdMode ? "text-text-primary" : "text-text-muted"}`} />
                  <h4 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-[0.85] transition-colors duration-300">Overdrive Mode</h4>
                </div>
                <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase leading-relaxed pt-2 transition-colors duration-300">
                  Applies low-friction defaults: 20-minute active sessions, enhanced focus warmth, and high-contrast distraction-shift safety options designed for rapid restart.
                </p>
              </div>

              {/* High-Fidelity switch */}
              <button
                onClick={handleToggleAdhd}
                id="toggle-adhd-btn"
                className={`w-10 h-6 flex items-center rounded-none transition-all focus:outline-none relative cursor-pointer shrink-0 ${
                  profile.adhdMode ? "bg-text-primary" : "bg-bg-btn border border-border-app"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-none transition-all absolute ${
                    profile.adhdMode ? "right-1 bg-bg-app" : "left-1 bg-text-muted"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Goal adjustment selector list */}
          <div className="p-6 pt-8 pb-4 bg-bg-card border border-border-app rotate-[-1deg] space-y-4 text-left relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <h4 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-[0.85] transition-colors duration-300">Weekly Allocation</h4>
            </div>
            
            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase leading-relaxed mt-2 transition-colors duration-300">
              Set your target duration for mental blocks. We promote manageable, daily consistency rather than exhausting grinds.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              {[60, 150, 300, 600].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleUpdateGoal(mins)}
                  className={`px-3 py-2 text-[10px] font-mono uppercase tracking-widest rounded-none transition-all border cursor-pointer ${
                    profile.weeklyGoalMinutes === mins
                      ? "bg-text-primary border-text-primary text-bg-app font-bold"
                      : "bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {mins === 60 ? "1h (Gentle)" : mins === 150 ? "2.5h (Steady)" : mins === 300 ? "5h (Deep)" : "10h (Intense)"}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Export Card */}
          <div className="p-6 pt-8 pb-4 bg-bg-card border border-border-app rotate-[0.5deg] space-y-4 text-left relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-text-muted" />
              <h4 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-[0.85] transition-colors duration-300">Export Focus Logs</h4>
            </div>
            
            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase leading-relaxed mt-2 transition-colors duration-300">
              Download your completed focus sessions to keep a personal record of your progress.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExportCSV}
                disabled={sessions.length === 0}
                className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest rounded-none transition-all border cursor-pointer flex-1 flex items-center justify-center gap-2 bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                disabled={sessions.length === 0}
                className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest rounded-none transition-all border cursor-pointer flex-1 flex items-center justify-center gap-2 bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Danger zone block with history deletion and complete factory reset option */}
          <div className="p-6 pt-8 pb-4 bg-bg-card border border-border-app rotate-[1.5deg] space-y-4 text-left group relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              <h4 className="text-sm font-medium text-text-primary transition-colors duration-300">Danger Zone</h4>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed mt-1 transition-colors duration-300">
              Permanently delete your saved focus sessions, project lists, and customized settings.
            </p>

            <div className="pt-2">
              {confirmMode === 'history' ? (
                <div className="space-y-2 p-3 bg-bg-btn border border-border-app rounded transition-colors duration-300">
                  <span className="text-[9px] font-mono text-text-primary block uppercase">CONFIRM SESSIONS PURGE</span>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    This will permanently clear all focus blocks and analytics logs.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={async () => {
                        setIsDeleting(true);
                        await onDeleteHistory();
                        setIsDeleting(false);
                        setConfirmMode(null);
                      }}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-text-primary border-text-primary text-bg-app disabled:opacity-50"
                    >
                      {isDeleting ? "Resetting..." : "Wipe History Only"}
                    </button>
                    <button
                      onClick={() => setConfirmMode(null)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-transparent hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirmMode === 'factory' ? (
                <div className="space-y-2 p-3 bg-bg-btn border border-border-app rounded transition-colors duration-300">
                  <span className="text-[9px] font-mono text-text-primary block uppercase">CONFIRM COMPLETE FACTORY RESET</span>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    This will delete ALL sessions and reset your ADHD control defaults, weekly target configurations, and profile states back to zero.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={async () => {
                        setIsDeleting(true);
                        await onFactoryReset();
                        setIsDeleting(false);
                        setConfirmMode(null);
                      }}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-text-primary border-text-primary text-bg-app disabled:opacity-50"
                    >
                      {isDeleting ? "Resetting..." : "Purge & Reset Everything"}
                    </button>
                    <button
                      onClick={() => setConfirmMode(null)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-transparent hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setConfirmMode('factory')}
                    className="px-4 py-2 text-xs font-medium rounded transition-all border cursor-pointer bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-primary flex-1 text-center"
                  >
                    Full Factory Reset
                  </button>
                  <button
                    onClick={() => setConfirmMode('history')}
                    className="px-4 py-2 text-xs font-medium rounded transition-all border cursor-pointer bg-transparent hover:bg-bg-btn border-border-app text-text-secondary hover:text-text-primary flex-1 text-center"
                  >
                    Clear System History
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Supabase Analytics Integration card */}
          <div className="p-6 pt-8 pb-5 bg-bg-card border border-border-app rotate-[-0.5deg] space-y-4 text-left relative z-10 shadow-[2px_2px_0px_var(--border-app)] transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-text-muted" />
                <h4 className="text-xl font-black text-text-primary uppercase tracking-tighter leading-[0.85] transition-colors duration-300">Supabase Integration</h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border ${
                supabaseStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                supabaseStatus === 'schema_missing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                supabaseStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                supabaseStatus === 'testing' ? 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400 animate-pulse' :
                'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
              }`}>
                {supabaseStatus === 'success' ? 'Active' :
                 supabaseStatus === 'schema_missing' ? 'Table Alert' :
                 supabaseStatus === 'error' ? 'Connection Error' :
                 supabaseStatus === 'testing' ? 'Testing...' :
                 'Not Checked'}
              </span>
            </div>

            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase leading-relaxed mt-2 transition-colors duration-300">
              Linked to Project ID: <span className="text-text-primary">dtaeglpiuwsvqiydofwo</span> (FocusOn). Focus sessions, distraction lists, and premium checkouts write securely to your relational schema.
            </p>

            {supabaseMsg && (
              <div className={`p-3 text-[11px] rounded font-mono leading-normal border ${
                supabaseStatus === 'success' ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300' :
                supabaseStatus === 'schema_missing' ? 'bg-amber-950/20 border-amber-900/50 text-amber-300' :
                'bg-red-950/20 border-red-900/50 text-red-300'
              }`}>
                {supabaseMsg}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={supabaseStatus === 'testing'}
                className="px-3.5 py-2.5 text-[10px] font-mono uppercase tracking-widest border bg-bg-btn hover:bg-bg-btn-hover border-border-app text-text-secondary hover:text-text-primary cursor-pointer flex-1 flex items-center justify-center gap-2 transition-colors"
              >
                {supabaseStatus === 'testing' ? "Connecting..." : "Test Supabase Connection"}
              </button>
              
              <button
                type="button"
                onClick={handleSimulateCheckout}
                disabled={checkoutStatus === 'sending'}
                className="px-3.5 py-2.5 text-[10px] font-mono uppercase tracking-widest border bg-text-primary border-text-primary text-bg-app hover:opacity-90 font-bold cursor-pointer flex-1 flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              >
                {checkoutStatus === 'sending' ? "Upgrading..." : "Simulate Premium Upgrade"}
              </button>
            </div>

            {checkoutStatus === 'success' && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded font-mono text-[10px] text-emerald-300 leading-normal animate-fade-in">
                🎉 <strong className="uppercase">Checkout Logged in Supabase!</strong><br />
                A real premium checkout receipt (ID: <span className="text-white">{lastCheckoutId}</span>) has been written to the <code className="text-white font-bold bg-black/40 px-1 py-0.5 rounded">checkouts</code> table in your database.
              </div>
            )}

            <div className="border-t border-border-app/40 pt-3">
              <button
                type="button"
                onClick={() => setShowSQL(!showSQL)}
                className="w-full text-left text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:text-text-primary flex items-center justify-between cursor-pointer"
              >
                <span>View Supabase SQL Schema</span>
                <span className="text-xs">{showSQL ? "Collapse ▲" : "Expand ▼"}</span>
              </button>

              {showSQL && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Create these tables in your Supabase SQL Editor to make checkout saves and logs work seamlessly. A copy of this is saved in <code className="text-text-secondary font-bold">/supabase_schema.sql</code>.
                  </p>
                  <pre className="p-3 bg-black/60 rounded border border-border-app text-[9px] font-mono text-zinc-300 overflow-x-auto max-h-48 leading-relaxed">
{`-- SQL script for Supabase Editor
CREATE TABLE IF NOT EXISTS public.checkouts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    plan_type VARCHAR(100) NOT NULL,
    stripe_session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    tiny_step TEXT,
    original_duration_minutes INTEGER NOT NULL,
    actual_duration_seconds INTEGER NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    date_str VARCHAR(10) NOT NULL,
    reflection_notes TEXT,
    next_step_suggested TEXT,
    stuck_count INTEGER DEFAULT 0,
    distraction_check_in_count INTEGER DEFAULT 0,
    project_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.distraction_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    activity TEXT NOT NULL,
    choice VARCHAR(50) NOT NULL,
    notes TEXT
);`}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Customer Feedback Section with Theme-aware styling */}
          <div className="p-1 bg-bg-panel rounded-lg border border-border-app shadow-md text-left z-10 transition-all duration-300 mt-6" id="feedback-section">
            <div className="bg-bg-app p-6 rounded-md border border-border-app">
              <div className="border-b border-border-app pb-3 mb-4">
                <h4 className="text-lg font-bold text-text-primary leading-tight">
                  Customer Feedback Portal
                </h4>
                <p className="text-xs text-text-muted mt-1">
                  Help us refine the system. Your comments are reviewed immediately by the deployment team.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  We use an external Google Form to collect your valuable feedback, allowing us to continuously improve the system, resolve any issue, and make your FocusOn experience truly unforgettable.
                </p>

                <div className="pt-2">
                  <a
                    href="https://forms.gle/FYEdVhAjCryxPS9E8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-all cursor-pointer text-center no-underline border-none"
                  >
                    Open Official Google Feedback Form ↗
                  </a>
                </div>
                
                <p className="text-[10px] text-text-muted text-center">
                  You will be securely redirected to Google Forms to complete your submission.
                </p>
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

      <SecureProgressModal 
        isOpen={isSecureModalOpen} 
        onClose={() => setIsSecureModalOpen(false)} 
      />
    </div>
  );
}
