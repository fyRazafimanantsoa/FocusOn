import React, { useState } from "react";
import { Compass, Sparkles, CircleDot, Mail, Lock, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { logInWithEmail, registerWithEmail, logInWithGoogle, updateDisplayName, sendPasswordReset } from "../lib/firebase";

interface AuthScreenProps {
  onGuestAccess: (customName?: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function AuthScreen({ onGuestAccess, isLoading, setIsLoading }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Custom states for friendly UX notifications
  const [emailAlreadyUsed, setEmailAlreadyUsed] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill out all fields.");
      return;
    }
    if (isSignUp && !username) {
      setError("Please provide a username.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setEmailAlreadyUsed(false);

    try {
      if (isSignUp) {
        await registerWithEmail(email, password);
        await updateDisplayName(username.trim());
      } else {
        await logInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error("Email authentication error:", err);
      if (err.code === "auth/email-already-in-use") {
        setEmailAlreadyUsed(true);
        setIsLoading(false);
        return; // Return early without triggering the big error panel
      }

      let errMsg = "Authentication failed. Please try again.";
      if (err.code === "auth/unauthorized-domain" || err.message?.includes("unauthorized-domain")) {
        errMsg = `Domain unauthorized! Go to your Firebase Console under "Authentication" > "Settings" > "Authorized Domains" and add: ${window.location.hostname}`;
      } else if (err.code === "auth/invalid-credential" || err.message?.includes("invalid-credential")) {
        errMsg = "Invalid credentials. Please verify your Firebase project setup, API Key, and email/password configuration.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-login-credentials") {
        errMsg = "Incorrect email or password.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    setIsResetLoading(true);
    setError(null);
    setResetEmailSent(false);
    try {
      await sendPasswordReset(email);
      setResetEmailSent(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      let errMsg = "Failed to send reset email. Please try again.";
      if (err.code === "auth/user-not-found") {
        errMsg = "No account found with this email.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await logInWithGoogle();
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        let errMsg = "Google authentication failed. Please try again.";
        if (err.code === "auth/unauthorized-domain" || err.message?.includes("unauthorized-domain")) {
          errMsg = `Domain unauthorized! Go to your Firebase Console under "Authentication" > "Settings" > "Authorized Domains" and add: ${window.location.hostname}`;
        } else if (err.code === "auth/invalid-credential" || err.message?.includes("invalid-credential")) {
          errMsg = "Invalid credentials. Please verify your Firebase project setup, API Key, and Google authentication config.";
        } else if (err.message) {
          errMsg = err.message;
        }
        setError(errMsg);
      }
      setIsLoading(false);
    }
  };

  const handleGuestSubmit = (e: React.MouseEvent) => {
    e.preventDefault();
    onGuestAccess("Sandbox Visitor");
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
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.05 }}
        className="flex items-center gap-3 max-w-sm mx-auto w-full pt-6 text-left relative z-10"
      >
        <div className="w-9 h-9 rounded-xl glass-panel flex items-center justify-center border border-zinc-800 bg-zinc-950/40 shadow-md">
          <CircleDot className="w-4.5 h-4.5 text-zinc-300" />
        </div>
        <div className="flex flex-col">
          <span className="font-sans font-bold tracking-wide text-zinc-100 text-lg leading-none">FocusOn</span>
          <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mt-1">Pristine Decentralized Space</span>
        </div>
      </motion.div>

      {/* Hero Body */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center text-center px-2 py-8 relative z-10"
      >
        <div className="space-y-4">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-950/40 text-[9px] text-zinc-400 font-mono tracking-widest uppercase font-bold shadow-xs">
            ✨ Secure cloud synchronization
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-4xl font-sans font-bold tracking-tight text-white leading-[1.1]">
            {isSignUp ? "Begin your journey." : "Focus is fluid, not a cage."}
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-zinc-400 text-xs leading-relaxed font-sans max-w-[320px] mx-auto">
            A minimalist companion designed to help you track flow states, steps, and drift cycles.
          </motion.p>
        </div>

        {/* Error message display */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-xs flex items-start gap-2 text-left"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex flex-col gap-2 w-full">
                <span>{error}</span>
                {error.includes("Authorized Domains") && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.hostname);
                      alert(`Copied domain to clipboard: ${window.location.hostname}`);
                    }}
                    className="mt-1 px-2.5 py-1.5 self-start bg-red-900/35 hover:bg-red-900/50 text-red-200 border border-red-800/40 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer active:scale-95"
                  >
                    📋 Copy Domain Name
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prominent Segmented Auth Tab Switcher */}
        <motion.div variants={itemVariants} className="mt-6 p-1 bg-zinc-950/80 border border-zinc-900 rounded-xl flex gap-1 relative z-10 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 outline-none ${
              !isSignUp 
                ? "bg-zinc-800 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-zinc-700/30" 
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 outline-none ${
              isSignUp 
                ? "bg-zinc-800 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-zinc-700/30" 
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Sign Up
          </button>
        </motion.div>

        {/* Auth Input Form Area */}
        <motion.form onSubmit={handleEmailAuth} variants={itemVariants} className="mt-6 space-y-3.5 text-left">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block ml-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pilot name"
                className="w-full h-11 bg-zinc-950/60 hover:bg-zinc-950/80 focus:bg-zinc-950 border border-zinc-850 focus:border-zinc-700 text-zinc-100 text-xs rounded-xl px-4 transition-all outline-none focus:ring-1 focus:ring-zinc-800/50"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block ml-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailAlreadyUsed(false);
                  setResetEmailSent(false);
                  if (error && (error.includes("email") || error.includes("Reset") || error.includes("account"))) {
                    setError(null);
                  }
                }}
                placeholder="name@domain.com"
                className="w-full h-11 pl-10 bg-zinc-950/60 hover:bg-zinc-950/80 focus:bg-zinc-950 border border-zinc-850 focus:border-zinc-700 text-zinc-100 text-xs rounded-xl px-4 transition-all outline-none focus:ring-1 focus:ring-zinc-800/50"
              />
            </div>

            {emailAlreadyUsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono leading-normal mt-1.5 flex items-start gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <span>This email is already registered. </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setEmailAlreadyUsed(false);
                    }}
                    className="underline hover:text-white font-bold ml-1 cursor-pointer"
                  >
                    Switch to Sign In
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetLoading}
                  className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider outline-none cursor-pointer disabled:opacity-50"
                >
                  {isResetLoading ? "Sending Reset..." : "Forgot Password?"}
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 bg-zinc-950/60 hover:bg-zinc-950/80 focus:bg-zinc-950 border border-zinc-850 focus:border-zinc-700 text-zinc-100 text-xs rounded-xl px-4 transition-all outline-none focus:ring-1 focus:ring-zinc-800/50"
              />
            </div>
          </div>

          <AnimatePresence>
            {resetEmailSent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-xs flex items-start gap-2 text-left mt-2"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-bold">📩 Password reset email sent!</span>
                  <span className="text-zinc-450 text-[11px]">Check your inbox for instructions to reset your password.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            id="auth-submit-btn"
            className="w-full h-12 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.985]"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></span>
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                Create Account
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In with Email
              </>
            )}
          </button>
        </motion.form>

        {/* Divider */}
        <motion.div variants={itemVariants} className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-900"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase">
            <span className="bg-[#030406] px-3 text-zinc-650">Or continue with</span>
          </div>
        </motion.div>

        {/* Google Sign-In */}
        <motion.button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          variants={itemVariants}
          id="google-signin-btn"
          className="w-full h-12 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-zinc-250 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google Account
        </motion.button>

        {/* Form Toggle and Guest Option */}
        <motion.div variants={itemVariants} className="mt-6 space-y-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium outline-none"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] text-zinc-650">Or try without an account:</span>
            <button
              onClick={handleGuestSubmit}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-bold flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              Sandbox Guest
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer disclaimer */}
      <div className="max-w-xs mx-auto w-full text-center text-zinc-600 text-[9px] font-mono tracking-widest uppercase pb-2">
        🔒 Encrypted End-to-End • Secure Firebase Cloud
      </div>
    </div>
  );
}
