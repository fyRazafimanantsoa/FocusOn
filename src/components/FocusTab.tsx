import React, { useState, useEffect, useRef } from "react";
import { UserProfile, FocusSession, Project } from "../types";
import SecureProgressModal from "./SecureProgressModal";
import { 
  Play, 
  ArrowRight, 
  Clock, 
  Flame, 
  AlertCircle, 
  Check, 
  CheckCircle2, 
  Activity, 
  BookOpen, 
  HeartHandshake,
  Pause,
  Minimize2,
  Maximize2,
  AlertTriangle,
  CornerDownRight,
  RefreshCw,
  Search,
  Plus,
  FolderPlus,
  Tag,
  Trash2,
  Sparkles,
  Volume2,
  VolumeX,
  Music,
  Users,
  Radio,
  Notebook,
  HelpCircle,
  BrainCircuit,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

let sharedAudioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  // Ensure it's resumed during user interaction
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
};

const playEndSound = () => {
  try {
    if (!sharedAudioCtx) return;
    const osc = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, sharedAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, sharedAudioCtx.currentTime + 1);
    
    gainNode.gain.setValueAtTime(0, sharedAudioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, sharedAudioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + 1.5);
    
    osc.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    
    osc.start(sharedAudioCtx.currentTime);
    osc.stop(sharedAudioCtx.currentTime + 1.5);
  } catch (e) {
    console.error("Audio play error:", e);
  }
};

const playStartSound = () => {
  try {
    if (!sharedAudioCtx) return;
    const osc = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, sharedAudioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, sharedAudioCtx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0, sharedAudioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, sharedAudioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, sharedAudioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    
    osc.start(sharedAudioCtx.currentTime);
    osc.stop(sharedAudioCtx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play error:", e);
  }
};

const playSuccessChime = () => {
  try {
    if (!sharedAudioCtx) return;
    const osc = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, sharedAudioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, sharedAudioCtx.currentTime + 0.08); // A5
    
    gainNode.gain.setValueAtTime(0, sharedAudioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, sharedAudioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.005, sharedAudioCtx.currentTime + 0.25);
    
    osc.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    
    osc.start(sharedAudioCtx.currentTime);
    osc.stop(sharedAudioCtx.currentTime + 0.25);
  } catch (e) {
    console.error("Audio play error:", e);
  }
};

interface FocusTabProps {
  user: any;
  profile: UserProfile;
  lastSession: FocusSession | null;
  userSessions: FocusSession[];
  onSessionSave: (session: Omit<FocusSession, "id">) => Promise<void>;
  projects: Project[];
  onCreateProject: (name: string, color: string) => Promise<void>;
  onStateSync?: (sync: any) => void;
}

type FocusState = "idle" | "tiny_step" | "focusing" | "paused" | "stuck_rescue" | "distracted" | "interval_break" | "guilt_free_break" | "reflecting" | "reflected";
type SessionMode = "single" | "interval";

