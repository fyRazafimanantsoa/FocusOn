import React, { useState, useEffect } from "react";
import { auth, checkRedirectResult } from "./lib/firebase";
import { getOrCreateUserProfile, updateUserProfile, fetchUserSessions, saveFocusSession, deleteAllUserSessions, deleteUserSession, DEFAULT_PROJECTS } from "./lib/db";
import { UserProfile, FocusSession, Project } from "./types";
import AuthScreen from "./components/AuthScreen";
import FocusTab from "./components/FocusTab";
import ProgressTab from "./components/ProgressTab";
import SettingsTab from "./components/SettingsTab";
import ProjectsTab from "./components/ProjectsTab";
import OnboardingTutorial from "./components/OnboardingTutorial";
import { 
  Clock, 
  Activity, 
  User, 
  Flame, 
  Sparkles, 
  CircleDot,
  FolderKanban,
  Pause,
  Play,
  Plus,
  Maximize2,
  MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// @ts-ignore
import bgFlowDark from "./assets/images/bg_flow_dark.jpg";
// @ts-ignore
import bgProgressDark from "./assets/images/bg_progress_dark.jpg";
// @ts-ignore
import bgProjectsDark from "./assets/images/bg_projects_dark.jpg";
// @ts-ignore
import bgSettingsDark from "./assets/images/bg_settings_dark.jpg";

// @ts-ignore
import bgFlowLight from "./assets/images/bg_flow_light.jpg";
// @ts-ignore
import bgProgressLight from "./assets/images/bg_progress_light.jpg";
// @ts-ignore
import bgProjectsLight from "./assets/images/bg_projects_light.jpg";
// @ts-ignore
import bgSettingsLight from "./assets/images/bg_settings_light.jpg";

const BACKGROUNDS = {
  dark: {
    focus: bgFlowDark,
    progress: bgProgressDark,
    projects: bgProjectsDark,
    settings: bgSettingsDark,
  },
  light: {
    focus: bgFlowLight,
    progress: bgProgressLight,
    projects: bgProjectsLight,
    settings: bgSettingsLight,
  }
};

type ActiveTab = "focus" | "progress" | "projects" | "settings";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSessions, setUserSessions] = useState<FocusSession[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [sessionsLimit, setSessionsLimit] = useState(25);

  const handleLoadMore = async () => {
    if (!currentUser) return;
    const nextLimit = sessionsLimit + 25;
    setSessionsLimit(nextLimit);
    try {
      const sessions = await fetchUserSessions(currentUser.uid, nextLimit);
      setUserSessions(sessions);
    } catch (err) {
      console.error("Error loading more sessions:", err);
    }
  };
  
  // Guest Sandbox Mode state
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<ActiveTab>("focus");

  const [syncedSession, setSyncedSession] = useState<any>(null);

  const isSessionActive = syncedSession && 
    syncedSession.focusState !== "idle" && 
    syncedSession.focusState !== "reflected";

  // Force active tab to be "focus" when session becomes active
  useEffect(() => {
    if (isSessionActive) {
      setActiveTab("focus");
    }
  }, [isSessionActive]);

  // Floating Miniaturized Widget State
  const [miniPos, setMiniPos] = useState({ x: 24, y: 100 });
  const [miniSize, setMiniSize] = useState({ width: 220, height: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [miniNoteText, setMiniNoteText] = useState("");
  const [showMiniNotes, setShowMiniNotes] = useState(false);

  const dragStartRef = React.useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = React.useRef({ mouseX: 0, mouseY: 0, width: 0, height: 0 });

  const handleDragDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: miniPos.x,
      posY: miniPos.y
    };
    setIsDragging(true);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    setMiniPos({
      x: Math.max(10, Math.min(window.innerWidth - miniSize.width, dragStartRef.current.posX - dx)),
      y: Math.max(10, Math.min(window.innerHeight - miniSize.height, dragStartRef.current.posY - dy))
    });
  };

  const handleDragUp = (e: React.PointerEvent) => {
    setIsDragging(false);
  };

  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: miniSize.width,
      height: miniSize.height
    };
    setIsResizing(true);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartRef.current.mouseX;
    const dy = e.clientY - resizeStartRef.current.mouseY;
    setMiniSize({
      width: Math.min(500, Math.max(180, resizeStartRef.current.width - dx)),
      height: Math.min(600, Math.max(120, resizeStartRef.current.height - dy))
    });
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    setIsResizing(false);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainSecs.toString().padStart(2, "0")}`;
  };

  const theme = userProfile?.theme || "dark";

  // Apply theme class attribute to root element for native theme scoping
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Check Google redirect sign-in result on mount
  useEffect(() => {
    setIsAuthLoading(true);
    checkRedirectResult()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch((err) => {
        console.error("Redirect login check failed on mount:", err);
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  }, []);

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
          const sessions = await fetchUserSessions(firebaseUser.uid, sessionsLimit);
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
        const parsed = JSON.parse(storedGuestProfile);
        if (!parsed.projects || parsed.projects.length === 0) {
          parsed.projects = DEFAULT_PROJECTS;
          localStorage.setItem("focuson_guest_profile", JSON.stringify(parsed));
        }
        setUserProfile(parsed);
      } else {
        const defaultGuestProfile: UserProfile = {
          uid: "guest",
          email: "guest@focuson.io",
          displayName: "Sandbox Visitor",
          photoURL: null,
          createdAt: new Date().toISOString(),
          adhdMode: false,
          weeklyGoalMinutes: 150,
          projects: DEFAULT_PROJECTS
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
      const updatedList = await fetchUserSessions(currentUser.uid, sessionsLimit);
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

  const handleCreateProject = async (name: string, color: string) => {
    if (!userProfile) return;
    const currentProjects = userProfile.projects || DEFAULT_PROJECTS;
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name,
      color
    };
    const nextProjects = [...currentProjects, newProj];
    await handleUpdateProfile({ projects: nextProjects });
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!userProfile) return;
    const currentProjects = userProfile.projects || DEFAULT_PROJECTS;
    const nextProjects = currentProjects.map(p => p.id === projectId ? { ...p, ...updates } : p);
    await handleUpdateProfile({ projects: nextProjects });
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!userProfile) return;
    const currentProjects = userProfile.projects || DEFAULT_PROJECTS;
    const nextProjects = currentProjects.filter(p => p.id !== projectId);

    const nextSessions = userSessions.map(sess => {
      if (sess.projectId === projectId) {
        const updated = { ...sess };
        delete updated.projectId;
        return updated;
      }
      return sess;
    });
    setUserSessions(nextSessions);

    await handleUpdateProfile({ projects: nextProjects });
  };

  const handleUpdateSessionProject = async (sessionId: string, projectId: string | null) => {
    const nextSessions = userSessions.map(sess => {
      if (sess.id === sessionId) {
        const updated = { ...sess };
        if (projectId === null) {
          delete updated.projectId;
        } else {
          updated.projectId = projectId;
        }
        return updated;
      }
      return sess;
    });
    
    setUserSessions(nextSessions);

    const targetSession = nextSessions.find(s => s.id === sessionId);
    if (targetSession) {
      const { id, ...sessionPayload } = targetSession;
      if (currentUser) {
        await saveFocusSession(sessionPayload, sessionId);
      } else if (isGuestMode) {
        localStorage.setItem("focuson_guest_sessions", JSON.stringify(nextSessions));
      }
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
  if (!currentUser) {
    return (
      <AuthScreen />
    );
  }

  return (
    <div className="text-text-secondary flex flex-col justify-between relative font-sans selection:bg-bg-btn selection:text-text-primary bg-transparent transition-colors duration-500 min-h-screen overflow-x-hidden">
      {/* Onboarding Tutorial Overlay Gate */}
      <AnimatePresence>
        {currentUser && userProfile && !userProfile.completedOnboarding && (
          <OnboardingTutorial 
            onComplete={async () => {
              await handleUpdateProfile({ completedOnboarding: true });
            }}
            onSkip={async () => {
              await handleUpdateProfile({ completedOnboarding: true });
            }}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Backgrounds Stack */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-bg-app transition-colors duration-1000">
        {Object.entries(BACKGROUNDS).map(([themeMode, tabsObj]) => {
          return Object.entries(tabsObj).map(([tabKey, imageSrc]) => {
            const isThemeActive = theme === themeMode;
            const isTabActive = activeTab === tabKey;
            const isActive = isThemeActive && isTabActive;
            
            return (
              <motion.div
                key={`${themeMode}-${tabKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: isActive ? 0.95 : 0 }}
                transition={{ duration: 1.0, ease: "easeInOut" }}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${imageSrc})` }}
              />
            );
          });
        })}
        {/* Ambient Overlay for Blending */}
        <div className={`absolute inset-0 transition-all duration-1000 ${
          theme === "light" 
            ? "bg-white/5 mix-blend-overlay" 
            : "bg-black/30 mix-blend-multiply"
        }`} />
      </div>

      {/* Main Container */}
      <div className={`flex-1 w-full mx-auto px-5 transition-all duration-300 relative z-10 ${
        isSessionActive 
          ? "pt-4 pb-12 max-w-2xl flex flex-col justify-center" 
          : (activeTab === "settings" ? "max-w-xl pt-4 xs:pt-8 sm:pt-12 pb-24 xs:pb-28 sm:pb-32" : "max-w-4xl pt-4 xs:pt-8 sm:pt-12 pb-24 xs:pb-28 sm:pb-32")
      }`}>
        
        {/* Header with exquisite craft details */}
        {!isSessionActive && (
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
              <div className="flex flex-col text-left bg-bg-header-box pt-4 pr-8 pb-2 pl-6 -ml-3 rotate-[2deg] border border-border-app z-10 transition-colors duration-300 shadow-[0_4px_20px_var(--shadow-intensity)]">
                <span className="font-scale-app-name tracking-tighter text-text-primary leading-[0.85] transition-colors duration-300">FocusOn</span>
                <span className="font-scale-tiny font-mono text-text-muted tracking-[0.2em] mt-1 uppercase transition-colors duration-300">Focus Module</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userProfile?.adhdMode && (
                <span className="px-2.5 py-1 rounded border border-border-app text-[9px] font-mono text-text-secondary uppercase tracking-widest bg-bg-card transition-colors duration-300">
                  Overdrive
                </span>
              )}
              <div className="px-3 py-1.5 border border-border-app bg-bg-card/40 backdrop-blur-sm rounded flex items-center gap-2 transition-colors duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-text-primary shrink-0 transition-colors duration-300" />
                <span className="text-[10px] font-mono text-text-secondary transition-colors duration-300">
                  {userSessions.filter(s => s.completed).length} Sessions
                </span>
              </div>
            </div>
          </motion.header>
        )}

        {/* Tab Viewport */}
        <main className={isSessionActive ? "flex-1 flex flex-col justify-center" : "min-h-[55vh]"}>
          {/* Persistent FocusTab keeps the timer countdown and audio background running */}
          {userProfile && (
            <div style={{ display: activeTab === "focus" ? "block" : "none" }} className={isSessionActive ? "w-full flex flex-col justify-center" : ""}>
              <FocusTab 
                user={currentUser}
                profile={userProfile}
                lastSession={userSessions.length > 0 ? userSessions[0] : null}
                userSessions={userSessions}
                onSessionSave={handleSaveSession}
                projects={(userProfile.projects || DEFAULT_PROJECTS).filter(p => !p.isArchived)}
                onCreateProject={handleCreateProject}
                onStateSync={setSyncedSession}
              />
            </div>
          )}

          <AnimatePresence mode="wait">

            {activeTab === "progress" && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              >
                <ProgressTab 
                  sessions={userSessions} 
                  profile={userProfile}
                  onDeleteSession={handleDeleteSession} 
                  projects={userProfile.projects || DEFAULT_PROJECTS}
                  onCreateProject={handleCreateProject}
                  onUpdateSessionProject={handleUpdateSessionProject}
                  onLoadMore={handleLoadMore}
                  hasMore={userSessions.length === sessionsLimit}
                />
              </motion.div>
            )}

            {activeTab === "projects" && (
              <motion.div
                key="projects"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              >
                <ProjectsTab 
                  sessions={userSessions} 
                  projects={userProfile.projects || DEFAULT_PROJECTS}
                  onCreateProject={handleCreateProject}
                  onUpdateProject={handleUpdateProject}
                  onDeleteProject={handleDeleteProject}
                  profile={userProfile}
                />
              </motion.div>
            )}

            {activeTab === "settings" && userProfile && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              >
                <SettingsTab 
                  user={currentUser}
                  profile={userProfile}
                  sessions={userSessions}
                  projects={userProfile?.projects || []}
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
      {!isSessionActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[370px] px-3 animate-fade-in">
          <nav className="h-16 flex justify-around items-center px-2 relative bg-bg-panel border border-border-app rounded-2xl backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition-colors duration-300">
            
            <motion.button
              onClick={() => setActiveTab("focus")}
              id="nav-focus-tab"
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Clock className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'focus' ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'}`} />
              <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'focus' ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-secondary'}`}>Flow</span>
              {activeTab === "focus" && (
                <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-nav-indicator" />
              )}
            </motion.button>

            <motion.button
              onClick={() => setActiveTab("progress")}
              id="nav-progress-tab"
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Activity className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'progress' ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'}`} />
              <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'progress' ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-secondary'}`}>Insights</span>
              {activeTab === "progress" && (
                <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-nav-indicator" />
              )}
            </motion.button>

            <motion.button
              onClick={() => setActiveTab("projects")}
              id="nav-projects-tab"
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              <FolderKanban className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'projects' ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'}`} />
              <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'projects' ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-secondary'}`}>Registry</span>
              {activeTab === "projects" && (
                <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-nav-indicator" />
              )}
            </motion.button>

            <motion.button
              onClick={() => setActiveTab("settings")}
              id="nav-settings-tab"
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 relative transition-colors cursor-pointer group"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
            >
              <User className={`w-4 h-4 transition-colors duration-300 ${activeTab === 'settings' ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'}`} />
              <span className={`text-[9px] font-mono tracking-wider transition-colors duration-300 ${activeTab === 'settings' ? 'text-text-primary font-medium' : 'text-text-muted group-hover:text-text-secondary'}`}>System</span>
              {activeTab === "settings" && (
                <motion.div layoutId="activeNavIndicator" className="absolute bottom-1 w-1 h-1 rounded-full bg-nav-indicator" />
              )}
            </motion.button>

          </nav>
        </div>
      )}

      {/* Floating Miniaturized Timer Widget */}
      {activeTab !== "focus" && isSessionActive && (
        <div
          style={{
            position: "fixed",
            right: `${miniPos.x}px`,
            bottom: `${miniPos.y}px`,
            width: `${miniSize.width}px`,
            height: `${miniSize.height}px`,
            zIndex: 9999,
          }}
          className="bg-bg-panel/90 backdrop-blur-md border border-border-app rounded-xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300"
          id="mini-timer-widget"
        >
          {/* Header handle for dragging */}
          <div
            onPointerDown={handleDragDown}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragUp}
            onPointerLeave={handleDragUp}
            className="h-9 px-2.5 bg-bg-card border-b border-border-app flex items-center justify-between cursor-move select-none shrink-0"
          >
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-text-secondary truncate pr-2">
              {syncedSession.taskName || "Active Flow"}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Maximize to full view */}
              <button
                type="button"
                onClick={() => setActiveTab("focus")}
                className="p-1 text-text-muted hover:text-text-primary transition-colors hover:bg-bg-btn rounded cursor-pointer"
                title="Restore to full screen"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Core Content area */}
          <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden select-none">
            
            {/* Time display & Controls */}
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-text-primary">
                {formatTime(syncedSession.timeRemaining)}
              </span>
              
              <div className="flex items-center gap-1.5">
                {/* Play / Pause Toggle button */}
                <button
                  type="button"
                  onClick={syncedSession.handlePauseToggle}
                  className="w-8 h-8 rounded bg-text-primary text-bg-app flex items-center justify-center hover:opacity-95 transition-opacity cursor-pointer shrink-0"
                  title={syncedSession.focusState === "paused" ? "Resume" : "Pause"}
                >
                  {syncedSession.focusState === "paused" ? (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>

                {/* Plus note expander */}
                <button
                  type="button"
                  onClick={() => setShowMiniNotes(!showMiniNotes)}
                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    showMiniNotes 
                      ? "bg-text-primary/10 border-text-primary text-text-primary" 
                      : "bg-bg-btn border-border-app text-text-secondary hover:text-text-primary"
                  }`}
                  title="Add sudden note"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expansible Mini Note input inside the floating widget */}
            {showMiniNotes ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (miniNoteText.trim()) {
                    if (syncedSession.setBrainDumps) {
                      syncedSession.setBrainDumps((prev: string[]) => [...prev, miniNoteText.trim()]);
                    }
                    setMiniNoteText("");
                  }
                }}
                className="mt-2 flex gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={miniNoteText}
                  onChange={(e) => setMiniNoteText(e.target.value)}
                  placeholder="Note text..."
                  className="flex-1 h-6 px-1.5 text-[10px] bg-bg-btn border border-border-app text-text-primary rounded outline-none placeholder-text-muted"
                />
                <button
                  type="submit"
                  className="h-6 px-2 bg-text-primary text-bg-app text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-opacity hover:opacity-90"
                >
                  Add
                </button>
              </form>
            ) : (
              <div className="text-[9px] font-mono text-text-muted uppercase tracking-wider truncate mt-1 shrink-0">
                • {syncedSession.focusState === "focusing" ? "Active Block" : syncedSession.focusState === "paused" ? "Paused" : "Flow State"}
              </div>
            )}
          </div>

          {/* Resize handle at top-left of the mini window */}
          <div
            onPointerDown={handleResizeDown}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerLeave={handleResizeUp}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize flex items-center justify-center select-none"
            title="Resize mini timer window"
          >
            <div className="w-1.5 h-1.5 border-t border-l border-text-muted/40" />
          </div>
        </div>
      )}

      {/* Floating Feedback Action Button at Bottom Right Corner */}
      <motion.a
        href="https://forms.gle/FYEdVhAjCryxPS9E8"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[9998] bg-[#2563eb] hover:bg-[#1d4ed8] text-white p-3.5 rounded-full shadow-2xl flex items-center justify-center border border-blue-400/20 group cursor-pointer transition-colors"
        id="floating-feedback-button"
        title="Share your Feedback"
      >
        <MessageCircle className="w-5.5 h-5.5 text-white" />
        <span className="absolute right-full mr-2.5 px-2.5 py-1.5 rounded bg-black/95 text-[10px] font-mono tracking-wider text-zinc-100 uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-zinc-800 shadow-xl">
          Share Feedback ↗
        </span>
      </motion.a>

    </div>
  );
}
