import React from "react";
import { UserProfile } from "../types";
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
  ShieldCheck,
  CircleCheck
} from "lucide-react";
import { logOut } from "../lib/firebase";

interface SettingsTabProps {
  user: any;
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onSignOut: () => void;
  onDeleteHistory: () => Promise<void>;
  onFactoryReset: () => Promise<void>;
}

export default function SettingsTab({ user, profile, onUpdateProfile, onSignOut, onDeleteHistory, onFactoryReset }: SettingsTabProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmMode, setConfirmMode] = React.useState<'history' | 'factory' | null>(null);

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

  return (
    <div className="w-full max-w-xl mx-auto py-4 px-1 space-y-7 animate-fade-in" id="settings-tab-viewport">
      
      {/* Title block */}
      <div className="space-y-1.5 text-center sm:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          System Control Panel
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm">
          Optimize support algorithms to align with your natural workflows.
        </p>
      </div>

      {/* User info Profile element */}
      <div className="p-4 rounded bg-[#121212] border border-[#2A2A2A] flex justify-between items-center">
        <div className="flex items-center gap-3.5 text-left">
          {user && user.photoURL ? (
            <img src={user.photoURL} alt={profile.displayName || "User"} referrerPolicy="no-referrer" className="w-11 h-11 rounded border border-[#2A2A2A]" />
          ) : (
            <div className="w-11 h-11 rounded bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
              <User className="w-5 h-5 text-[#888888]" />
            </div>
          )}
          <div className="text-left">
            <h3 className="text-xs sm:text-sm font-medium text-white leading-none">{user ? user.displayName : "Sandbox Visitor"}</h3>
            <p className="text-[10px] font-mono text-[#666666] mt-1">{user ? user.email : "guest@focuson.io"}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#1A1A1A] border border-[#2A2A2A] text-[8px] font-mono text-[#888888] uppercase tracking-wider">
              {user ? "Cloud Sync active" : "Guest Mode only"}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogOutClick}
          id="logout-btn"
          className="px-3 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer text-[11px] font-medium flex items-center gap-1.5"
          title="Sign out of current account"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Workspace</span>
        </button>
      </div>

      {/* Control cards container */}
      <div className="space-y-4">
        <h4 className="text-[9px] font-mono text-zinc-500 tracking-[0.25em] font-extrabold uppercase block">COGNITIVE TUNERS</h4>

        <div className="grid gap-4">
          
          {/* ADHD Switch block */}
          <div className="p-5 rounded bg-[#121212] border border-[#2A2A2A] space-y-4 text-left">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 transition-colors ${profile.adhdMode ? "text-white" : "text-[#888888]"}`} />
                  <h4 className="text-sm font-medium text-white">Overdrive Focus Mode</h4>
                </div>
                <p className="text-xs text-[#666666] leading-relaxed pt-1.5">
                  Applies low-friction defaults: 20-minute active sessions, enhanced focus warmth, and high-contrast distraction-shift safety options designed for rapid restart.
                </p>
              </div>

              {/* High-Fidelity switch */}
              <button
                onClick={handleToggleAdhd}
                id="toggle-adhd-btn"
                className={`w-10 h-6 flex items-center rounded-full transition-colors focus:outline-none relative cursor-pointer shrink-0 ${
                  profile.adhdMode ? "bg-white" : "bg-[#1A1A1A] border border-[#2A2A2A]"
                }`}
              >
                <div
                  className={`w-4.5 h-4.5 rounded-full transition-all absolute ${
                    profile.adhdMode ? "right-0.5 bg-black" : "left-0.5 bg-[#888888]"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Goal adjustment selector list */}
          <div className="p-5 rounded bg-[#121212] border border-[#2A2A2A] space-y-4 text-left">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#888888]" />
              <h4 className="text-sm font-medium text-white">Weekly Target Allocation</h4>
            </div>
            
            <p className="text-xs text-[#666666] leading-relaxed mt-1">
              Set your target duration for mental blocks. We promote manageable, daily consistency rather than exhausting grinds.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {[60, 150, 300, 600].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleUpdateGoal(mins)}
                  className={`px-3 py-2 text-[10px] sm:text-xs font-medium rounded transition-colors border cursor-pointer ${
                    profile.weeklyGoalMinutes === mins
                      ? "bg-white border-white text-black"
                      : "bg-[#1A1A1A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-[#888888] hover:text-white"
                  }`}
                >
                  {mins === 60 ? "1h (Gentle)" : mins === 150 ? "2.5h (Steady)" : mins === 300 ? "5h (Deep)" : "10h (Intense)"}
                </button>
              ))}
            </div>
          </div>

          {/* Danger zone block with history deletion and complete factory reset option */}
          <div className="p-5 rounded bg-[#121212] border border-[#2A2A2A] space-y-4 text-left group">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-[#888888] group-hover:text-white transition-colors" />
              <h4 className="text-sm font-medium text-white transition-colors">Destructive Reset Actions</h4>
            </div>
            
            <p className="text-xs text-[#666666] leading-relaxed mt-1">
              Select an action to purge your mental sandbox database records, session timers, next step projections, and focus settings preferences.
            </p>

            <div className="pt-2">
              {confirmMode === 'history' ? (
                <div className="space-y-2 p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded">
                  <span className="text-[9px] font-mono text-white block uppercase">CONFIRM SESSIONS PURGE</span>
                  <p className="text-[11px] text-[#666666] leading-relaxed">
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
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-white hover:bg-[#F0F0F0] border-white text-black disabled:opacity-50"
                    >
                      {isDeleting ? "Resetting..." : "Wipe History Only"}
                    </button>
                    <button
                      onClick={() => setConfirmMode(null)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-transparent hover:bg-[#121212] border-[#2A2A2A] text-[#888888] hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirmMode === 'factory' ? (
                <div className="space-y-2 p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded">
                  <span className="text-[9px] font-mono text-white block uppercase">CONFIRM COMPLETE FACTORY RESET</span>
                  <p className="text-[11px] text-[#666666] leading-relaxed">
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
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-white hover:bg-[#F0F0F0] border-white text-black disabled:opacity-50"
                    >
                      {isDeleting ? "Resetting..." : "Purge & Reset Everything"}
                    </button>
                    <button
                      onClick={() => setConfirmMode(null)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded transition-colors border cursor-pointer bg-transparent hover:bg-[#121212] border-[#2A2A2A] text-[#888888] hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setConfirmMode('factory')}
                    className="px-4 py-2 text-xs font-medium rounded transition-colors border cursor-pointer bg-[#1A1A1A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-white flex-1 text-center"
                  >
                    Full Factory Reset
                  </button>
                  <button
                    onClick={() => setConfirmMode('history')}
                    className="px-4 py-2 text-xs font-medium rounded transition-colors border cursor-pointer bg-transparent hover:bg-[#1A1A1A] border-[#2A2A2A] text-[#888888] hover:text-white flex-1 text-center"
                  >
                    Clear System History
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Trust banner */}
      <div className="p-4 bg-[#121212] border border-[#2A2A2A] rounded flex gap-3.5 items-start text-left">
        <ShieldCheck className="w-4 h-4 text-[#888888] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-[#888888] uppercase tracking-widest block">SECURITY PROTOCOL</span>
          <p className="text-[#666666] text-[10px] leading-relaxed mt-1">
            All user statistics, completed drafts, and intervals are encrypted via Firebase. Keystrokes are kept entirely in local client bounds.
          </p>
        </div>
      </div>

    </div>
  );
}
