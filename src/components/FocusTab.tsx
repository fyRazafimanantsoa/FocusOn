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
  const [timeUnit, setTimeUnit] = useState<"min" | "hrs">("min");
  const [inputValue, setInputValue] = useState<string>(
    profile.adhdMode ? "20" : "25"
  );

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

  const formatSessionMinutes = (mins: number | "") => {
    if (mins === "") return "";
    if (mins >= 60) {
      const hrs = Math.round((mins / 60) * 10) / 10;
      return `${hrs}h`;
    }
    return `${mins}m`;
  };

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
  const [showAddTime, setShowAddTime] = useState(false);
  const [customAddMins, setCustomAddMins] = useState("");

  const handleAddTime = (minsToAdd: number) => {
    setSessionMinutes(prev => (typeof prev === 'number' ? prev + minsToAdd : 25 + minsToAdd));
    setTimeRemaining(prev => prev + minsToAdd * 60);
    setShowAddTime(false);
    setCustomAddMins("");
  };

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
            if (sessionMode !== "single") {
              setGuiltFreeRemaining((prev) => {
                if (prev - delta <= 0) {
                  workerRef.current?.postMessage('stop');
                  handleGuiltFreeZero();
                  return 0;
                }
                return prev - delta;
              });
            }
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
            <div className="space-y-1.5 text-left bg-[#121212]/80 backdrop-blur-md pt-10 pr-4 pb-3 pl-8 border border-[#2A2A2A]/80 rotate-[1.5deg] mb-4 relative z-10">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-[0.85] text-white uppercase">
                What are you working on?
              </h2>
              <p className="text-[#888888] font-mono tracking-[0.15em] text-[9px] uppercase mt-4">
                Name your immediate priority. We will filter out the noise next.
              </p>
            </div>

            {/* Input Form and suggestions */}
            <div className="space-y-5 bg-black/80 backdrop-blur-md p-6 border border-[#2A2A2A]/80 -rotate-1 relative z-20">
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
                    <div className="flex items-center gap-2">
                      {/* Unit Segmented Toggle */}
                      <div className="flex items-center gap-1 bg-black/60 border border-[#2A2A2A]/80 rounded p-0.5 text-[9px] font-mono">
                        <button
                          type="button"
                          onClick={() => handleUnitChange("min")}
                          className={`px-1.5 py-0.5 rounded transition-colors ${
                            timeUnit === "min" 
                              ? "bg-white text-black font-bold" 
                              : "text-[#888888] hover:text-white"
                          }`}
                        >
                          MIN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnitChange("hrs")}
                          className={`px-1.5 py-0.5 rounded transition-colors ${
                            timeUnit === "hrs" 
                              ? "bg-white text-black font-bold" 
                              : "text-[#888888] hover:text-white"
                          }`}
                        >
                          HRS
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-zinc-400">
                        <input 
                          id="session-length-input"
                          type="number" 
                          step={timeUnit === "min" ? "1" : "0.1"}
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
                          className="w-14 premium-input text-zinc-100 text-xs font-bold rounded px-2 py-0.5 outline-none text-right font-mono"
                          min={timeUnit === "min" ? "1" : "0.1"}
                          max={timeUnit === "min" ? "300" : "5.0"}
                        />
                        <span className="text-[10px] lowercase text-[#888888]">{timeUnit}</span>
                      </div>
                    </div>
                  </div>

                  {timeUnit === "min" ? (
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
                      className="w-full accent-zinc-250 cursor-pointer h-1.5 bg-zinc-900 rounded-lg appearance-none mt-2"
                    />
                  )}

                  {timeUnit === "min" ? (
                    <div className="flex justify-between text-[8px] font-mono text-[#666666] mt-2 lowercase">
                      <span>5m (micro)</span>
                      <span>25m (steady)</span>
                      <span>60m (deep)</span>
                      <span>120m (limit)</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[8px] font-mono text-[#666666] mt-2 lowercase">
                      <span>0.1h (micro)</span>
                      <span>0.5h (steady)</span>
                      <span>1.0h (deep)</span>
                      <span>5.0h (limit)</span>
                    </div>
                  )}
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
            <div className="space-y-2 text-left bg-[#121212]/80 backdrop-blur-md pt-12 pb-3 pr-4 pl-8 border border-[#2A2A2A]/80 rotate-[-2deg] mb-4 relative z-10">
              <span className="inline-flex px-3 py-1 rounded bg-black border border-[#2A2A2A]/80 text-[9px] text-white font-mono tracking-widest uppercase mb-4 shadow-[2px_2px_0px_#2A2A2A]">
                Initialize Vector
              </span>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-[0.85] mt-2.5">
                What is the first molecular step?
              </h2>
              <p className="text-[#888888] font-mono tracking-[0.1em] text-[9px] uppercase mt-4">
                Name an action that requires less than 60 seconds of effort.
              </p>
            </div>

            {/* Input entry */}
            <div className="space-y-4 bg-black/80 backdrop-blur-md p-6 border border-[#2A2A2A]/80 rotate-[1deg] relative z-20">
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
                  Init Sequence ({formatSessionMinutes(sessionMinutes)})
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
            className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 md:space-y-9 py-2 sm:py-4"
          >
            {/* Spotlight layout Header */}
            <div className="text-center space-y-1.5 sm:space-y-2 max-w-sm bg-[#121212]/80 backdrop-blur-md pt-6 sm:pt-10 pr-4 pb-2.5 sm:pb-3 pl-6 sm:pl-8 border border-[#2A2A2A]/80 rotate-[1.5deg] relative z-10 -mb-3 sm:-mb-4 shadow-[4px_4px_0px_rgba(0,0,0,0.4)]">
              <span className="text-[9px] font-mono text-[#888888] uppercase tracking-[0.25em] block">Target</span>
              <h2 className="text-xl sm:text-2xl font-black text-white line-clamp-2 uppercase tracking-tighter leading-[0.85]">{taskName}</h2>
              {sessionMode === "interval" && (
                <div className="text-[10px] font-mono text-[#666666]">
                  Cycle {currentInterval} / {intervalCount}
                </div>
              )}
              {focusState !== "interval_break" && (
                <div className="bg-black border border-[#2A2A2A]/80 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-none inline-flex items-center gap-1.5 text-[10px] text-[#AAAAAA] mt-1 sm:mt-2 font-mono rotate-[-1deg]">
                  <span className="w-1.5 h-1.5 bg-white shrink-0" />
                  <span>Step:</span>
                  <span className="text-white truncate font-sans max-w-[150px] sm:max-w-[200px]">{tinyStep}</span>
                </div>
              )}
            </div>

            {/* Timer circle visualization */}
            <div className="relative w-48 h-48 sm:w-60 sm:h-60 md:w-64 md:h-64 flex items-center justify-center bg-black/80 backdrop-blur-md border border-[#2A2A2A]/80 rotate-[-1.5deg] z-20 p-2">

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
              <div className="text-center space-y-1 relative z-10 flex flex-col items-center">
                <span className="text-4xl sm:text-5xl font-black tracking-tighter text-white font-mono leading-[0.85]">
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-[8px] sm:text-[10px] font-mono text-[#666666] tracking-[0.2em] uppercase pt-1.5 sm:pt-3">
                  {focusState === "interval_break" ? "INTERVAL BREAK" : focusState === "focusing" ? "DEEP FOCUS" : "FLOW PAUSED"}
                </span>
              </div>
            </div>

            {/* Add Time Area */}
            {(focusState === "focusing" || focusState === "paused") && (
              <div className="w-full flex flex-col items-center">
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
              </div>
            )}

            {/* Recovery / stuck options list */}
            <div className="w-full space-y-2 sm:space-y-4">
              
              {/* Core Control Group */}
              <div className="flex flex-wrap gap-1.5 xs:gap-2.5 justify-center">
                {focusState === "interval_break" ? (
                  <button
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
                      onClick={() => handlePauseToggle()}
                      className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                    >
                      <Pause className="w-3.5 h-3.5 shrink-0" />
                      Pause
                    </button>
                    {sessionMode === "single" && (
                      <button
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
                      onClick={() => handlePauseToggle()}
                      className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-white hover:bg-[#F0F0F0] text-black rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      Resume
                    </button>
                    {sessionMode === "single" && (
                      <button
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
                  onClick={() => handleStuckRescue()}
                  id="trigger-stuck-btn"
                  className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-transparent border border-[#2A2A2A] hover:bg-[#1A1A1A] text-[#888888] hover:text-white rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-medium font-sans"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Signal Stuck
                </button>

                <button
                  onClick={handleCompleteSession}
                  id="mock-finish-session-btn"
                  className="flex-1 min-w-[72px] xs:min-w-[100px] sm:min-w-[110px] max-w-[130px] h-9 xs:h-11 bg-white hover:bg-[#F0F0F0] text-black font-medium rounded transition-colors cursor-pointer flex items-center justify-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs font-sans"
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
                  <span className="text-4xl sm:text-5xl font-sans font-light text-white tracking-tight font-mono">
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
            className="space-y-6"
          >
            <div className="space-y-2 block text-left bg-[#121212]/80 backdrop-blur-md pt-12 pr-4 pb-3 pl-8 border border-[#2A2A2A]/80 rotate-[-1.5deg] relative z-10 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border border-[#2A2A2A]/80 text-[9px] text-white font-mono tracking-widest uppercase mb-4 shadow-[2px_2px_0px_#2A2A2A]">
                SESSION REFLECTION
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
                <label className="text-[10px] font-mono text-[#888888] block tracking-wider uppercase">Session Notes (Optional)</label>
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
                    Saving Session...
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
    </div>
  );
}