export default function FocusTab({ user, profile, lastSession, userSessions, onSessionSave, projects, onCreateProject, onStateSync }: FocusTabProps) {
  // Load active session from localStorage if it exists
  const savedSession = (() => {
    try {
      const data = localStorage.getItem("adhd_focus_active_session");
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && parsed.focusState) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read active session from localStorage", e);
    }
    return null;
  })();

  const elapsedSeconds = (() => {
    if (savedSession && ["focusing", "interval_break", "guilt_free_break"].includes(savedSession.focusState)) {
      const lastTick = savedSession.lastTickTimestamp;
      if (lastTick) {
        const diff = Math.max(0, Math.floor((Date.now() - lastTick) / 1000));
        // Clamp to remaining time to prevent skipping multiple intervals
        if (savedSession.focusState === "guilt_free_break") {
          return Math.min(diff, savedSession.guiltFreeRemaining || 0);
        } else {
          return Math.min(diff, savedSession.timeRemaining || 0);
        }
      }
    }
    return 0;
  })();

  const theme = profile?.theme || "dark";
  // Core Focus states
  const [focusState, setFocusState] = useState<FocusState>(savedSession ? savedSession.focusState : "idle");
  const [prePausedState, setPrePausedState] = useState<FocusState>(savedSession ? (savedSession.prePausedState || "focusing") : "focusing");
  const [isSecureModalOpen, setIsSecureModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreatingProj, setIsCreatingProj] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjColor, setNewProjColor] = useState("#FFFFFF");
  const [isCreatingProjLoading, setIsCreatingProjLoading] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>(savedSession ? savedSession.sessionMode : "single");
  const [taskName, setTaskName] = useState(savedSession ? savedSession.taskName : "");
  const [tinyStep, setTinyStep] = useState(savedSession ? savedSession.tinyStep : "");
  const [sessionMinutes, setSessionMinutes] = useState<number | "">(savedSession ? savedSession.sessionMinutes : (profile.adhdMode ? 20 : 25));
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    if (savedSession) {
      if (["focusing", "interval_break"].includes(savedSession.focusState)) {
        return Math.max(0, savedSession.timeRemaining - elapsedSeconds);
      }
      return savedSession.timeRemaining;
    }
    return (profile.adhdMode ? 20 : 25) * 60;
  });
  const [timeUnit, setTimeUnit] = useState<"min" | "hrs">("min");
  const [inputValue, setInputValue] = useState<string>(
    savedSession 
      ? (savedSession.sessionMinutes ? savedSession.sessionMinutes.toString() : (profile.adhdMode ? "20" : "25"))
      : (profile.adhdMode ? "20" : "25")
  );
  const [showProjectSection, setShowProjectSection] = useState(false);

  const lastSelectedProjectIdRef = useRef<string | null | undefined>(undefined);
  const lastAdhdModeRef = useRef<boolean | undefined>(undefined);

  // Synchronize custom duration override if the selected project has one configured
  useEffect(() => {
    if (focusState !== "idle") return;

    if (selectedProjectId !== lastSelectedProjectIdRef.current || profile.adhdMode !== lastAdhdModeRef.current) {
      lastSelectedProjectIdRef.current = selectedProjectId;
      lastAdhdModeRef.current = profile.adhdMode;

      if (selectedProjectId) {
        const selectedProj = projects.find(p => p.id === selectedProjectId);
        if (selectedProj && typeof selectedProj.customDuration === "number") {
          setSessionMinutes(selectedProj.customDuration);
          setTimeRemaining(selectedProj.customDuration * 60);
        } else {
          const defaultMins = profile.adhdMode ? 20 : 25;
          setSessionMinutes(defaultMins);
          setTimeRemaining(defaultMins * 60);
        }
      } else {
        const defaultMins = profile.adhdMode ? 20 : 25;
        setSessionMinutes(defaultMins);
        setTimeRemaining(defaultMins * 60);
      }
    }
  }, [selectedProjectId, projects, profile.adhdMode, focusState]);

  // Keep manual input value in sync when minutes change (unless actively typing in it)
  useEffect(() => {
    if (document.activeElement?.id === "session-length-input") {
      return;
    }
    if (sessionMinutes !== "") {
      if (timeUnit === "min") {
        setInputValue(sessionMinutes.toString());
      } else {
        const hrs = Math.round((sessionMinutes / 60) * 10) / 10;
        setInputValue(hrs.toString());
      }
    } else {
      setInputValue("");
    }
  }, [sessionMinutes, timeUnit]);

  const handleUnitChange = (newUnit: "min" | "hrs") => {
    setTimeUnit(newUnit);
    if (sessionMinutes !== "") {
      if (newUnit === "min") {
        setInputValue(sessionMinutes.toString());
      } else {
        const hrs = Math.round((sessionMinutes / 60) * 10) / 10;
        setInputValue(hrs.toString());
      }
    }
  };

  const handleAdjustSessionLength = (direction: "up" | "down") => {
    const currentMins = typeof sessionMinutes === "number" ? sessionMinutes : 25;
    let newMins = currentMins;
    
    if (timeUnit === "min") {
      newMins = direction === "up" ? currentMins + 5 : currentMins - 5;
      newMins = Math.max(1, Math.min(300, newMins));
    } else {
      // Step by 0.5 hours (30 minutes)
      newMins = direction === "up" ? currentMins + 30 : currentMins - 30;
      newMins = Math.max(1, Math.min(300, newMins)); // 1 min is the absolute minimum
    }
    
    setSessionMinutes(newMins);
    setTimeRemaining(newMins * 60);
    
    if (timeUnit === "min") {
      setInputValue(newMins.toString());
    } else {
      const hrs = Math.round((newMins / 60) * 10) / 10;
      setInputValue(hrs.toString());
    }
  };

  const formatSessionMinutes = (mins: number | "") => {
    if (mins === "") return "";
    if (mins >= 60) {
      const hrs = Math.round((mins / 60) * 10) / 10;
      return `${hrs}h`;
    }
    return `${mins}m`;
  };

  // Interactive micro-task sub-steps
  const [subSteps, setSubSteps] = useState<{ id: string; text: string; completed: boolean }[]>(savedSession ? savedSession.subSteps : []);
  const [newSubStepText, setNewSubStepText] = useState("");
  const [primaryCompleted, setPrimaryCompleted] = useState(savedSession ? !!savedSession.primaryCompleted : false);

  // Feature 1: Brain Dump Scratchpad during active focus
  const [brainDumps, setBrainDumps] = useState<string[]>(savedSession ? savedSession.brainDumps : []);
  const [currentBrainDump, setCurrentBrainDump] = useState("");
  const [showNotesWidget, setShowNotesWidget] = useState(false);

  // Feature 3: Silent Study Body Doubling Partners - Non-Developer Specific Tasks
  const [bodyDoublingEnabled, setBodyDoublingEnabled] = useState(true);
  const [partners, setPartners] = useState<{ id: string; name: string; task: string; progress: number }[]>([
    { id: "p1", name: "Maya", task: "Reading course textbook", progress: 34 },
    { id: "p2", name: "Liam", task: "Drafting thesis outline", progress: 72 },
    { id: "p3", name: "Elena", task: "Sketching layout ideas", progress: 12 },
    { id: "p4", name: "Aiden", task: "Reviewing inbox & replying", progress: 55 }
  ]);

  // Feature 4: Ambient Audio Synthesizer (Web Audio API)
  const [ambientSoundType, setAmbientSoundType] = useState<"none" | "brown" | "pink" | "binaural">("none");
  const [savedAmbientSoundType, setSavedAmbientSoundType] = useState<"brown" | "pink" | "binaural">("brown");
  const [ambientVolume, setAmbientVolume] = useState<number>(0.4);
  const ambientAudioCtxRef = useRef<AudioContext | null>(null);
  const noiseSourceNodeRef = useRef<any | null>(null);
  const noiseGainNodeRef = useRef<GainNode | null>(null);

  // Onboarding Coachmarks
  const [showOnboardingCoachmark, setShowOnboardingCoachmark] = useState(() => {
    try {
      return localStorage.getItem("adhd_flow_onboarding_dismissed") !== "true";
    } catch {
      return true;
    }
  });

  // Interval states
  const [intervalCount, setIntervalCount] = useState<number | "">(savedSession ? savedSession.intervalCount : 4);
  const [currentInterval, setCurrentInterval] = useState(savedSession ? savedSession.currentInterval : 1);
  const [breakMinutes, setBreakMinutes] = useState<number | "">(savedSession ? savedSession.breakMinutes : 5);
  const [accumulatedFocusSeconds, setAccumulatedFocusSeconds] = useState(savedSession ? savedSession.accumulatedFocusSeconds : 0);
  
  // Reflection states
  const [completedNotes, setCompletedNotes] = useState("");
  const [nextStepCaptured, setNextStepCaptured] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMomentumNotification, setShowMomentumNotification] = useState(false);
  const [guiltFreeRemaining, setGuiltFreeRemaining] = useState<number>(() => {
    if (savedSession) {
      if (savedSession.focusState === "guilt_free_break") {
        return Math.max(0, savedSession.guiltFreeRemaining - elapsedSeconds);
      }
      return savedSession.guiltFreeRemaining;
    }
    return 5 * 60;
  });

  // Counters to persist in the session
  const [stuckCount, setStuckCount] = useState(0);
  const [distractionCount, setDistractionCount] = useState(0);
  const [apparentActivity, setApparentActivity] = useState("");
  const [showAddTime, setShowAddTime] = useState(false);
  const [customAddMins, setCustomAddMins] = useState("");

  // Minimized floating timer states
  const [isMinimized, setIsMinimized] = useState(false);
  const [minimizedPosition, setMinimizedPosition] = useState({ x: 400, y: 300 });
  const [minimizedSize, setMinimizedSize] = useState({ width: 280, height: 220 });
  const [minimizedNoteText, setMinimizedNoteText] = useState("");

  const handleAddTime = (minsToAdd: number) => {
    setSessionMinutes(prev => (typeof prev === 'number' ? prev + minsToAdd : 25 + minsToAdd));
    setTimeRemaining(prev => prev + minsToAdd * 60);
    setShowAddTime(false);
    setCustomAddMins("");
  };



  const handleAddSubStep = () => {
    if (!newSubStepText.trim()) return;
    setSubSteps(prev => [
      ...prev,
      {
        id: `step_${Date.now()}`,
        text: newSubStepText.trim(),
        completed: false
      }
    ]);
    setNewSubStepText("");
  };

  const handleRemoveSubStep = (id: string) => {
    setSubSteps(prev => prev.filter(s => s.id !== id));
  };

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger 5s banner upon landing on Idle with a fresh/non-resumed last session nextStep
  useEffect(() => {
    if (focusState === "idle" && lastSession?.id && lastSession?.nextStepSuggested) {
      const storageKey = `momentum_notified_${lastSession.id}`;
      const alreadyNotified = sessionStorage.getItem(storageKey);
      
      if (!alreadyNotified) {
        setShowMomentumNotification(true);
        sessionStorage.setItem(storageKey, "true");
        const timer = setTimeout(() => {
          setShowMomentumNotification(false);
        }, 5000);
        return () => clearTimeout(timer);
      } else {
        setShowMomentumNotification(false);
      }
    } else {
      setShowMomentumNotification(false);
    }
  }, [focusState, lastSession?.id, lastSession?.nextStepSuggested]);

  // Position minimized widget in the bottom-right of the viewport upon mount/start
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMinimizedPosition({
        x: window.innerWidth - 300,
        y: Math.max(80, window.innerHeight - 250)
      });
    }
  }, []);

  // Minimize timer automatically when leaving the tab, so they have a clean micro-view when returning
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (["focusing", "paused", "interval_break", "guilt_free_break"].includes(focusState)) {
          setIsMinimized(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [focusState]);

  // Sync browser tab title with ticking time
  useEffect(() => {
    if (["focusing", "interval_break", "guilt_free_break"].includes(focusState)) {
      const formatted = formatTime(focusState === "guilt_free_break" ? guiltFreeRemaining : timeRemaining);
      const prefix = focusState === "interval_break" ? "☕ Break" : "🎯 Focus";
      document.title = `(${formatted}) ${prefix} - FocusOn`;
    } else if (focusState === "paused") {
      document.title = `⏸️ Paused - FocusOn`;
    } else {
      document.title = "FocusOn - ADHD Support";
    }
    return () => {
      document.title = "FocusOn - ADHD Support";
    };
  }, [focusState, timeRemaining, guiltFreeRemaining]);

  // Automatically exit minimized view if state transitions out of active timer states
  useEffect(() => {
    if (["idle", "reflecting", "tiny_step", "stuck_rescue", "distracted"].includes(focusState)) {
      setIsMinimized(false);
    }
  }, [focusState]);

  // Resume last session next step if it exists
  const handleResumeLastSession = () => {
    initAudio();
    if (lastSession?.nextStepSuggested) {
      setTaskName(lastSession.taskName);
      setTinyStep(lastSession.nextStepSuggested);
      setFocusState("tiny_step");
    }
  };

  const handlePauseToggle = () => {
    initAudio();
    if (focusState === "focusing" || focusState === "interval_break" || focusState === "guilt_free_break") {
      setPrePausedState(focusState);
      setFocusState("paused");
      playEndSound();
    } else if (focusState === "paused") {
      setFocusState(prePausedState || "focusing");
      playStartSound();
    }
  };

  // Start the actual session timer
  const handleStartTimer = () => {
    initAudio();
    setCurrentInterval(1);
    setAccumulatedFocusSeconds(0);
    setFocusState("focusing");
    setTimeRemaining((sessionMinutes || 25) * 60);
    playStartSound();
  };

  // Create a ref for state to use inside setInterval without stale closures
  const stateRef = useRef({ 
    focusState, 
    sessionMode, 
    currentInterval, 
    intervalCount: intervalCount || 1, 
    sessionMinutes: sessionMinutes || 25, 
    breakMinutes: breakMinutes || 5 
  });
  useEffect(() => {
    stateRef.current = { 
      focusState, 
      sessionMode, 
      currentInterval, 
      intervalCount: intervalCount || 1, 
      sessionMinutes: sessionMinutes || 25, 
      breakMinutes: breakMinutes || 5 
    };
  }, [focusState, sessionMode, currentInterval, intervalCount, sessionMinutes, breakMinutes]);

  // Save active session to localStorage on any relevant state change to handle background/minimize/reload
  useEffect(() => {
    if (["focusing", "paused", "interval_break", "guilt_free_break", "tiny_step", "stuck_rescue", "distracted"].includes(focusState)) {
      const stateToSave = {
        focusState,
        prePausedState,
        sessionMode,
        taskName,
        tinyStep,
        subSteps,
        sessionMinutes,
        breakMinutes,
        intervalCount,
        currentInterval,
        timeRemaining,
        guiltFreeRemaining,
        accumulatedFocusSeconds,
        brainDumps,
        primaryCompleted,
        lastTickTimestamp: Date.now()
      };
      localStorage.setItem("adhd_focus_active_session", JSON.stringify(stateToSave));
    } else {
      localStorage.removeItem("adhd_focus_active_session");
    }
  }, [
    focusState,
    prePausedState,
    sessionMode,
    taskName,
    tinyStep,
    subSteps,
    sessionMinutes,
    breakMinutes,
    intervalCount,
    currentInterval,
    timeRemaining,
    guiltFreeRemaining,
    accumulatedFocusSeconds,
    brainDumps,
    primaryCompleted
  ]);

  const handleTimerZero = () => {
    playEndSound();
    const s = stateRef.current;
    if (s.focusState === "interval_break") {
      setFocusState("focusing");
      setTimeRemaining(s.sessionMinutes * 60);
      playStartSound();
    } else {
      setAccumulatedFocusSeconds((prev) => prev + (s.sessionMinutes * 60));
      if (s.sessionMode === "interval" && s.currentInterval < s.intervalCount) {
        setCurrentInterval(prev => prev + 1);
        setFocusState("interval_break");
        setTimeRemaining(s.breakMinutes * 60);
        playStartSound();
      } else {
        setNextStepCaptured("");
        setFocusState("reflecting");
      }
    }
  };

  const handleGuiltFreeZero = () => {
    playEndSound();
    setFocusState("focusing");
    playStartSound();
  };

  // Helper selectors
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainSecs.toString().padStart(2, "0")}`;
  };

  // Document title updates for background clock
  useEffect(() => {
    if (focusState === "focusing") {
      document.title = `🎯 ${formatTime(timeRemaining)} - FocusOn`;
    } else if (focusState === "interval_break") {
      document.title = `☕ ${formatTime(timeRemaining)} Break - FocusOn`;
    } else if (focusState === "guilt_free_break") {
      document.title = `🍃 ${formatTime(guiltFreeRemaining)} Rest - FocusOn`;
    } else if (focusState === "paused") {
      document.title = `⏸ Paused - FocusOn`;
    } else {
      document.title = `FocusOn`;
    }
  }, [timeRemaining, focusState, guiltFreeRemaining]);

  // Ambient Noise Synthesizer (Web Audio API)
  const handleStartAmbientNoise = (type: "none" | "brown" | "pink" | "binaural", vol: number) => {
    try {
      if (noiseSourceNodeRef.current) {
        try { noiseSourceNodeRef.current.disconnect(); } catch (e) {}
        noiseSourceNodeRef.current = null;
      }
      if (noiseGainNodeRef.current) {
        try { noiseGainNodeRef.current.disconnect(); } catch (e) {}
        noiseGainNodeRef.current = null;
      }

      if (type === "none") return;

      if (!ambientAudioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        ambientAudioCtxRef.current = new AudioContextClass();
      }
      
      const ctx = ambientAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(vol * 0.15, ctx.currentTime); // Background level
      noiseGainNodeRef.current = gainNode;

      let source: AudioNode;

      if (type === "brown") {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
        const bufferSource = ctx.createBufferSource();
        bufferSource.buffer = noiseBuffer;
        bufferSource.loop = true;
        bufferSource.connect(gainNode);
        bufferSource.start();
        source = bufferSource;
      } else if (type === "pink") {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;
          output[i] = pink * 0.11;
        }
        const bufferSource = ctx.createBufferSource();
        bufferSource.buffer = noiseBuffer;
        bufferSource.loop = true;
        bufferSource.connect(gainNode);
        bufferSource.start();
        source = bufferSource;
      } else {
        // Binaural theta beat (140Hz left channel, 147Hz right channel -> 7Hz focus)
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = "sine";
        oscR.type = "sine";
        oscL.frequency.setValueAtTime(140, ctx.currentTime);
        oscR.frequency.setValueAtTime(147, ctx.currentTime);

        const splitter = ctx.createChannelMerger(2);
        oscL.connect(splitter, 0, 0);
        oscR.connect(splitter, 0, 1);
        
        splitter.connect(gainNode);
        oscL.start();
        oscR.start();

        source = {
          disconnect: () => {
            try { oscL.stop(); } catch (e) {}
            try { oscR.stop(); } catch (e) {}
            try { oscL.disconnect(); } catch (e) {}
            try { oscR.disconnect(); } catch (e) {}
            try { splitter.disconnect(); } catch (e) {}
          }
        } as any;
      }

      gainNode.connect(ctx.destination);
      noiseSourceNodeRef.current = source;
    } catch (err) {
      console.warn("Audio Synthesizer setup failed:", err);
    }
  };

  const handleStopAmbientNoise = () => {
    try {
      if (noiseSourceNodeRef.current) {
        noiseSourceNodeRef.current.disconnect();
        noiseSourceNodeRef.current = null;
      }
      if (noiseGainNodeRef.current) {
        noiseGainNodeRef.current.disconnect();
        noiseGainNodeRef.current = null;
      }
    } catch (e) {}
  };

  // Synchronize active session state with App.tsx for miniaturized timer widget
  useEffect(() => {
    if (onStateSync) {
      onStateSync({
        focusState,
        timeRemaining,
        taskName,
        brainDumps,
        setBrainDumps,
        handlePauseToggle,
      });
    }
  }, [focusState, timeRemaining, taskName, brainDumps, onStateSync]);

  const previewTimeoutRef = useRef<any>(null);

  // Sync ambient sound selection with timer execution state / Preview for setup
  useEffect(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if ((focusState === "focusing" || focusState === "paused") && ambientSoundType !== "none") {
      handleStartAmbientNoise(ambientSoundType, ambientVolume);
    } else if ((focusState === "tiny_step" || focusState === "idle") && ambientSoundType !== "none") {
      // Setup preview: Play for 2.5 seconds only!
      handleStartAmbientNoise(ambientSoundType, ambientVolume);
      previewTimeoutRef.current = setTimeout(() => {
        handleStopAmbientNoise();
      }, 2500);
    } else {
      handleStopAmbientNoise();
    }

    return () => {
      handleStopAmbientNoise();
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [ambientSoundType, ambientVolume, focusState]);

  // Silent Study Body Doubling partner movement ticker
  useEffect(() => {
    if (focusState !== "focusing" || !bodyDoublingEnabled) return;

    const interval = setInterval(() => {
      setPartners(prev => prev.map(p => {
        const nextProg = p.progress + (Math.random() > 0.6 ? 2 : 0);
        return {
          ...p,
          progress: nextProg >= 100 ? 0 : nextProg
        };
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, [focusState, bodyDoublingEnabled]);

  // Timer tick effect
  const lastTickTime = useRef<number>(Date.now());
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // WebWorker to prevent browser background throttling
    const blob = new Blob([`
      let interval = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!interval) {
            interval = setInterval(() => {
              self.postMessage('tick');
            }, 1000);
          }
        } else if (e.data === 'stop') {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      };
    `], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (focusState === "focusing" || focusState === "interval_break" || focusState === "guilt_free_break") {
      lastTickTime.current = Date.now();
      
      const handleTick = () => {
        const now = Date.now();
        const delta = Math.round((now - lastTickTime.current) / 1000);
        
        if (delta > 0) {
          lastTickTime.current = now;
          if (focusState === "guilt_free_break") {
            if (sessionMode !== "single") {
              setGuiltFreeRemaining((prev) => Math.max(0, prev - delta));
            }
          } else {
            setTimeRemaining((prev) => Math.max(0, prev - delta));
          }
        }
      };

      workerRef.current?.addEventListener('message', handleTick);
      workerRef.current?.postMessage('start');
      
      return () => {
        workerRef.current?.removeEventListener('message', handleTick);
        workerRef.current?.postMessage('stop');
      };
    } else {
      workerRef.current?.postMessage('stop');
    }
  }, [focusState]);

  // Clean transition triggers when remaining timer values hit zero
  useEffect(() => {
    if (focusState === "focusing" || focusState === "interval_break") {
      if (timeRemaining <= 0) {
        handleTimerZero();
      }
    }
  }, [timeRemaining, focusState]);

  useEffect(() => {
    if (focusState === "guilt_free_break") {
      if (guiltFreeRemaining <= 0) {
        handleGuiltFreeZero();
      }
    }
  }, [guiltFreeRemaining, focusState]);

  // Request stuck rescue
  const handleStuckRescue = () => {
    setStuckCount((prev) => prev + 1);
    setFocusState("stuck_rescue");
  };

  // Request distraction analysis check-in
  const handleDistractionCheckIn = (activity: string) => {
    setDistractionCount((prev) => prev + 1);
    setApparentActivity(activity);
    setFocusState("distracted");
  };

  const handleResolveDistraction = (choice: "learning" | "break" | "resume") => {
    if (choice === "resume") {
      setFocusState("focusing");
      playStartSound();
    } else if (choice === "break") {
      // 5-minute restorative reset with dedicated timer/state instead of wiping focus session
      setGuiltFreeRemaining(5 * 60);
      setFocusState("guilt_free_break");
      playStartSound();
    } else if (choice === "learning") {
      // intentional study allowed
      setFocusState("focusing");
      playStartSound();
    }
  };

  const handleCompleteSession = () => {
    const min = typeof sessionMinutes === 'number' ? sessionMinutes : 25;
    let elapsedNow = 0;
    if (focusState !== "idle" && focusState !== "tiny_step" && focusState !== "interval_break") {
      elapsedNow = Math.max(0, min * 60 - timeRemaining);
    }
    setAccumulatedFocusSeconds(prev => prev + elapsedNow);
    setNextStepCaptured("");
    playEndSound();
    setFocusState("reflecting");
  };

  // Submit focus session reflection
  const handleSaveReflection = async () => {
    setIsSaving(true);
    try {
      const min = typeof sessionMinutes === 'number' ? sessionMinutes : 25;
      const count = intervalCount || 1;
      
      // Ensure we log exactly what was accumulated. If 0, then 0.
      const finalDuration = accumulatedFocusSeconds;
      
      // Save to Firebase
      await onSessionSave({
        userId: user?.uid || "guest",
        taskName,
        tinyStep,
        originalDurationMinutes: sessionMode === "interval" ? min * count : min,
        actualDurationSeconds: finalDuration,
        completed: true,
        status: "completed",
        createdAt: new Date().toISOString(),
        dateStr: (() => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })(),
        reflectionNotes: completedNotes || "No notes",
        nextStepSuggested: nextStepCaptured || "Resume working from where you left off",
        stuckCount,
        distractionCheckInCount: distractionCount,
        projectId: selectedProjectId || undefined,
      });

      setFocusState("reflected");
    } catch (err) {
      console.error("Failed to save session:", err);
      setFocusState("idle");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToIdle = () => {
    setTaskName("");
    setTinyStep("");
    setSubSteps([]);
    setNewSubStepText("");
    setPrimaryCompleted(false);
    setStuckCount(0);
    setDistractionCount(0);
    setAccumulatedFocusSeconds(0);
    setSelectedProjectId(null);
    setFocusState("idle");
  };



  // Circular timer calculation
  const min = sessionMinutes || 25;
  const bMin = breakMinutes || 5;
  const totalDurationSeconds = focusState === "interval_break" ? (bMin * 60) : (min * 60);
  const progressRatio = timeRemaining / totalDurationSeconds;

  // Compute frequently repeated tasks for suggestions, falling back to smart defaults for new users
  const frequentTasks = React.useMemo(() => {
    const counts = userSessions.reduce((acc, s) => {
      acc[s.taskName] = (acc[s.taskName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const computed = Object.entries(counts)
      .filter(([_, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
      
    if (computed.length > 0) {
      return computed.slice(0, 4);
    }
    
    // Smart Defaults to bypass initial paralysis and guide first-time flow states
    return [
      "Draft weekly planner & goals",
      "Outline project proposal",
      "Review & reply to critical emails",
      "Brainstorm creative content ideas"
    ];
  }, [userSessions]);

  // Draggable window pointer handlers
  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    // Only drag on left click or touch
    if ('button' in e && e.button !== 0) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const startX = clientX - minimizedPosition.x;
    const startY = clientY - minimizedPosition.y;
    
    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const nextX = currentX - startX;
      const nextY = currentY - startY;
      
      const maxX = window.innerWidth - minimizedSize.width - 10;
      const maxY = window.innerHeight - minimizedSize.height - 10;
      
      setMinimizedPosition({
        x: Math.max(10, Math.min(maxX, nextX)),
        y: Math.max(10, Math.min(maxY, nextY))
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove, { passive: true });
    document.addEventListener("touchend", handleMouseUp);
  };

  // Resizable window pointer handlers with limit to smallest size constraints
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = minimizedSize.width;
    const startHeight = minimizedSize.height;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startX = clientX;
    const startY = clientY;
    
    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      
      // Limit to smallest size: minimum width 250px and minimum height 185px
      const newWidth = Math.max(250, startWidth + deltaX);
      const newHeight = Math.max(185, startHeight + deltaY);
      
      setMinimizedSize({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove, { passive: true });
    document.addEventListener("touchend", handleMouseUp);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-2 px-1 flex flex-col justify-center min-h-[60vh] sm:min-h-[70vh] animate-fade-in" id="focus-tab-viewport">
      <AnimatePresence mode="wait">
        
        {/* IDLE STATE: Launch focus */}
        {focusState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 w-full"
          >
            {/* Title Header matching ProgressTab layout */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left border-b border-zinc-850 pb-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-zinc-300 animate-pulse" />
                  Cognitive Flow Engine
                </h2>
                <p className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                  Sovereign ADHD Flow State Initiation Workspace
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-2.5 py-1 rounded bg-[#121212]/80 border border-[#2A2A2A] text-[9px] font-mono text-[#888888] flex items-center gap-1.5 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Core Ready
                </div>
                <div className="px-2.5 py-1 rounded bg-[#121212]/80 border border-[#2A2A2A] text-[9px] font-mono text-white select-none">
                  ADHD Shield: Active
                </div>
              </div>
            </div>

            {/* Guest Sandbox Loss-Aversion Protection Banner */}
            {user?.uid === "local-user" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[9px] uppercase tracking-widest font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Guest Sandbox Mode
                  </div>
                  <h4 className="text-white text-sm font-semibold tracking-tight">Protect Your Progress</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Don't lose your completed routines and future history. Secure your temporary focus workspace and keep your statistics completely intact across devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSecureModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold uppercase tracking-wider rounded transition-all shrink-0 cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.2)] hover:scale-[1.02]"
                >
                  Secure Progress
                </button>
              </motion.div>
            )}

            {/* Responsive Launchpad Grid - Side-by-Side on desktop, stacked & ultra-compact on mobile */}
            <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
              
              {/* Left Column: Task Input and past flow states */}
              <div className="space-y-4">
                {/* Prompt Header - Modern, aligned, solid */}
                <div className="space-y-3 sm:space-y-4 text-left bg-[#121212] border border-[#2A2A2A] rounded p-5 sm:p-6 md:p-8 relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Active Workspace</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                    What is your immediate priority?
                  </h2>
                  <p className="text-zinc-500 font-sans text-xs leading-relaxed">
                    Breaking a task down is the easiest way to start. Tell us what you want to do, and we will help you take the first tiny step.
                  </p>

                  {/* Main Task Input */}
                  <div className="relative pt-1">
                    <input
                      type="text"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && taskName.trim()) {
                          setFocusState("tiny_step");
                        }
                      }}
                      placeholder="e.g. Draft presentation deck, Audit database logs"
                      id="vague-goal-input"
                      className="w-full h-11 px-4 rounded premium-input outline-none text-white placeholder-[#666666] text-xs sm:text-sm transition-all focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                {/* Suggestion Chips */}
                {frequentTasks.length > 0 && (
                  <div className="pt-2 sm:pt-4 border-t border-[#2A2A2A] flex flex-col gap-1.5 sm:gap-2 text-left">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block text-center sm:text-left">
                      {userSessions.length > 0 ? "Your Past Flow States" : "Quick Start Presets"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {frequentTasks.slice(0, 4).map(task => (
                        <button
                          key={task}
                          type="button"
                          onClick={() => {
                            setTaskName(task);
                            // Pre-fill micro-step smart defaults based on selected preset
                            if (task === "Draft weekly planner & goals") {
                              setTinyStep("List my top 3 highest priority objectives for this week");
                            } else if (task === "Outline project proposal") {
                              setTinyStep("Draft the introductory paragraph and core value proposition");
                            } else if (task === "Review & reply to critical emails") {
                              setTinyStep("Clear the top 5 urgent items in my inbox");
                            } else if (task === "Brainstorm creative content ideas") {
                              setTinyStep("Scribble down 5 raw concepts without filtering");
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-[#1C1C1E] border border-[#2A2A2A] hover:bg-[#252529] hover:border-[#444444] text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer truncate max-w-full"
                        >
                          {task}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Session Configuration and Launch Controls */}
              <div className="space-y-4">
                {/* Session Setup Controls Panel - Modern and aligned */}
                <div className="space-y-4 sm:space-y-5 bg-[#121212] border border-[#2A2A2A] rounded p-5 sm:p-6 text-left relative z-20">
                  
                  {/* Mode Selector Segmented Track */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">Focus Format</span>
                    <div className="flex bg-black border border-[#2A2A2A] rounded p-1 gap-1 w-full">
                      <button 
                        type="button"
                        onClick={() => setSessionMode("single")}
                        className={`flex-1 py-2 text-xs font-semibold rounded uppercase tracking-wider transition-all cursor-pointer ${
                          sessionMode === "single" 
                            ? "bg-white text-black font-bold shadow-md" 
                            : "bg-transparent text-zinc-500 hover:text-white"
                        }`}
                      >
                        Single Focus Block
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSessionMode("interval")}
                        className={`flex-1 py-2 text-xs font-semibold rounded uppercase tracking-wider transition-all cursor-pointer ${
                          sessionMode === "interval" 
                            ? "bg-white text-black font-bold shadow-md" 
                            : "bg-transparent text-zinc-500 hover:text-white"
                        }`}
                      >
                        Interval Blocks
                      </button>
                    </div>
                  </div>

                  {/* Session Length Controls with modern buttons up and down */}
                  <div className="space-y-3 pt-1 border-t border-[#2A2A2A]">
                    <div className="flex flex-row items-center justify-between gap-3 bg-black border border-[#2A2A2A] rounded p-3 transition-all hover:border-[#3A3A3A]">
                      <div className="space-y-0.5 text-left">
                        <span className="text-[10px] sm:text-xs font-semibold font-mono text-zinc-300 tracking-wider uppercase font-bold">Focus Duration</span>
                        <p className="text-[9px] text-zinc-500 font-sans hidden sm:block">
                          Customize interval length.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Unit Segmented Toggle */}
                        <div className="flex items-center gap-1 bg-black border border-[#2A2A2A] rounded p-0.5 text-[8px] sm:text-[9px] font-mono">
                          <button
                            type="button"
                            onClick={() => handleUnitChange("min")}
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer font-bold ${
                              timeUnit === "min" 
                                ? "bg-white text-black" 
                                : "text-zinc-500 hover:text-white"
                            }`}
                          >
                            MIN
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnitChange("hrs")}
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer font-bold ${
                              timeUnit === "hrs" 
                                ? "bg-white text-black" 
                                : "text-zinc-500 hover:text-white"
                            }`}
                          >
                            HRS
                          </button>
                        </div>

                        {/* Micro Numeric Up/Down Controls with Modern Up and Down buttons */}
                        <div className="flex items-center bg-black border border-[#2A2A2A] rounded overflow-hidden h-8 sm:h-9">
                          <input 
                            id="session-length-input"
                            type="number" 
                            step={timeUnit === "min" ? "5" : "0.5"}
                            value={inputValue}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              setInputValue(valStr);
                              
                              if (valStr === "") {
                                setSessionMinutes("");
                              } else {
                                const numericVal = parseFloat(valStr);
                                if (!isNaN(numericVal)) {
                                  if (timeUnit === "min") {
                                    const mins = Math.round(numericVal);
                                    setSessionMinutes(mins);
                                    setTimeRemaining(mins * 60);
                                  } else {
                                    const mins = Math.round(numericVal * 60);
                                    setSessionMinutes(mins);
                                    setTimeRemaining(mins * 60);
                                  }
                                }
                              }
                            }}
                            className="w-12 sm:w-14 bg-transparent text-white text-xs sm:text-sm font-bold font-mono px-2 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={timeUnit === "min" ? "1" : "0.02"}
                            max={timeUnit === "min" ? "300" : "5.0"}
                          />
                          <div className="flex flex-col border-l border-[#2A2A2A] h-full divide-y divide-[#2A2A2A] w-6 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAdjustSessionLength("up")}
                              className="flex-1 hover:bg-[#1A1A1A] text-zinc-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustSessionLength("down")}
                              className="flex-1 hover:bg-[#1A1A1A] text-zinc-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Slider and unit limits */}
                    <div className="bg-black border border-[#2A2A2A] rounded p-3">
                      {timeUnit === "min" ? (
                        <input
                          type="range"
                          min="1"
                          max="120"
                          step="1"
                          value={sessionMinutes === "" ? 25 : (sessionMinutes <= 120 ? sessionMinutes : 120)}
                          onChange={(e) => {
                            const mins = parseInt(e.target.value);
                            setSessionMinutes(mins);
                            setTimeRemaining(mins * 60);
                          }}
                          className={`w-full cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none mt-1 ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                        />
                      ) : (
                        <input
                          type="range"
                          min="0.1"
                          max="5.0"
                          step="0.1"
                          value={sessionMinutes === "" ? 0.4 : Math.min(5.0, Math.round((sessionMinutes / 60) * 10) / 10)}
                          onChange={(e) => {
                            const hrs = parseFloat(e.target.value);
                            const mins = Math.round(hrs * 60);
                            setSessionMinutes(mins);
                            setTimeRemaining(mins * 60);
                          }}
                          className={`w-full cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none mt-1 ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                        />
                      )}

                      {timeUnit === "min" ? (
                        <div className="flex justify-between text-[8px] font-mono text-zinc-500 mt-1.5 lowercase">
                          <span>1m (micro)</span>
                          <span>25m (steady)</span>
                          <span>60m (deep)</span>
                          <span>120m (limit)</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[8px] font-mono text-zinc-500 mt-1.5 lowercase">
                          <span>0.1h (micro)</span>
                          <span>0.5h (steady)</span>
                          <span>1.0h (deep)</span>
                          <span>5.0h (limit)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interval configuration (if enabled) */}
                  <AnimatePresence initial={false}>
                    {sessionMode === "interval" && (
                      <motion.div
                        key="interval-config-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2A2A2A] text-left bg-black border border-[#2A2A2A] rounded p-3">
                          <div>
                            <label className="text-[9px] font-mono text-zinc-400 tracking-wider block mb-0.5 uppercase font-bold"># Cycles</label>
                            <input 
                              type="number" 
                              value={intervalCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setIntervalCount(isNaN(val) ? "" : val);
                              }}
                              className="w-full bg-black border border-[#2A2A2A] text-white text-xs rounded px-2 py-1 outline-none font-mono"
                              min="1"
                              max="20"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-zinc-400 tracking-wider block mb-0.5 uppercase font-bold">Break Ratio</label>
                            <div className="relative flex items-center">
                              <input 
                                type="number" 
                                value={breakMinutes}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setBreakMinutes(isNaN(val) ? "" : val);
                                }}
                                className="w-full bg-black border border-[#2A2A2A] text-white text-xs rounded px-2 py-1 pr-8 outline-none font-mono"
                                min="1"
                                max="60"
                              />
                              <span className="absolute right-2 text-[9px] text-zinc-500 font-mono">min</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Project Assignment Section */}
                  <div className="border-t border-[#2A2A2A] pt-2 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowProjectSection(!showProjectSection)}
                      className="w-full flex items-center justify-between py-2.5 px-3 rounded bg-black border border-[#2A2A2A] hover:bg-[#1C1C1C] transition-colors text-[9px] font-mono uppercase tracking-wider text-zinc-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-zinc-400" />
                        {selectedProjectId ? (
                          <>
                            Project: <span className="text-white font-sans font-bold normal-case text-xs">
                              {projects.find(p => p.id === selectedProjectId)?.name || "Selected"}
                            </span>
                          </>
                        ) : (
                          "No Project Assigned"
                        )}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-bold flex items-center gap-0.5">
                        {showProjectSection ? "Hide Options ▲" : "Assign to Project ▼"}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {showProjectSection && (
                        <motion.div
                          key="project-section-panel"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1 border border-[#2A2A2A] bg-black p-3 rounded">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-wider block">Select Project:</span>
                              <button
                                type="button"
                                onClick={() => setIsCreatingProj(!isCreatingProj)}
                                className="text-[8px] font-mono text-zinc-400 hover:text-white flex items-center gap-0.5 transition-colors uppercase tracking-wider cursor-pointer font-bold"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                New Project
                              </button>
                            </div>

                            <AnimatePresence initial={false}>
                              {isCreatingProj && (
                                <motion.div
                                  key="new-project-panel"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-2.5 bg-zinc-950 border border-[#2A2A2A] rounded space-y-2 text-left mb-2">
                                    <div>
                                      <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-0.5">Project Name</label>
                                      <input 
                                        type="text" 
                                        value={newProjName}
                                        onChange={(e) => setNewProjName(e.target.value)}
                                        placeholder="e.g. Side Hustle, Writing Drafts"
                                        className="w-full h-7 px-2 rounded bg-black border border-[#2A2A2A] text-white text-[11px] outline-none focus:border-white transition-colors"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-0.5">Color Accent</label>
                                      <div className="flex gap-1.5">
                                        {["#FFFFFF", "#A1A1AA", "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6"].map(c => (
                                          <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewProjColor(c)}
                                            className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${newProjColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                            style={{ backgroundColor: c }}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex gap-1.5 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!newProjName.trim()) return;
                                          setIsCreatingProjLoading(true);
                                          try {
                                            await onCreateProject(newProjName.trim(), newProjColor);
                                            setNewProjName("");
                                            setIsCreatingProj(false);
                                          } catch (err) {
                                            console.error(err);
                                          } finally {
                                            setIsCreatingProjLoading(false);
                                          }
                                        }}
                                        disabled={!newProjName.trim() || isCreatingProjLoading}
                                        className="flex-1 py-1 bg-white text-black text-[9px] font-mono uppercase rounded font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                      >
                                        {isCreatingProjLoading ? "Saving..." : "Save Project"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsCreatingProj(false);
                                          setNewProjName("");
                                        }}
                                        className="px-2 py-1 bg-transparent hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-[9px] font-mono uppercase rounded transition-colors cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                              <button
                                type="button"
                                onClick={() => setSelectedProjectId(null)}
                                className={`px-2 py-1 text-[9px] font-mono rounded border transition-all cursor-pointer flex items-center gap-1 ${
                                  selectedProjectId === null
                                    ? "bg-white border-white text-black font-bold"
                                    : "bg-transparent border-[#2A2A2A] text-zinc-500 hover:text-zinc-350"
                                }`}
                              >
                                <Tag className="w-2 h-2 shrink-0" />
                                Projectless
                              </button>

                              {projects.map(proj => (
                                <button
                                  key={proj.id}
                                  type="button"
                                  onClick={() => setSelectedProjectId(proj.id)}
                                  className={`px-2 py-1 text-[9px] font-mono rounded border transition-all cursor-pointer flex items-center gap-1 ${
                                    selectedProjectId === proj.id
                                      ? "bg-white border-white text-black font-bold"
                                      : "bg-[#121212] border-[#2A2A2A] text-zinc-400 hover:text-white"
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: proj.color }} />
                                  {proj.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Start Trigger CTA */}
                  <div className="pt-1 select-none">
                    <button
                      disabled={!taskName.trim()}
                      onClick={() => setFocusState("tiny_step")}
                      id="direct-tiny-step-btn"
                      className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-semibold rounded tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm shadow-lg hover:shadow-xl active:scale-[0.99]"
                    >
                      Take a Deep Breath
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TINY STEP DEFINITIONS STATE */}
        {focusState === "tiny_step" && (
          <motion.div
            key="tiny_step"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6 w-full max-w-xl mx-auto"
          >
            <div className="space-y-2 text-left bg-[#121212]/80 backdrop-blur-md pt-12 pb-3 pr-4 pl-8 border border-[#2A2A2A]/80 rotate-[-2deg] mb-4 relative z-10">
              <span className="inline-flex px-3 py-1 rounded bg-black border border-[#2A2A2A]/80 text-[9px] text-white font-mono tracking-widest uppercase mb-4 shadow-[2px_2px_0px_#2A2A2A]">
                Optimize Initiation
              </span>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-[0.85] mt-2.5">
                Setup your active flow
              </h2>
              <p className="text-[#888888] font-mono tracking-[0.1em] text-[9px] uppercase mt-4">
                Define optional starting actions and sub-tasks to organize your focus.
              </p>
            </div>

            {/* Onboarding Coachmark/Guidance banner */}
            {showOnboardingCoachmark && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded text-left space-y-3 relative overflow-hidden border ${
                  theme === 'light' 
                    ? 'bg-[#7b5677]/10 border-[#7b5677]/20 text-[#261925]' 
                    : 'bg-zinc-950/90 border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="absolute top-0 right-0 p-1">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowOnboardingCoachmark(false);
                      try {
                        localStorage.setItem("adhd_flow_onboarding_dismissed", "true");
                      } catch (e) {}
                    }}
                    className={`font-mono text-xs p-1 px-2 cursor-pointer transition-colors ${
                      theme === 'light' ? 'text-zinc-500 hover:text-[#7b5677]' : 'text-zinc-600 hover:text-white'
                    }`}
                  >
                    × Dismiss Guidance
                  </button>
                </div>
                <div className="flex gap-2.5 items-start">
                  <HelpCircle className={`w-4 h-4 mt-0.5 shrink-0 ${theme === 'light' ? 'text-[#7b5677]' : 'text-zinc-400'}`} />
                  <div className="space-y-1">
                    <span className={`text-[10px] font-mono uppercase tracking-wider block ${
                      theme === 'light' ? 'text-[#7b5677] font-bold' : 'text-zinc-400'
                    }`}>
                      Coaching: Defeating Task Paralysis
                    </span>
                    <p className={`text-xs leading-relaxed max-w-[95%] ${
                      theme === 'light' ? 'text-zinc-700' : 'text-zinc-400'
                    }`}>
                      ADHD brains experience strong avoidance and startup friction because large tasks feel ambiguous. By specifying a <strong className={theme === 'light' ? 'text-[#7b5677] font-semibold' : 'text-white'}>"First Tiny Step"</strong> that takes less than 60 seconds (like <em>"Open file"</em> or <em>"Write 1 sentence"</em>), you trick your brain past the initial paralysis. It is completely optional—you can also type customized checklist sub-steps below or jump straight into flow!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Input entry and Step Builder */}
            <div className="space-y-4 bg-black/80 backdrop-blur-md p-6 border border-[#2A2A2A]/80 rotate-[1deg] relative z-20 text-left">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="tiny-step-input" className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                    First Tiny Step: <span className="text-zinc-600 lowercase italic">(Optional starting momentum)</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={tinyStep}
                  onChange={(e) => setTinyStep(e.target.value)}
                  placeholder="e.g. Open document, Read 1 paragraph"
                  id="tiny-step-input"
                  className="w-full h-14 px-4 rounded premium-input outline-none text-white placeholder-[#666666] transition-all text-xs focus:ring-1 focus:ring-white"
                />
              </div>

              {/* Checklist Multi-step Subtasks Builder */}
              <div className="space-y-3 pt-2 border-t border-[#1F1F1F]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                    Custom Checklist Steps: <span className="text-zinc-600 lowercase italic">(Optional)</span>
                  </span>
                  <span className="text-[9px] font-mono text-zinc-600">
                    {subSteps.length} items added
                  </span>
                </div>

                {/* Subtask input bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubStepText}
                    onChange={(e) => setNewSubStepText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubStep();
                      }
                    }}
                    placeholder="Type customized checklist item..."
                    className="flex-1 h-9 px-3 rounded bg-[#121212] border border-[#2A2A2A] text-xs text-white placeholder-[#555555] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubStep}
                    className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-mono text-xs cursor-pointer flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Listed steps */}
                {subSteps.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {subSteps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between gap-2 p-2 rounded text-xs transition-colors ${
                          theme === 'light' 
                            ? 'bg-[#7b5677]/5 border border-[#7b5677]/15 text-zinc-800' 
                            : 'bg-[#121212]/45 border border-[#2A2A2A]/40 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-1.5 h-1.5 rounded-full ${theme === 'light' ? 'bg-[#7b5677]' : 'bg-zinc-600'}`} />
                          <span className="truncate font-medium">{step.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubStep(step.id)}
                          className={`transition-colors cursor-pointer ${
                            theme === 'light' 
                              ? 'text-zinc-400 hover:text-red-500' 
                              : 'text-zinc-600 hover:text-red-400'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Relocated Auditory Anchors */}
              <div className="space-y-2.5 pt-3 border-t border-[#1F1F1F]">
                <div className="flex items-center gap-1.5 justify-between">
                  <div className="flex items-center gap-1.5">
                    <Music className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-[#7b5677]' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                      Auditory Anchors (Ambient Sound)
                    </span>
                  </div>
                  {ambientSoundType !== "none" && (
                    <span className="text-[9px] font-mono text-zinc-500">
                      {Math.round(ambientVolume * 100)}% Volume
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { type: "none", name: "Silence" },
                    { type: "brown", name: "Brown" },
                    { type: "pink", name: "Pink" },
                    { type: "binaural", name: "Binaural" }
                  ].map((sound) => (
                    <button
                      key={sound.type}
                      type="button"
                      onClick={() => {
                        initAudio();
                        setAmbientSoundType(sound.type as any);
                        if (sound.type !== "none") {
                          setSavedAmbientSoundType(sound.type as any);
                        }
                      }}
                      className={`py-1 px-1.5 text-[9px] font-mono rounded border transition-colors cursor-pointer text-center truncate ${
                        ambientSoundType === sound.type
                          ? (theme === 'light' ? "bg-[#7b5677] border-[#7b5677] text-white font-semibold" : "bg-white border-white text-black font-semibold")
                          : (theme === 'light' ? "bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200" : "bg-black/40 border-[#2A2A2A] text-zinc-400 hover:text-white")
                      }`}
                    >
                      {sound.name}
                    </button>
                  ))}
                </div>

                {ambientSoundType !== "none" && (
                  <div className="pt-1">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ambientVolume}
                      onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                      className={`w-full bg-zinc-800 h-1 rounded cursor-pointer ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                    />
                  </div>
                )}
              </div>

              {/* Submits */}
              <div className="flex gap-2.5 pt-3 border-t border-[#1F1F1F]">
                <button
                  type="button"
                  onClick={handleResetToIdle}
                  className="px-5 h-14 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors text-xs font-medium cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleStartTimer}
                  id="final-start-focus-btn"
                  className="flex-1 h-14 bg-white hover:bg-[#F0F0F0] text-black rounded font-medium tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm animate-pulse"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  Begin Focus Block ({formatSessionMinutes(sessionMinutes)})
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* FOCUS SESSION MODE */}
        {(focusState === "focusing" || focusState === "paused" || focusState === "interval_break") && (
          isMinimized ? (
            <motion.div
              key="focusing-minimized-notice"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-4 py-16 w-full max-w-md mx-auto text-center"
            >
              <div className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-500 animate-pulse">
                <Minimize2 className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight uppercase">Micro Focus Active</h3>
                <p className="text-zinc-500 text-xs font-mono leading-relaxed max-w-xs mx-auto">
                  The dashboard is minimized to a floating micro-widget. Click Restore to expand.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="px-5 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 font-mono uppercase"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Restore Dashboard
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="focusing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-3 sm:space-y-6 md:space-y-9 py-1 sm:py-4 w-full"
            >
            {/* Spotlight layout Header */}
            <div className="text-center space-y-1 sm:space-y-2 max-w-[280px] sm:max-w-sm bg-[#121212]/80 backdrop-blur-md pt-3.5 sm:pt-10 pr-3 pb-2 sm:pb-3 pl-4 sm:pl-8 border border-[#2A2A2A]/80 rotate-[1.5deg] relative z-10 -mb-2 sm:-mb-4 shadow-[4px_4px_0px_rgba(0,0,0,0.4)]">
              <span className="text-[8px] sm:text-[9px] font-mono text-[#888888] uppercase tracking-[0.25em] block">Current Focus Block</span>
              <h2 className="text-sm sm:text-2xl font-black text-white line-clamp-1 sm:line-clamp-2 uppercase tracking-tighter leading-[0.85]">{taskName}</h2>
              {sessionMode === "interval" && (
                <div className="text-[9px] sm:text-[10px] font-mono text-[#666666]">
                  Cycle {currentInterval} / {intervalCount}
                </div>
              )}
              {focusState !== "interval_break" && (
                <div className="bg-black border border-[#2A2A2A]/80 py-1 sm:py-2 px-2 sm:px-3 rounded-none inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] text-[#AAAAAA] mt-0.5 sm:mt-2 font-mono rotate-[-1deg]">
                  <span className="w-1 h-1 bg-white shrink-0" />
                  <span>Step:</span>
                  <span className="text-white truncate font-sans max-w-[100px] sm:max-w-[200px]">{tinyStep}</span>
                </div>
              )}
            </div>

            {/* Timer circle visualization */}
            <div className="relative w-36 h-36 sm:w-60 sm:h-60 md:w-64 md:h-64 flex items-center justify-center bg-black/80 backdrop-blur-md border border-[#2A2A2A]/80 rotate-[-1.5deg] z-20 p-1.5">

              {/* Progress Ring */}
              <svg className="absolute w-[90%] h-[90%] transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-[#1A1A1A] fill-none"
                  strokeWidth="1"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-white fill-none transition-all duration-1000 ease-linear"
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45 * (1 - progressRatio)}
                  strokeLinecap="square"
                />
              </svg>

              {/* Central Time Indicators */}
              <div className="text-center space-y-0.5 sm:space-y-1 relative z-10 flex flex-col items-center">
                <span className="font-scale-timer tracking-tighter text-white font-mono leading-[0.85]">
                  {formatTime(timeRemaining)}
                </span>
                <span className="font-scale-tiny font-mono text-[#666666] tracking-[0.2em] uppercase pt-1 sm:pt-3">
                  {focusState === "interval_break" ? "INTERVAL BREAK" : focusState === "focusing" ? "DEEP FOCUS" : "FLOW PAUSED"}
                </span>
              </div>
            </div>

            {/* ADHD Interactive Molecular Steps Checklist */}
            {focusState !== "interval_break" && (tinyStep.trim() || subSteps.length > 0) && (
              <div className={`w-full max-w-[280px] sm:max-w-sm p-3 sm:p-4 rounded text-left space-y-2 sm:space-y-3 transition-colors ${
                theme === 'light' 
                  ? 'bg-white border border-[#d0d4d2] shadow-[2px_2px_0px_rgba(0,0,0,0.06)]' 
                  : 'bg-[#121212]/80 border border-[#2A2A2A]/80 shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
              }`}>
                <div className={`flex justify-between items-center border-b pb-1.5 sm:pb-2 ${theme === 'light' ? 'border-zinc-200/60' : 'border-[#2A2A2A]'}`}>
                  <span className="text-[8px] sm:text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
                    ADHD Molecular Checklist
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-mono ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {subSteps.filter(s => s.completed).length + (primaryCompleted ? 1 : 0)} / {subSteps.length + (tinyStep.trim() ? 1 : 0)} complete
                  </span>
                </div>

                <div className="space-y-1 sm:space-y-2 max-h-24 sm:max-h-48 overflow-y-auto pr-1">
                  {/* Primary Step */}
                  {tinyStep.trim() && (
                    <label 
                      className={`flex items-start gap-2.5 p-1.5 rounded transition-colors cursor-pointer select-none ${
                        primaryCompleted ? "opacity-50" : ""
                      } ${theme === 'light' ? 'hover:bg-zinc-100' : 'hover:bg-[#1A1A1A]/45'}`}
                    >
                      <input
                        type="checkbox"
                        checked={primaryCompleted}
                        onChange={() => {
                          const nextVal = !primaryCompleted;
                          setPrimaryCompleted(nextVal);
                          if (nextVal) {
                            playSuccessChime();
                          }
                        }}
                        className={`mt-0.5 w-4 h-4 rounded-sm border-zinc-700 bg-black text-white focus:ring-0 cursor-pointer ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                      />
                      <span className={`text-xs font-medium ${
                        theme === 'light' 
                          ? (primaryCompleted ? "line-through text-zinc-400" : "text-zinc-800") 
                          : (primaryCompleted ? "line-through text-zinc-600" : "text-white")
                      }`}>
                        {tinyStep} <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">(Primary)</span>
                      </span>
                    </label>
                  )}

                  {/* Sub Steps */}
                  {subSteps.map((step) => (
                    <label 
                      key={step.id} 
                      className={`flex items-start gap-2.5 p-1.5 rounded transition-colors cursor-pointer select-none ${
                        step.completed ? "opacity-50" : ""
                      } ${theme === 'light' ? 'hover:bg-zinc-100' : 'hover:bg-[#1A1A1A]/45'}`}
                    >
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => {
                          const nextSteps = subSteps.map((s) => {
                            if (s.id === step.id) {
                              const nextCompleted = !s.completed;
                              if (nextCompleted) {
                                playSuccessChime();
                              }
                              return { ...s, completed: nextCompleted };
                            }
                            return s;
                          });
                          setSubSteps(nextSteps);
                        }}
                        className={`mt-0.5 w-4 h-4 rounded-sm border-zinc-700 bg-black text-white focus:ring-0 cursor-pointer ${theme === 'light' ? 'accent-[#7b5677]' : 'accent-white'}`}
                      />
                      <span className={`text-xs ${
                        theme === 'light' 
                          ? (step.completed ? "line-through text-zinc-400 font-normal" : "font-medium text-zinc-800") 
                          : (step.completed ? "line-through text-zinc-600 font-normal" : "font-medium text-zinc-300")
                      }`}>
                        {step.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Add Time Area */}
            {(focusState === "focusing" || focusState === "paused") && (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="flex gap-2 items-center">
                  {!showAddTime ? (
                    <button 
                      onClick={() => setShowAddTime(true)}
                      className="text-[10px] text-[#666666] hover:text-white transition-colors uppercase tracking-widest font-mono cursor-pointer"
                    >
                      + Add Time
                    </button>
                  ) : (
                    <div className="flex gap-2 items-center bg-[#121212] border border-[#2A2A2A] rounded p-1.5">
                      <button onClick={() => handleAddTime(5)} className="px-3 py-1 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded text-[10px] text-white cursor-pointer transition-colors">5m</button>
                      <button onClick={() => handleAddTime(10)} className="px-3 py-1 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded text-[10px] text-white cursor-pointer transition-colors">10m</button>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={customAddMins} 
                          onChange={(e) => setCustomAddMins(e.target.value)}
                          placeholder="Mins" 
                          className="w-14 h-6 bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 text-[10px] text-white outline-none"
                        />
                        <button 
                          onClick={() => { if(parseInt(customAddMins)>0) handleAddTime(parseInt(customAddMins)) }} 
                          className="px-2 py-1 text-[10px] text-[#888888] hover:text-white cursor-pointer transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <button onClick={() => setShowAddTime(false)} className="px-2 py-1 text-[10px] text-[#666666] hover:text-white ml-1 cursor-pointer transition-colors">✕</button>
                    </div>
                  )}

                  <span className="text-zinc-700 font-mono text-[9px]">•</span>

                  {/* Noise Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      initAudio();
                      if (ambientSoundType === "none") {
                        setAmbientSoundType(savedAmbientSoundType || "brown");
                      } else {
                        setAmbientSoundType("none");
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-colors border cursor-pointer ${
                      ambientSoundType !== "none"
                        ? (theme === 'light' ? "bg-[#7b5677] border-[#7b5677] text-white font-semibold" : "bg-white border-white text-black font-semibold")
                        : (theme === 'light' ? "bg-transparent border-zinc-300 text-zinc-500 hover:text-zinc-850" : "bg-transparent border-[#2A2A2A] text-zinc-500 hover:text-white")
                    }`}
                  >
                    {ambientSoundType !== "none" ? (
                      <>
                        <Volume2 className="w-2.5 h-2.5 animate-pulse" />
                        <span>Noise On ({ambientSoundType})</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-2.5 h-2.5" />
                        <span>Noise Off</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Recovery / stuck options list */}
            <div className="w-full space-y-4 sm:space-y-6">
              
              {/* Core Control Group */}
              <div className="flex flex-wrap gap-1.5 xs:gap-2.5 justify-center">
                {focusState === "interval_break" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFocusState("focusing");
                      setTimeRemaining((typeof sessionMinutes === 'number' ? sessionMinutes : 25) * 60);
                      playStartSound();
                    }}
                    className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    Skip Break
                  </button>
                ) : focusState === "focusing" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePauseToggle()}
                      className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                    >
                      <Pause className="w-3.5 h-3.5 shrink-0" />
                      Pause
                    </button>
                    {sessionMode === "single" && (
                      <button
                        type="button"
                        onClick={() => setFocusState("guilt_free_break")}
                        className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                      >
                        <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
                        Take Break
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePauseToggle()}
                      className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      Resume
                    </button>
                    {sessionMode === "single" && (
                      <button
                        type="button"
                        onClick={() => setFocusState("guilt_free_break")}
                        className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                      >
                        <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
                        Take Break
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleStuckRescue()}
                  id="trigger-stuck-btn"
                  className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Signal Stuck
                </button>

                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                >
                  <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                  Minimize
                </button>

                <button
                  type="button"
                  onClick={handleCompleteSession}
                  id="mock-finish-session-btn"
                  className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-sans animate-pulse"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Conclude
                </button>
              </div>

            </div>

            {/* Translucid Note Taker Trigger and Blocker Notice */}
            <div className="w-full flex flex-col items-center gap-4 mt-2 pt-6 border-t border-zinc-500/10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNotesWidget(!showNotesWidget)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer border ${
                    showNotesWidget
                      ? (theme === 'light' ? "bg-zinc-200 border-zinc-300 text-zinc-800" : "bg-zinc-850/60 border-zinc-700 text-zinc-200")
                      : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-400 opacity-50 hover:opacity-100"
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Note Taker</span>
                </button>


              </div>

              {/* Translucent Note Taker panel (No background, translucid, very clean) */}
              <AnimatePresence>
                {showNotesWidget && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full max-w-sm border border-zinc-500/10 p-3.5 rounded text-left space-y-2.5 transition-all bg-transparent"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-500/10 pb-1.5">
                      <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wider">
                        Brain Dump / Notes
                      </span>
                      <span className="text-[8px] font-mono text-zinc-500">
                        {brainDumps.length} captured
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentBrainDump}
                        onChange={(e) => setCurrentBrainDump(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && currentBrainDump.trim()) {
                            setBrainDumps(prev => [...prev, currentBrainDump.trim()]);
                            setCurrentBrainDump("");
                            playSuccessChime();
                          }
                        }}
                        placeholder="Type sudden thought to save..."
                        className={`flex-1 h-7 px-2.5 rounded bg-transparent border text-xs outline-none transition-colors ${
                          theme === 'light'
                            ? "border-zinc-300 text-zinc-800 placeholder-zinc-400 focus:border-[#7b5677]"
                            : "border-zinc-800/40 text-zinc-200 placeholder-zinc-600 focus:border-zinc-700"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (currentBrainDump.trim()) {
                            setBrainDumps(prev => [...prev, currentBrainDump.trim()]);
                            setCurrentBrainDump("");
                            playSuccessChime();
                          }
                        }}
                        className={`h-7 px-2.5 rounded font-mono text-[9px] uppercase cursor-pointer border transition-colors ${
                          theme === 'light'
                            ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                            : "bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800/60 text-zinc-400 hover:text-white"
                        }`}
                      >
                        Dump
                      </button>
                    </div>

                    {brainDumps.length > 0 && (
                      <div className="space-y-1 mt-1 max-h-24 overflow-y-auto pr-1">
                        {brainDumps.map((dump, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between gap-2 p-1 px-1.5 border rounded text-[11px] group ${
                              theme === 'light'
                                ? "bg-zinc-50/50 border-zinc-200/50 text-zinc-600"
                                : "bg-zinc-950/20 border-zinc-900/40 text-zinc-400"
                            }`}
                          >
                            <span className="truncate">{dump}</span>
                            <button
                              type="button"
                              onClick={() => setBrainDumps(prev => prev.filter((_, i) => i !== idx))}
                              className="text-zinc-500 hover:text-red-400 cursor-pointer text-[9px] px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


          </motion.div>
        ))}

        {/* STUCK RESCUE STATE */}
        {focusState === "stuck_rescue" && (
          <motion.div
            key="stuck_rescue"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 w-full max-w-xl mx-auto"
          >
            <div className="space-y-1.5 block text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#2A2A2A] text-[9px] text-[#888888] font-mono uppercase">
                <AlertTriangle className="w-3 h-3" />
                Intervention
              </div>
              <h2 className="text-2xl font-sans font-medium text-white mt-1">
                Let's lower the pressure.
              </h2>
              <p className="text-[#666666] text-sm">
                FocusOn is recovery-first. Feeling overwhelmed or lost is normal. Here are guilt-free ways to recover:
              </p>
            </div>

            <div className="space-y-5">
              {/* Grounding Exercise banner */}
              <div className="bg-[#121212] border border-[#2A2A2A] rounded p-4 flex gap-3 items-start">
                <div className="w-6 h-6 rounded bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3 h-3 text-[#AAAAAA]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#888888] tracking-wider block uppercase">GROUNDING MINUTE</span>
                  <p className="text-[#CCCCCC] text-xs mt-1 leading-relaxed">Exhale fully, let your shoulders drop, and take one slow breath in.</p>
                </div>
              </div>

              {/* Pathways */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#666666] uppercase block text-center sm:text-left">Select recovery mode:</span>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setGuiltFreeRemaining(5 * 60);
                      setFocusState("guilt_free_break");
                    }}
                    className="w-full text-left p-4 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] text-xs text-white transition-colors flex items-center gap-3.5 cursor-pointer"
                  >
                    <HeartHandshake className="w-5 h-5 text-[#888888] shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Rest</span>
                      <span className="text-zinc-500 text-[11px] mt-0.5">Take a short break to clear your head.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTinyStep("Find an entirely different approach");
                      setFocusState("focusing");
                    }}
                    className="w-full text-left p-4 rounded-xl glass-panel glass-panel-hover text-xs text-zinc-200 transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.982]"
                  >
                    <Search className="w-5 h-5 text-zinc-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Change your approach</span>
                      <span className="text-zinc-500 text-[11px] mt-0.5">Ask questions, research, or try a new angle.</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleResetToIdle()}
                    className="w-full text-left p-4 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] text-xs text-white transition-colors flex items-center gap-3.5 cursor-pointer"
                  >
                    <RefreshCw className="w-5 h-5 text-[#888888] shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Pivot to something else</span>
                      <span className="text-[#666666] text-[11px] mt-0.5">Start fresh on a different task.</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Additional custom problem text bar */}
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setFocusState("focusing")}
                  className="flex-1 py-3 bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#2A2A2A] rounded text-xs font-medium text-white cursor-pointer"
                >
                  Keep working as-is
                </button>
                <button
                  onClick={() => handleResetToIdle()}
                  className="flex-1 py-3 bg-transparent hover:bg-[#121212] border border-[#2A2A2A] rounded text-[#888888] text-xs font-medium cursor-pointer text-center"
                >
                  Hard Reset
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* COMPASSIONATE DISTRACTION / CHECK-IN STATE */}
        {focusState === "distracted" && (
          <motion.div
            key="distracted"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-1 block text-center sm:text-left">
              <span className="inline-flex px-2.5 py-1 rounded border border-[#2A2A2A] text-[9px] text-[#888888] font-mono tracking-wider uppercase">
                ATTENTION SHIFT
              </span>
              <h2 className="text-2xl font-sans font-medium text-white tracking-tight mt-2">
                No judgment. Just checking in.
              </h2>
              <p className="text-[#666666] text-sm">
                Attention drifts naturally. Let's decide with clear intention what to do next.
              </p>
            </div>

            <div className="space-y-5">
              {/* Gentle routing pathways */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#666666] uppercase block text-center sm:text-left">Select your intent:</span>
                <div className="space-y-2">
                  <button
                    onClick={() => handleResolveDistraction("learning")}
                    className="w-full text-left p-4 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] transition-colors flex items-center gap-3.5 cursor-pointer"
                  >
                    <BookOpen className="w-5 h-5 text-[#888888] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">I found something else</p>
                      <p className="text-[11px] text-[#666666] mt-0.5">Follow this new direction instead.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleResolveDistraction("break")}
                    className="w-full text-left p-4 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] transition-colors flex items-center gap-3.5 cursor-pointer"
                  >
                    <HeartHandshake className="w-5 h-5 text-[#888888] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">I need a break</p>
                      <p className="text-[11px] text-[#666666] mt-0.5">Pause to recharge before returning.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleResolveDistraction("resume")}
                    className="w-full text-left p-4 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] transition-colors flex items-center gap-3.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#888888] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-white">Guide me back to work</p>
                      <p className="text-[11px] text-[#666666] mt-0.5">I want to gently resume my previous task.</p>
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* GUILT FREE BREAK MODE */}
        {focusState === "guilt_free_break" && (
          <motion.div
            key="guilt_free_break"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 md:space-y-10 py-2 sm:py-6"
          >
            <div className="text-center space-y-1.5 sm:space-y-2 max-w-sm bg-[#121212]/80 backdrop-blur-md pt-6 sm:pt-10 pr-4 pb-2.5 sm:pb-3 pl-6 sm:pl-8 border border-[#2A2A2A]/80 rotate-[2deg] relative z-10 -mb-3 sm:-mb-4 shadow-[4px_4px_0px_rgba(0,0,0,0.4)]">
              <h3 className="text-[9px] font-mono text-[#888888] uppercase tracking-[0.25em] block">Rest Window</h3>
              <h2 className="text-xl sm:text-2xl font-black text-white line-clamp-1 uppercase tracking-tighter leading-[0.85]">Resting Mindscape</h2>
              <p className="text-[9px] text-[#666666] font-mono tracking-[0.1em] uppercase mt-2">
                Active flow paused. Protect your space, take a breath, or look away from the screens.
              </p>
            </div>

            {/* Timer circle visualization */}
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-64 md:h-64 flex items-center justify-center bg-black/80 backdrop-blur-md border border-[#2A2A2A]/80 rotate-[-1deg] z-20 p-2">
              {/* Progress Circle SVG */}
              {sessionMode !== "single" && (
                <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="stroke-[#1A1A1A] fill-none"
                    strokeWidth="1"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="stroke-white fill-none transition-all duration-1000 ease-linear"
                    strokeWidth="2"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - (guiltFreeRemaining / (5 * 60)))}
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Central Time Indicators */}
              <div className="text-center space-y-1 relative z-10 flex flex-col items-center">
                {sessionMode !== "single" ? (
                  <span className="font-scale-timer text-white tracking-tight font-mono">
                    {formatTime(guiltFreeRemaining)}
                  </span>
                ) : (
                  <span className="text-lg sm:text-xl font-sans font-medium text-[#888888]">
                    Paused
                  </span>
                )}
              </div>
            </div>

            <div className="w-full flex gap-3 justify-center">
              <button
                onClick={() => {
                  setFocusState("focusing");
                }}
                className="flex-1 max-w-[180px] h-10 sm:h-12 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                Return to Focus
              </button>
            </div>
          </motion.div>
        )}

        {/* REFLECTING INPUT STATE */}
        {focusState === "reflecting" && (
          <motion.div
            key="reflecting"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 w-full max-w-xl mx-auto"
          >
            <div className="space-y-2 block text-left bg-[#121212]/80 backdrop-blur-md pt-12 pr-4 pb-3 pl-8 border border-[#2A2A2A]/80 rotate-[-1.5deg] relative z-10 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border border-[#2A2A2A]/80 text-[9px] text-white font-mono tracking-widest uppercase mb-4 shadow-[2px_2px_0px_#2A2A2A]">
                FOCUS BLOCK CELEBRATION
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-[0.85] mt-2">
                Nicely done. What progress occurred?
              </h2>
              <p className="text-[#888888] font-mono tracking-[0.1em] text-[9px] uppercase mt-4">
                No matter how small, noting it signals completion to your brain.
              </p>
            </div>

            <div className="space-y-5 bg-black/80 backdrop-blur-md p-6 border border-[#2A2A2A]/80 rotate-[1deg] relative z-20">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#888888] block tracking-wider uppercase">Focus Accomplishments (Optional)</label>
                <textarea
                  value={completedNotes}
                  onChange={(e) => setCompletedNotes(e.target.value)}
                  disabled={isSaving}
                  placeholder="What did you get done?"
                  id="reflection-completed-input"
                  className="w-full h-16 p-3 rounded premium-input outline-none text-white placeholder-[#666666] text-xs disabled:opacity-50 resize-none font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-mono text-[#666666] block tracking-wider uppercase">Next Step for next time (Optional)</label>
                <input
                  type="text"
                  value={nextStepCaptured}
                  onChange={(e) => setNextStepCaptured(e.target.value)}
                  disabled={isSaving}
                  placeholder="e.g. Read page 6"
                  className="w-full h-8 px-2 rounded outline-none text-[#888888] placeholder-[#444444] text-[10px] disabled:opacity-50 font-sans bg-[#0A0A0A] border border-[#1A1A1A]"
                />
              </div>

              <button
                disabled={isSaving}
                onClick={handleSaveReflection}
                id="save-reflection-btn"
                className="w-full h-12 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:bg-[#333333] disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                    Preserving Progress...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Lock in Progress
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* REFLECTED OUTPUT SUMMARY STATE */}
        {focusState === "reflected" && (
          <motion.div
            key="reflected"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#121212] border border-[#2A2A2A] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-medium text-white tracking-tight">Progress Preserved</h2>
              <p className="text-[#666666] text-xs sm:text-sm font-sans max-w-sm mx-auto leading-relaxed">
                Your future self will thank you. The session data is securely logged.
              </p>
            </div>

            {/* Contrast & Momentum Report Card */}
            <div className="max-w-md mx-auto bg-zinc-950 border border-zinc-900 rounded-xl p-5 text-left space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider font-bold">Contrast & Momentum Report</span>
              </div>
              
              <div className="space-y-3">
                {/* Contrast Aspect */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Before vs After (Contrast Effect)</h4>
                    <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                      You started with <span className="text-zinc-400 font-semibold italic">0% progress</span> and task-avoidance friction. By slicing the project into a micro-step, you successfully locked in <span className="text-white font-bold">100% of your objective</span>.
                    </p>
                  </div>
                </div>

                {/* Cognitive Time Saved Aspect */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3 h-3 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Time Saved (Workspace Efficiency)</h4>
                    <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                      Slicing <span className="text-zinc-400">"{taskName || "your task"}"</span> into a micro-step bypasses limbic procrastination, saving you approximately <span className="text-emerald-400 font-bold">15 to 20 minutes</span> of manual focus struggles.
                    </p>
                  </div>
                </div>

                {/* Progress Momentum Aspect */}
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Flame className="w-3 h-3 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Weekly Flow Momentum</h4>
                    <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                      This session contributes to your weekly routine. Maintain this progress momentum to effortlessly complete your 150-minute allocation!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Brain Dump Review Section */}
            {brainDumps.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#121212]/90 border border-zinc-800 p-4 rounded text-left space-y-3 max-w-sm mx-auto"
              >
                <div className="flex justify-between items-center border-b border-[#2A2A2A] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Notebook className="w-3.5 h-3.5 text-zinc-300" />
                    <span className="text-[10px] font-mono uppercase text-zinc-300 tracking-wider">
                      Your Scratchpad Thought Dumps
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const text = brainDumps.join("\n");
                      try {
                        navigator.clipboard.writeText(text);
                      } catch (e) {}
                    }}
                    className="text-[9px] font-mono text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Copy All
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Here are the distracting thoughts you safely parked during your session. You can copy them or review them now!
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {brainDumps.map((dump, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-1.5 bg-black/40 border border-zinc-900 rounded text-xs text-zinc-300 font-sans">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                      <span className="truncate flex-1">{dump}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <button
              onClick={handleResetToIdle}
              id="return-to-dash-btn"
              className="w-full h-14 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 mt-6"
            >
              Start New Focus Space
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Passing floating notification for 5s */}
      <AnimatePresence>
        {showMomentumNotification && lastSession && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100vw-32px)] sm:w-96 p-4 rounded bg-[#121212] border border-[#2A2A2A] shadow-2xl flex items-center justify-between gap-3 overflow-hidden text-left"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center shrink-0 mt-0.5">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-[9px] font-mono text-[#888888] uppercase tracking-widest">RESUMABLE FLOW</h4>
                <p className="text-white text-xs mt-0.5 line-clamp-1">Step: {lastSession.nextStepSuggested}</p>
                <p className="text-[#666666] text-[10px] mt-0.5 truncate">Project: {lastSession.taskName}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0 text-right">
              <button
                onClick={() => {
                  handleResumeLastSession();
                  setShowMomentumNotification(false);
                }}
                className="px-3 py-1.5 bg-white hover:bg-[#F0F0F0] text-black text-[11px] font-medium rounded transition-colors cursor-pointer"
              >
                Resume
              </button>
              <button
                onClick={() => setShowMomentumNotification(false)}
                className="text-[9px] text-[#666666] hover:text-[#AAAAAA] font-mono transition-colors text-center cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            {/* Elegant horizontal drain bar */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="absolute bottom-0 left-0 h-0.5 bg-zinc-400/40 rounded-b-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized Float Timer Window */}
      <AnimatePresence>
        {isMinimized && ["focusing", "paused", "interval_break", "guilt_free_break"].includes(focusState) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              left: `${minimizedPosition.x}px`,
              top: `${minimizedPosition.y}px`,
              width: `${minimizedSize.width}px`,
              height: `${minimizedSize.height}px`,
              minWidth: "250px",
              minHeight: "185px",
            }}
            className="fixed z-[9999] bg-[#0A0A0B] border-2 border-zinc-850 text-white shadow-[0_15px_50px_rgba(0,0,0,0.85)] rounded-lg overflow-hidden flex flex-col select-none"
          >
            {/* Header / Title Bar - acts as DRAG HANDLE */}
            <div
              onMouseDown={handleDragMouseDown}
              onTouchStart={handleDragMouseDown}
              className="px-3 py-1.5 bg-[#121214] border-b border-zinc-900 flex items-center justify-between cursor-move shrink-0 text-zinc-400 active:cursor-grabbing hover:bg-[#151518] transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                <div className={`w-1.5 h-1.5 rounded-full ${focusState === "paused" ? "bg-amber-500 animate-pulse" : focusState === "interval_break" || focusState === "guilt_free_break" ? "bg-emerald-400" : "bg-white animate-pulse"}`} />
                <span className="text-[10px] font-mono uppercase tracking-wider truncate max-w-[120px]">
                  {taskName || "Focus Session"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMinimized(false)}
                  title="Restore main window"
                  className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800/60 rounded cursor-pointer transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-2.5 flex flex-col justify-between min-h-0 bg-[#070708]">
              {/* Timer Block */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-900/40 pb-2 shrink-0">
                <div className="flex flex-col text-left">
                  <span className="text-[20px] font-mono leading-none tracking-tight font-black text-white">
                    {formatTime(focusState === "guilt_free_break" ? guiltFreeRemaining : timeRemaining)}
                  </span>
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                    {focusState === "interval_break" ? "INTERVAL BREAK" : focusState === "guilt_free_break" ? "GUILT-FREE BREAK" : focusState === "focusing" ? "DEEP FOCUS" : "FLOW PAUSED"}
                  </span>
                </div>

                {/* Micro Control Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handlePauseToggle}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded cursor-pointer transition-colors flex items-center justify-center"
                    title={focusState === "paused" ? "Resume" : "Pause"}
                  >
                    {focusState === "paused" ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-zinc-350" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteSession}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded cursor-pointer transition-colors flex items-center justify-center"
                    title="Conclude block"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>

              {/* Responsive Quick Note Creator (The "Brain Dump") */}
              <div className="flex-1 flex flex-col justify-end mt-2 min-h-0 overflow-hidden">
                <div className="flex gap-1.5 items-center bg-[#111113] border border-zinc-900/50 rounded px-1.5 py-1">
                  <input
                    type="text"
                    value={minimizedNoteText}
                    onChange={(e) => setMinimizedNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && minimizedNoteText.trim()) {
                        setBrainDumps(prev => [...prev, minimizedNoteText.trim()]);
                        setMinimizedNoteText("");
                        playSuccessChime();
                      }
                    }}
                    placeholder="Type distraction or note..."
                    className="flex-1 bg-transparent text-[11px] outline-none text-zinc-200 placeholder-zinc-650 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (minimizedNoteText.trim()) {
                        setBrainDumps(prev => [...prev, minimizedNoteText.trim()]);
                        setMinimizedNoteText("");
                        playSuccessChime();
                      }
                    }}
                    className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-[9px] uppercase font-mono tracking-wider rounded text-zinc-300 cursor-pointer shrink-0 transition-colors"
                  >
                    Save
                  </button>
                </div>

                {/* Subtitle indicators */}
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-600 mt-1.5 leading-none shrink-0">
                  <span className="truncate max-w-[140px]">
                    Step: {tinyStep || "Active Focus"}
                  </span>
                  <span>
                    {brainDumps.length} notes captured
                  </span>
                </div>
              </div>
            </div>

            {/* Drag Handle in corner for Resize */}
            <div
              onMouseDown={handleResizeMouseDown}
              onTouchStart={handleResizeMouseDown}
              style={{ cursor: "se-resize" }}
              className="absolute bottom-0 right-0 w-3.5 h-3.5 flex items-end justify-end p-0.5 group active:cursor-se-grabbing z-50 select-none"
            >
              <svg className="w-2 h-2 text-zinc-700 group-hover:text-zinc-400 transition-colors" viewBox="0 0 6 6" fill="currentColor">
                <path d="M6 6H0V4.5H4.5V0H6V6Z" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SecureProgressModal 
        isOpen={isSecureModalOpen} 
        onClose={() => setIsSecureModalOpen(false)} 
      />
    </div>
  );
}
