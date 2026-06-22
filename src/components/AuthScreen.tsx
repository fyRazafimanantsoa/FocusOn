import React from "react";
import { signInWithGoogle } from "../lib/firebase";
import { Sparkles, Compass, ShieldAlert, LogIn, CircleDot } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onGuestAccess: () => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

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

export default function AuthScreen({ onGuestAccess, isLoading, setIsLoading }: AuthScreenProps) {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Popup block/error - falling back to guest or showing prompt: ", err);
      setErrorMessage("Sign-in popup is blocked in this container preview. Please enter via the 'Guest Sandbox' button below to explore.");
    } finally {
      setIsLoading(false);
    }
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
          <span className="font-sans font-bold tracking-wide text-zinc-100 leading-none">FocusOn</span>
          <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase mt-0.5">Aether Neural Sandbox</span>
        </div>
      </motion.div>

      {/* Hero Body */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center text-center px-2 relative z-10"
      >
        <div className="space-y-6">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-[9px] text-zinc-300 font-mono tracking-widest uppercase font-bold shadow-xs">
            ✨ Recovery-First Engine
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-4xl font-sans font-bold tracking-tight text-white leading-[1.12]">
            Focus is dynamic, <br />
            <span className="text-zinc-500">not a mental cage.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-sans max-w-[320px] mx-auto">
            A minimalist, dopamine-regulated companion tailored for deep work. Overcome blockages, track drift cycles without shame, and gently step back into key flow states.
          </motion.p>
        </div>

        {/* Action Buttons with high-contrast luxury formatting */}
        <motion.div variants={itemVariants} className="mt-12 space-y-3.5">
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-left backdrop-blur-md">
              <span className="text-[9px] font-mono text-red-400 font-bold tracking-wider uppercase block">PREVIEW ERROR DETECTED</span>
              <p className="text-red-200 text-xs mt-1 leading-relaxed">{errorMessage}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            id="google-signin-btn"
            className="w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-[0.982]"
          >
            {isLoading ? (
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
                Sync with Google Platform
              </>
            )}
          </button>

          <button
            onClick={onGuestAccess}
            disabled={isLoading}
            id="guest-signin-btn"
            className="w-full h-14 glass-panel glass-panel-hover text-zinc-300 text-xs font-bold rounded-xl flex flex-col justify-center items-center gap-0.5 cursor-pointer disabled:opacity-50 active:scale-[0.982]"
          >
            <span className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-zinc-400" />
              Enter Sandbox Mode
            </span>
          </button>
        </motion.div>
      </motion.div>

      {/* Footer disclaimer */}
      <div className="max-w-xs mx-auto w-full text-center text-zinc-650 text-[10px] font-mono tracking-widest uppercase pb-4">
        🔒 Decentralized Client Space
      </div>
    </div>

  );
}
