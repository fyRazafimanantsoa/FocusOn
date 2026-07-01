import React, { useState, useEffect } from "react";
import { signInWithGoogle } from "../lib/firebase";
import { CircleDot, Sparkles, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function AuthScreen() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [timer, setTimer] = useState(300); // 5 minutes (300 seconds)
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Timer countdown hook
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setIsTimerActive(false);
            setLocalLoading(false);
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timer]);

  const triggerGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Popup block/error: ", err);
      // If the popup is closed too quickly by browser security or the user, 
      // we do not abort the timer. We hold the session active for 5 minutes 
      // and display instructions to guide them through.
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setErrorMessage(
          "The authentication window is active. If the Google window closed or was blocked, click 'Re-open Sign-In Window' below. We will hold your session active."
        );
      } else {
        setErrorMessage(err?.message || String(err));
      }
    }
  };

  const handleGoogleSignInPopup = async () => {
    if (isTimerActive) return; // Prevent double trigger
    
    setLocalLoading(true);
    setErrorMessage(null);
    setTimer(300); // reset to 5 minutes
    setIsTimerActive(true);

    await triggerGoogleSignIn();
  };

  const handleReopenPopup = async () => {
    setErrorMessage(null);
    await triggerGoogleSignIn();
  };

  // Helper to format remaining time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen bg-[#030406] text-zinc-300 flex flex-col justify-between p-6 relative overflow-hidden font-sans selection:bg-zinc-800 selection:text-white z-0">
      {/* Dynamic luxury spotlight background elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-zinc-700/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-zinc-800/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Decorative top grid lines */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent pointer-events-none" />

      {/* Header element */}
      <motion.div 
         initial={{ opacity: 0, y: -10 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
         className="flex items-center gap-3 max-w-sm mx-auto w-full pt-8 text-left relative z-10"
      >
        <div className="w-9 h-9 rounded-xl glass-panel flex items-center justify-center shadow-md animate-float">
          <CircleDot className="w-4.5 h-4.5 text-zinc-300 text-glow" />
        </div>
        <div className="flex flex-col">
          <span className="font-scale-app-name tracking-wide text-zinc-100 leading-none font-bold">FocusOn</span>
        </div>
      </motion.div>

      {/* Hero Body */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center text-center px-4 py-8 relative z-10"
      >
        <div className="space-y-4">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-[9px] text-zinc-300 font-mono tracking-widest uppercase font-bold shadow-xs">
            ✨ Recovery-First Engine
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-3xl sm:text-4xl font-sans font-bold tracking-tight text-white leading-[1.12]">
            Focus is dynamic, <br />
            <span className="text-zinc-500">not a mental cage.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-sans max-w-[340px] mx-auto">
            A minimalist, dopamine-regulated companion tailored for deep work. Overcome blockages and step back into key flow states.
          </motion.p>
        </div>

        {/* Auth card panel */}
        <motion.div 
          variants={itemVariants} 
          className="mt-8 p-6 bg-zinc-950/40 border border-zinc-900/60 rounded-2xl text-left backdrop-blur-md shadow-2xl relative"
        >
          {/* Active countdown lock state */}
          {isTimerActive ? (
            <div className="space-y-5 text-center py-4">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <span className="absolute inset-0 border-2 border-zinc-800 rounded-full"></span>
                <span className="absolute inset-0 border-2 border-t-zinc-100 rounded-full animate-spin"></span>
                <Sparkles className="w-6 h-6 text-zinc-300 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-white text-sm font-semibold tracking-tight">
                  Google Sign-In Session Active
                </h3>
                <p className="text-zinc-400 text-xs max-w-[280px] mx-auto leading-relaxed">
                  Please complete your authentication in the Google window. We are keeping this screen open to secure your login state.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[11px] font-mono font-bold text-zinc-300 tracking-wider">
                  TIME REMAINING: {formatTime(timer)}
                </span>
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left max-w-[320px] mx-auto">
                  <span className="text-[8px] font-mono text-zinc-400 font-bold tracking-wider uppercase block">
                    STATUS NOTICE
                  </span>
                  <p className="text-zinc-300 text-[10.5px] mt-1 leading-relaxed font-sans">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleReopenPopup}
                  type="button"
                  className="w-full h-11 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.985]"
                >
                  <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  Re-open Sign-In Window
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-zinc-400 text-xs leading-relaxed font-sans text-center mb-1">
                Synchronize your active projects, custom ADHD visual settings, and daily flow statistics securely with your Google Platform identity.
              </p>

              {/* Error messages if not in timer state */}
              {errorMessage && (
                <div className="p-3.5 bg-red-950/20 border border-red-900/35 rounded-xl text-left backdrop-blur-xs">
                  <span className="text-[8px] font-mono text-red-400 font-bold tracking-wider uppercase block">AUTHENTICATION ERROR</span>
                  <p className="text-red-200 text-[11px] mt-1.5 leading-relaxed font-mono">{errorMessage}</p>
                </div>
              )}

              {/* Single standard Google Sign In Button */}
              <button
                onClick={handleGoogleSignInPopup}
                disabled={localLoading}
                id="google-signin-btn"
                type="button"
                className="w-full h-12 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-[0.982]"
              >
                {localLoading ? (
                  <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="uppercase font-mono tracking-wider text-[10px]">Google Sign-In</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Footer disclaimer */}
      <div className="max-w-xs mx-auto w-full text-center text-zinc-650 text-[10px] font-mono tracking-widest uppercase pb-4">
        🔒 Secure OAuth Gateway
      </div>
    </div>
  );
}
