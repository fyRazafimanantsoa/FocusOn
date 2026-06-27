import React, { useState, useEffect } from "react";
import { auth } from "./lib/firebase";
import { getOrCreateUserProfile, updateUserProfile, fetchUserSessions, saveFocusSession, deleteAllUserSessions, deleteUserSession } from "./lib/db";
import { UserProfile, FocusSession } from "./types";
import AuthScreen from "./components/AuthScreen";
import FocusTab from "./components/FocusTab";
import ProgressTab from "./components/ProgressTab";
import SettingsTab from "./components/SettingsTab";
import { 
  Clock, 
  Activity, 
  User, 
  Flame, 
  Sparkles, 
  CircleDot 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ActiveTab = "focus" | "progress" | "settings";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSessions, setUserSessions] = useState<FocusSession[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Guest Sandbox Mode state
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<ActiveTab>("focus");

  // Track Auth States
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        setIsGuestMode(false);
        try {
          const profile = await getOrCreateUserProfile(
            firebaseUser.uid,
            firebaseUser.email || "",
            firebaseUser.displayName,
            firebaseUser.photoURL
          );
          setUserProfile(profile);
          const sessions = await fetchUserSessions(firebaseUser.uid);
          setUserSessions(sessions);
        } catch (err) {
          console.error("Firestore user profile loading error:", err);
        }
      } else {
        setCurrentUser(null);
        if (!isGuestMode) {
          setUserProfile(null);
          setUserSessions([]);
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [isGuestMode]);

  // Load guest sandbox data from localStorage if and only if Guest Mode is selected
  useEffect(() => {
    if (isGuestMode) {
      const storedGuestProfile = localStorage.getItem("focuson_guest_profile");
      const storedGuestSessions = localStorage.getItem("focuson_guest_sessions");

      if (storedGuestProfile) {
        setUserProfile(JSON.parse(storedGuestProfile));
      } else {
        const defaultGuestProfile: UserProfile = {
          uid: "guest",
          email: "guest@focuson.io",
          displayName: "Sandbox Visitor",
          photoURL: null,
          createdAt: new Date().toISOString(),
          adhdMode: false,
          weeklyGoalMinutes: 150
        };
        setUserProfile(defaultGuestProfile);
        localStorage.setItem("focuson_guest_profile", JSON.stringify(defaultGuestProfile));
      }

      if (storedGuestSessions) {
        setUserSessions(JSON.parse(storedGuestSessions));
      } else {
        // Initial clean dummy entries for nice UX presentation
        const seedSessions: FocusSession[] = [
          {
            id: "1",
            userId: "guest",
            taskName: "Database design of main API",
            tinyStep: "Write out 5 schemas in text file",
            originalDurationMinutes: 25,
            actualDurationSeconds: 1500,
            completed: true,
            status: "completed",
            createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
            dateStr: new Date(Date.now() - 36 * 3600 * 1000).toISOString().split("T")[0],
            reflectionNotes: "Completed schema definitions. Discovered that keeping them modular was more scalable.",
            nextStepSuggested: "Test primary signup routing controllers",
            stuckCount: 1,
            distractionCheckInCount: 1
          },
          {
            id: "2",
            userId: "guest",
            taskName: "UI Landing page sketch",
            tinyStep: "Draw outline on paper or wireframe",
            originalDurationMinutes: 20,
            actualDurationSeconds: 1200,
            completed: true,
            status: "completed",
            createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
            dateStr: new Date(Date.now() - 12 * 3600 * 1000).toISOString().split("T")[0],
            reflectionNotes: "Drew 3 layout variations. Picked version 2 for its serene aesthetic space.",
            nextStepSuggested: "Code the header layout",
            stuckCount: 0,
            distractionCheckInCount: 0
          }
        ];
        setUserSessions(seedSessions);
        localStorage.setItem("focuson_guest_sessions", JSON.stringify(seedSessions));
      }
    }
  }, [isGuestMode]);

  // Handle Guest user pathway log entry
  const handleGuestAccess = () => {
    setIsGuestMode(true);
    setCurrentUser(null);
  };

  const handleSignOut = () => {
    setIsGuestMode(false);
    setCurrentUser(null);
    setUserProfile(null);
    setUserSessions([]);
    setActiveTab("focus");
  };

  // Profile data updating helper
  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    const nextProfile = { ...userProfile, ...updates };
    setUserProfile(nextProfile);

    if (currentUser) {
      await updateUserProfile(currentUser.uid, updates);
    } else if (isGuestMode) {
      localStorage.setItem("focuson_guest_profile", JSON.stringify(nextProfile));
    }
  };

  // Save session record helper
  const handleSaveSession = async (sessionData: Omit<FocusSession, "id">) => {
    if (currentUser) {
      const generatedId = await saveFocusSession(sessionData);
      const updatedList = await fetchUserSessions(currentUser.uid);
      setUserSessions(updatedList);
    } else if (isGuestMode) {
      const freshIndexId = `guest_session_${Date.now()}`;
      const newSession: FocusSession = { id: freshIndexId, ...sessionData };
      const updatedList = [newSession, ...userSessions];
      setUserSessions(updatedList);
      localStorage.setItem("focuson_guest_sessions", JSON.stringify(updatedList));
    }
  };

  const handleDeleteHistory = async () => {
    if (currentUser) {
      await deleteAllUserSessions(currentUser.uid);
      setUserSessions([]);
    } else if (isGuestMode) {
      setUserSessions([]);
      localStorage.removeItem("focuson_guest_sessions");
    }
  };

  const handleFactoryReset = async () => {
    if (currentUser) {
      // 1. Delete all session records from database
      await deleteAllUserSessions(currentUser.uid);
      setUserSessions([]);

      // 2. Clear out existing preferences and set back to clean defaults
      const defaults = {
        adhdMode: false,
        weeklyGoalMinutes: 150
      };
      await updateUserProfile(currentUser.uid, defaults);
      setUserProfile(prev => prev ? { ...prev, ...defaults } : null);
    } else if (isGuestMode) {
      // 1. Wipe all local storage caches instantly
      localStorage.removeItem("focuson_guest_sessions");
      localStorage.removeItem("focuson_guest_profile");

      // 2. Force re-seed clean default guest profile & clear logs
      setUserSessions([]);
      const defaultGuestProfile: UserProfile = {
        uid: "guest",
        email: "guest@focuson.io",
        displayName: "Sandbox Visitor",
        photoURL: null,
        createdAt: new Date().toISOString(),
        adhdMode: false,
        weeklyGoalMinutes: 150
      };
      setUserProfile(defaultGuestProfile);
      localStorage.setItem("focuson_guest_profile", JSON.stringify(defaultGuestProfile));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (currentUser) {
      await deleteUserSession(sessionId);
      setUserSessions(prev => prev.filter(s => s.id !== sessionId));
    } else if (isGuestMode) {
      const updatedList = userSessions.filter(s => s.id !== sessionId);
      setUserSessions(updatedList);
      localStorage.setItem("focuson_guest_sessions", JSON.stringify(updatedList));
    }
  };

  // Graceful initial loader view
  if (isAuthLoading && !isGuestMode) {
    return (
      <div className="min-h-screen bg-[#050608] flex flex-col items-center justify-center text-zinc-100 relative overflow-hidden">
        {/* Layered ambient backdrop glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-zinc-700/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="space-y-6 text-center z-10 flex flex-col items-center">
          <div className="relative">
            {/* Elegant luxury infinite ring loader */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
              className="w-14 h-14 rounded-full border border-zinc-850 border-t-zinc-300"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <CircleDot className="w-5 h-5 text-zinc-500 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5 animate-pulse">
            <h3 className="font-sans font-semibold text-xs tracking-[0.25em] uppercase text-zinc-400">FocusOn</h3>
            <p className="text-zinc-650 text-[10px] font-mono tracking-wider">Restoring pristine focus wave...</p>
          </div>
        </div>
      </div>
    );
  }

  // Auth gate
  if (!currentUser && !isGuestMode) {
    return (
      <AuthScreen 
        onGuestAccess={handleGuestAccess} 
        isLoading={isAuthLoading} 
        setIsLoading={setIsAuthLoading} 
      />
    );
  }

  return (
    <div className="min-h-screen text-[#94A3B8] flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-zinc-800 selection:text-white bg-transparent">
      {/* Background ambient light spotlights (optimized with radial gradients to avoid GPU-choking blur filters) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            opacity: [0.12, 0.22, 0.12],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[250px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_65%)]"
        />
        <motion.div
          animate={{
            opacity: [0.06, 0.14, 0.06],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
          className="absolute top-10 left-1/2 -translate-x-1/2 w-[750px] h-[750px] bg-[radial-gradient(circle_at_center,rgba(161,161,170,0.12),transparent_65%)]"
        />
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-xl mx-auto px-5 pt-4 xs:pt-8 sm:pt-12 pb-24 xs:pb-28 sm:pb-32 relative z-10">
        
        {/* Header with exquisite craft details */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex items-center justify-between mb-6 xs:mb-8 sm:mb-12 rotate-[-1.5deg] -ml-2"
        >
          <div className="flex items-center gap-0">
            <div className="w-8 h-8 bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.4)] relative z-20">
              <CircleDot className="w-4 h-4 text-black" />
            </div>
            <div className="flex flex-col text-left bg-[#121212] pt-4 pr-8 pb-2 pl-6 -ml-3 rotate-[2deg] border border-[#2A2A2A] z-10">
              <span className="font-sans font-black text-2xl tracking-tighter text-white leading-[0.85]">FocusOn</span>
              <span className="text-[10px] font-mono text-[#888888] tracking-[0.2em] mt-1 uppercase">Focus Module</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userProfile?.adhdMode && (
              <span className="px-2.5 py-1 rounded border border-[#2A2A2A] text-[9px] font-mono text-[#888888] uppercase tracking-widest">
                Overdrive
              </span>
            )}
            <div className="px-3 py-1.5 border border-[#2A2A2A] rounded flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EEEEEE] shrink-0" />
              <span className="text-[10px] font-mono text-[#888888]">
                {userSessions.filter(s => s.completed).length} Sessions
              </span>
            </div>
          </div>
        </motion.header>

        {/* Tab Viewport */}
        <main className="min-h-[55vh]">
          <AnimatePresence mode="wait">
            {activeTab === "focus" && userProfile && (
              <motion.div
                key="focus"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <FocusTab 
                  user={currentUser}
                  profile={userProfile}
                  lastSession={userSessions.length > 0 ? userSessions[0] : null}
                  userSessions={userSessions}
                  onSessionSave={handleSaveSession}
                />
              </motion.div>
            )}

            {activeTab === "progress" && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <ProgressTab 
                  sessions={userSessions} 
                  profile={userProfile}
                  onDeleteSession={handleDeleteSession} 
                />
              </motion.div>
            )}

            {activeTab === "settings" && userProfile && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <SettingsTab 
                  user={currentUser}
                  profile={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  onSignOut={handleSignOut}
                  onDeleteHistory={handleDeleteHistory}
                  onFactoryReset={handleFactoryReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Bottom Navigator Capsule Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[320px] px-3 animate-fade-in">
        <nav className="h-16 flex justify-around items-center px-2 relative bg-[#121212] border border-[#2A2A2A] rounded-2xl">
          
          <button
            onClick={() => setActiveTab("focus")}
            id="nav-focus-tab"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
          >
            <Clock className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'focus' ? 'text-white' : 'text-[#666666] group-hover:text-[#CCCCCC]'}`} />
            <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'focus' ? 'text-white' : 'text-[#666666] group-hover:text-[#AAAAAA]'}`}>Flow</span>
            {activeTab === "focus" && (
              <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("progress")}
            id="nav-progress-tab"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
          >
            <Activity className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'progress' ? 'text-white' : 'text-[#666666] group-hover:text-[#CCCCCC]'}`} />
            <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'progress' ? 'text-white' : 'text-[#666666] group-hover:text-[#AAAAAA]'}`}>Insights</span>
            {activeTab === "progress" && (
              <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            id="nav-settings-tab"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
          >
            <User className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'settings' ? 'text-white' : 'text-[#666666] group-hover:text-[#CCCCCC]'}`} />
            <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'settings' ? 'text-white' : 'text-[#666666] group-hover:text-[#AAAAAA]'}`}>System</span>
            {activeTab === "settings" && (
              <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />
            )}
          </button>

        </nav>
      </div>

    </div>
  );
}
