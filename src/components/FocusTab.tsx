import React, { useState, useEffect, useRef } from "react";
import { UserProfile, FocusSession } from "../types";
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
  AlertTriangle,
  CornerDownRight,
  RefreshCw,
  Search
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

interface FocusTabProps {
  user: any;
  profile: UserProfile;
  lastSession: FocusSession | null;
  userSessions: FocusSession[];
  onSessionSave: (session: Omit<FocusSession, "id">) => Promise<void>;
}

type FocusState = "idle" | "tiny_step" | "focusing" | "paused" | "stuck_rescue" | "distracted" | "interval_break" | "guilt_free_break" | "reflecting" | "reflected";
type SessionMode = "single" | "interval";

export default function FocusTab({ user, profile, lastSession, userSessions, onSessionSave }: FocusTabProps) {
  // Core Focus states
  const [focusState, setFocusState] = useState<FocusState>("idle");
  const [sessionMode, setSessionMode] = useState<SessionMode>("single");
  const [taskName, setTaskName] = useState("");
  const [tinyStep, setTinyStep] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState<number | "">(profile.adhdMode ? 20 : 25);
  const [timeRemaining, setTimeRemaining] = useState((profile.adhdMode ? 20 : 25) * 60);

  // Interval states
  const [intervalCount, setIntervalCount] = useState<number | "">(4);
  const [currentInterval, setCurrentInterval] = useState(1);
  const [breakMinutes, setBreakMinutes] = useState<number | "">(5);
  const [accumulatedFocusSeconds, setAccumulatedFocusSeconds] = useState(0);
  
  // Reflection states
  const [completedNotes, setCompletedNotes] = useState("");
  const [nextStepCaptured, setNextStepCaptured] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMomentumNotification, setShowMomentumNotification] = useState(false);
  const [guiltFreeRemaining, setGuiltFreeRemaining] = useState(5 * 60);

  // Counters to persist in the session
  const [stuckCount, setStuckCount] = useState(0);
  const [distractionCount, setDistractionCount] = useState(0);
  const [apparentActivity, setApparentActivity] = useState("");

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger 5s banner upon landing on Idle with a fresh/non-resumed last session nextStep
  useEffect(() => {
    if (focusState === "idle" && lastSession?.nextStepSuggested) {
      setShowMomentumNotification(true);
      const timer = setTimeout(() => {
        setShowMomentumNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowMomentumNotification(false);
    }
  }, [focusState, lastSession?.id, lastSession?.nextStepSuggested]);

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
    if (focusState === "focusing") {
      setFocusState("paused");
      playEndSound();
    } else if (focusState === "paused") {
      setFocusState("focusing");
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
            setGuiltFreeRemaining((prev) => {
              if (prev - delta <= 0) {
                workerRef.current?.postMessage('stop');
                handleGuiltFreeZero();
                return 0;
              }
              return prev - delta;
            });
          } else {
            setTimeRemaining((prev) => {
              if (prev - delta <= 0) {
                workerRef.current?.postMessage('stop');
                handleTimerZero();
                return 0;
              }
              return prev - delta;
            });
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
    const min = sessionMinutes || 25;
    const elapsedNow = (focusState === "focusing" || focusState === "paused") ? (min * 60 - timeRemaining) : 0;
    setAccumulatedFocusSeconds(prev => prev + elapsedNow);
    setNextStepCaptured("");
    playEndSound();
    setFocusState("reflecting");
  };

  // Submit focus session reflection
  const handleSaveReflection = async () => {
    setIsSaving(true);
    try {
      const min = sessionMinutes || 25;
      const count = intervalCount || 1;
      // Save to Firebase
      await onSessionSave({
        userId: user?.uid || "guest",
        taskName,
        tinyStep,
        originalDurationMinutes: sessionMode === "interval" ? min * count : min,
        actualDurationSeconds: accumulatedFocusSeconds > 0 ? accumulatedFocusSeconds : min * 60,
        completed: true,
        status: "completed",
        createdAt: new Date().toISOString(),
        dateStr: new Date().toISOString().split("T")[0],
        reflectionNotes: completedNotes || "No notes",
        nextStepSuggested: nextStepCaptured || "Resume working from where you left off",
        stuckCount,
        distractionCheckInCount: distractionCount,
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
    setStuckCount(0);
    setDistractionCount(0);
    setAccumulatedFocusSeconds(0);
    setFocusState("idle");
  };

  // Circular timer calculation
  const min = sessionMinutes || 25;
  const bMin = breakMinutes || 5;
  const totalDurationSeconds = focusState === "interval_break" ? (bMin * 60) : (min * 60);
  const progressRatio = timeRemaining / totalDurationSeconds;

  // Compute frequently repeated tasks for suggestions
  const frequentTasks = React.useMemo(() => {
    const counts = userSessions.reduce((acc, s) => {
      acc[s.taskName] = (acc[s.taskName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 3); // top 3 suggestions
  }, [userSessions]);

  return (
    <div className="w-full max-w-md mx-auto py-4 px-1 flex flex-col justify-center min-h-[70vh] animate-fade-in" id="focus-tab-viewport">
      <AnimatePresence mode="wait">
        
        {/* IDLE STATE: Launch focus */}
        {focusState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-7"
          >
            {/* Prompt Header */}
            <div className="space-y-1.5 text-center sm:text-left">
              <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
                What are you working on?
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm">
                Name your immediate priority. We will filter out the noise next.
              </p>
            </div>

            {/* Input Form and suggestions */}
            <div className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && taskName.trim()) {
                      setFocusState("tiny_step");
                    }
                  }}
                  placeholder="e.g. Draft presentation proposal, Compile build"
                  id="vague-goal-input"
                  className="w-full h-15 px-4 rounded-xl premium-input outline-none text-white placeholder-[#666666] font-sans text-sm"
                />
              </div>

              {/* Selector caps */}
              <div className="flex gap-2">
                <button 
                  onClick={() => setSessionMode("single")}
                  className={`flex-1 py-2.5 text-[11px] font-medium rounded border uppercase tracking-wider transition-all cursor-pointer ${
                    sessionMode === "single" 
                      ? "bg-white border-white text-black" 
                      : "bg-transparent border-[#2A2A2A] text-[#888888] hover:text-white"
                  }`}
                >
                  Single Session
                </button>
                <button 
                  onClick={() => setSessionMode("interval")}
                  className={`flex-1 py-2.5 text-[11px] font-medium rounded border uppercase tracking-wider transition-all cursor-pointer ${
                    sessionMode === "interval" 
                      ? "bg-white border-white text-black" 
                      : "bg-transparent border-[#2A2A2A] text-[#888888] hover:text-white"
                  }`}
                >
                  Interval Blocks
                </button>
              </div>

              {/* Numeric Configuration slider and details */}
              <div className="glass-panel p-5 rounded space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[9px] font-mono text-[#888888] tracking-wider uppercase">Session Length:</span>
                    <div className="flex items-center gap-1.5 font-mono text-zinc-400">
                      <input 
                        type="number" 
                        value={sessionMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val)) {
                            setSessionMinutes("");
                          } else {
                            setSessionMinutes(val);
                            setTimeRemaining(val * 60);
                          }
                        }}
                        className="w-14 premium-input text-zinc-100 text-xs font-bold rounded px-2 py-0.5 outline-none text-right font-mono"
                        min="1"
                        max="300"
                      />
                      <span>min</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={sessionMinutes === "" ? 25 : (sessionMinutes <= 120 ? sessionMinutes : 120)}
                    onChange={(e) => {
                      const mins = parseInt(e.target.value);
                      setSessionMinutes(mins);
                      setTimeRemaining(mins * 60);
                    }}
                    className="w-full accent-zinc-250 cursor-pointer h-1.5 bg-zinc-900 rounded-lg appearance-none mt-2"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-[#666666] mt-2 lowercase">
                    <span>5m (micro)</span>
                    <span>25m (steady)</span>
                    <span>60m (deep)</span>
                    <span>120m (limit)</span>
                  </div>
                </div>

                {sessionMode === "interval" && (
                  <>
                    <div className="w-full h-px bg-[#1A1A1A] my-3" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-mono text-[#888888] tracking-wider block mb-2 uppercase"># Cycles</label>
                        <input 
                          type="number" 
                          value={intervalCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setIntervalCount(isNaN(val) ? "" : val);
                          }}
                          className="w-full premium-input text-white text-xs rounded px-3 py-2 outline-none font-mono"
                          min="1"
                          max="20"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-mono text-[#888888] tracking-wider block mb-2 uppercase">Break Ratio</label>
                        <div className="relative flex items-center">
                          <input 
                            type="number" 
                            value={breakMinutes}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setBreakMinutes(isNaN(val) ? "" : val);
                            }}
                            className="w-full premium-input text-white text-xs rounded px-3 py-2 outline-none font-mono"
                            min="1"
                            max="60"
                          />
                          <span className="absolute right-3 text-[9px] text-[#666666] font-mono">min</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Start Trigger CTA */}
              <div className="pt-1 select-none">
                <button
                  disabled={!taskName.trim()}
                  onClick={() => setFocusState("tiny_step")}
                  id="direct-tiny-step-btn"
                  className="w-full h-14 bg-white hover:bg-[#F0F0F0] text-black rounded font-medium tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Configure Session
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>

              {/* Suggestion Chips */}
              {frequentTasks.length > 0 && (
                <div className="pt-4 border-t border-[#1A1A1A] flex flex-col gap-2.5">
                  <span className="text-[9px] font-mono text-[#666666] uppercase tracking-widest text-center">Past Flow States</span>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {frequentTasks.map(task => (
                      <button
                        key={task}
                        onClick={() => setTaskName(task)}
                        className="px-2.5 py-1 rounded bg-[#121212] border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[10px] text-[#AAAAAA] transition-colors cursor-pointer"
                      >
                        {task}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
            className="space-y-6"
          >
            <div className="space-y-2 text-center sm:text-left">
              <span className="inline-flex flex-col items-center justify-center px-4 py-1.5 rounded border border-[#2A2A2A] text-[9px] text-[#888888] font-mono tracking-widest uppercase mb-4">
                Initialize Vector
              </span>
              <h2 className="text-2xl font-medium tracking-tight text-white leading-tight mt-2.5">
                What is the first molecular step?
              </h2>
              <p className="text-[#666666] text-xs sm:text-sm">
                Name an action that requires less than 60 seconds of effort.
              </p>
            </div>

            {/* Input entry */}
            <div className="space-y-4">
              <input
                type="text"
                value={tinyStep}
                onChange={(e) => setTinyStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tinyStep.trim()) {
                    handleStartTimer();
                  }
                }}
                placeholder="e.g. Open document, Write 1 line"
                id="tiny-step-input"
                className="w-full h-14 px-4 rounded premium-input outline-none text-white placeholder-[#666666] transition-all text-xs focus:ring-1 focus:ring-white"
              />

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={handleResetToIdle}
                  className="px-5 h-14 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors text-xs font-medium cursor-pointer"
                >
                  Reset
                </button>
                <button
                  disabled={!tinyStep.trim()}
                  onClick={handleStartTimer}
                  id="final-start-focus-btn"
                  className="flex-1 h-14 bg-white hover:bg-[#F0F0F0] text-black rounded font-medium tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  Init Sequence ({sessionMinutes}m)
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* FOCUS SESSION MODE */}
        {(focusState === "focusing" || focusState === "paused" || focusState === "interval_break") && (
          <motion.div
            key="focusing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-9 py-4"
          >
            {/* Spotlight layout Header */}
            <div className="text-center space-y-2 max-w-sm">
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-[0.25em] block">Target</span>
              <h2 className="text-lg font-medium text-white line-clamp-1">{taskName}</h2>
              {sessionMode === "interval" && (
                <div className="text-[10px] font-mono text-[#666666]">
                  Cycle {currentInterval} / {intervalCount}
                </div>
              )}
              {focusState !== "interval_break" && (
                <div className="bg-[#121212] border border-[#2A2A2A] py-2 px-3 rounded inline-flex items-center gap-1.5 text-[11px] text-[#AAAAAA] mt-2 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                  <span>Step:</span>
                  <span className="text-white truncate font-sans max-w-[200px]">{tinyStep}</span>
                </div>
              )}
            </div>

            {/* Timer circle visualization */}
            <div className="relative w-56 h-56 flex items-center justify-center">

              {/* Progress Ring */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx="112"
                  cy="112"
                  r="108"
                  className="stroke-[#1A1A1A] fill-none"
                  strokeWidth="1"
                />
                <circle
                  cx="112"
                  cy="112"
                  r="108"
                  className="stroke-white fill-none transition-all duration-1000 ease-linear"
                  strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 108}
                  strokeDashoffset={2 * Math.PI * 108 * (1 - progressRatio)}

                  strokeLinecap="round"
                />
              </svg>

              {/* Central Time Indicators */}
              <div className="text-center space-y-1 relative z-10 flex flex-col items-center">
                <span className="text-4xl font-medium tracking-tight text-white font-mono leading-none">
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-[10px] font-mono text-[#666666] uppercase pt-2">
                  {focusState === "interval_break" ? "INTERVAL BREAK" : focusState === "focusing" ? "DEEP FOCUS" : "FLOW PAUSED"}
                </span>
              </div>
            </div>

            {/* Recovery / stuck options list */}
            <div className="w-full space-y-4">
              
              {/* Core Control Group */}
              <div className="flex gap-2.5 justify-center">
                {focusState === "interval_break" ? (
                  <button
                    onClick={() => {
                      setFocusState("focusing");
                      setTimeRemaining(sessionMinutes * 60);
                      playStartSound();
                    }}
                    className="flex-1 max-w-[130px] h-11 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium font-sans"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    Skip Break
                  </button>
                ) : focusState === "focusing" ? (
                  <button
                    onClick={() => handlePauseToggle()}
                    className="flex-1 max-w-[130px] h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium font-sans"
                  >
                    <Pause className="w-3.5 h-3.5 shrink-0" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={() => handlePauseToggle()}
                    className="flex-1 max-w-[130px] h-11 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium font-sans"
                  >
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    Resume
                  </button>
                )}

                <button
                  onClick={() => handleStuckRescue()}
                  id="trigger-stuck-btn"
                  className="flex-1 max-w-[130px] h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium font-sans"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Signal Stuck
                </button>

                <button
                  onClick={handleCompleteSession}
                  id="mock-finish-session-btn"
                  className="flex-1 max-w-[110px] h-11 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-sans"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Conclude
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* STUCK RESCUE STATE */}
        {focusState === "stuck_rescue" && (
          <motion.div
            key="stuck_rescue"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
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
            className="flex flex-col items-center justify-center space-y-10 py-6"
          >
            <div className="text-center space-y-2 max-w-sm">
              <h3 className="text-[10px] font-mono text-[#888888] uppercase tracking-widest block">Rest Window</h3>
              <h2 className="text-xl font-medium text-white line-clamp-1">Resting Mindscape</h2>
              <p className="text-xs text-[#666666]">
                Active flow paused. Protect your space, take a breath, or look away from the screens.
              </p>
            </div>

            {/* Timer circle visualization */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Progress Circle SVG */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="112"
                  className="stroke-[#1A1A1A] fill-none"
                  strokeWidth="1"
                />
                <circle
                  cx="128"
                  cy="128"
                  r="112"
                  className="stroke-white fill-none transition-all duration-1000 ease-linear"
                  strokeWidth="2"
                  strokeDasharray={2 * Math.PI * 112}
                  strokeDashoffset={2 * Math.PI * 112 * (1 - (guiltFreeRemaining / (5 * 60)))}
                  strokeLinecap="round"
                />
              </svg>

              {/* Central Time Indicators */}
              <div className="text-center space-y-1 relative z-10 flex flex-col items-center">
                <span className="text-5xl font-sans font-light text-white tracking-tight font-mono">
                  {formatTime(guiltFreeRemaining)}
                </span>
              </div>
            </div>

            <div className="w-full flex gap-3 justify-center">
              <button
                onClick={() => {
                  setFocusState("focusing");
                }}
                className="flex-1 max-w-[180px] h-12 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold"
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
            className="space-y-6"
          >
            <div className="space-y-2 block text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#2A2A2A] text-[9px] text-[#888888] font-mono tracking-wider uppercase">
                SESSION REFLECTION
              </div>
              <h2 className="text-2xl font-sans font-medium text-white tracking-tight mt-2">
                Nicely done. What progress occurred?
              </h2>
              <p className="text-[#666666] text-sm">
                No matter how small, noting it signals completion to your brain.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#888888] block tracking-wider uppercase">WHAT WAS ACCOMPLISHED OR LEARNED? (OPTIONAL)</label>
                <textarea
                  value={completedNotes}
                  onChange={(e) => setCompletedNotes(e.target.value)}
                  disabled={isSaving}
                  placeholder="e.g. Read 5 pages, drafted an email"
                  id="reflection-completed-input"
                  className="w-full h-24 p-4 rounded premium-input outline-none text-white placeholder-[#666666] text-sm disabled:opacity-50 resize-none font-sans"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-mono text-[#888888] block tracking-wider uppercase">WHAT IS THE VERY FIRST STEP FOR NEXT TIME? (OPTIONAL)</label>
                <input
                  type="text"
                  value={nextStepCaptured}
                  onChange={(e) => setNextStepCaptured(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSaving) {
                      handleSaveReflection();
                    }
                  }}
                  disabled={isSaving}
                  placeholder="e.g. Read page 6, Send the proposal"
                  id="reflection-nextstep-input"
                  className="w-full h-14 px-4 rounded premium-input outline-none text-white placeholder-[#666666] text-sm disabled:opacity-50 font-sans"
                />
              </div>

              <button
                disabled={isSaving}
                onClick={handleSaveReflection}
                id="save-reflection-btn"
                className="w-full h-14 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:bg-[#333333] disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></span>
                    Saving Session...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Lock in Progress & Reflect
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
                Your future self will thank you. The next step is securely logged so you don't have starting hurdles.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#121212] border border-[#2A2A2A] rounded p-5 space-y-4 text-left"
            >
              <div>
                <span className="text-[10px] font-mono text-[#888888] tracking-widest block uppercase">NEXT TIME'S INITIAL STEP:</span>
                <div className="bg-[#1A1A1A] px-3.5 py-3 rounded border border-[#2A2A2A] flex items-center gap-3 text-sm text-[#CCCCCC] font-sans mt-2">
                  <CornerDownRight className="w-4 h-4 text-[#888888]" />
                  <span>{nextStepCaptured}</span>
                </div>
              </div>
            </motion.div>

            <button
              onClick={handleResetToIdle}
              id="return-to-dash-btn"
              className="w-full h-14 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
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
    </div>
  );
}
