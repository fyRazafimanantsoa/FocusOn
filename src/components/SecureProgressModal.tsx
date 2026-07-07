import React, { useState } from "react";
import { Compass, Sparkles, CircleDot, Mail, Lock, LogIn, UserPlus, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { logInWithEmail, registerWithEmail, logInWithGoogle, updateDisplayName } from "../lib/firebase";

interface SecureProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecureProgressModal({ isOpen, onClose }: SecureProgressModalProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

    try {
      if (isSignUp) {
        await registerWithEmail(email, password);
        await updateDisplayName(username.trim());
      } else {
        await logInWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error("Email authentication error:", err);
      let errMsg = "Authentication failed. Please try again.";
      if (err.code === "auth/unauthorized-domain" || err.message?.includes("unauthorized-domain")) {
        errMsg = `Domain unauthorized! Go to your Firebase Console under "Authentication" > "Settings" > "Authorized Domains" and add: ${window.location.hostname}`;
      } else if (err.code === "auth/invalid-credential" || err.message?.includes("invalid-credential")) {
        errMsg = "Invalid credentials. Please verify your Firebase project setup, API Key, and email/password configuration.";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-login-credentials") {
        errMsg = "Incorrect email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already in use.";
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await logInWithGoogle();
      onClose();
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-[#121212] border border-[#222222] shadow-2xl p-6 sm:p-8 flex flex-col relative rounded"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            id="close-secure-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Loss Aversion Framing Header */}
          <div className="space-y-4 text-left pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-mono tracking-widest uppercase font-bold rounded">
              ⚠️ Protect Your Progress
            </div>
            
            <h2 className="text-2xl font-sans font-bold tracking-tight text-white leading-tight">
              Don't lose your completed work.
            </h2>
            
            <p className="text-zinc-400 text-xs leading-relaxed font-sans">
              You are running in a temporary guest sandbox. Secure your session details, custom focus configurations, and daily task history now so your routines remain completely intact across devices.
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-200 leading-normal">{error}</p>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleEmailAuth} className="mt-6 space-y-4 text-left">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. pilot_focus"
                    disabled={isLoading}
                    className="w-full h-10 px-3 bg-black border border-[#2A2A2A] rounded text-white text-xs placeholder-zinc-600 outline-none focus:border-zinc-400 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. save_my_progress@email.com"
                  disabled={isLoading}
                  className="w-full h-10 px-3 bg-black border border-[#2A2A2A] rounded text-white text-xs placeholder-zinc-600 outline-none focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={isLoading}
                  className="w-full h-10 px-3 bg-black border border-[#2A2A2A] rounded text-white text-xs placeholder-zinc-600 outline-none focus:border-zinc-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-white hover:bg-zinc-200 text-black font-semibold rounded text-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-6 disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Preserving workspace...
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Lock In My Progress
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Log In & Sync Session
                </>
              )}
            </button>
          </form>

          {/* Google Sign In option */}
          <div className="mt-4 text-center">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">or secure with</span>
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              type="button"
              className="w-full h-10 bg-zinc-900 hover:bg-zinc-850 text-white border border-[#2A2A2A] text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
            >
              <Compass className="w-4 h-4 text-zinc-400" />
              Sign in with Google
            </button>
          </div>

          {/* Toggle between Login and Signup */}
          <div className="mt-6 text-center border-t border-[#222222] pt-4">
            <p className="text-[11px] text-zinc-500">
              {isSignUp ? "Already have an account?" : "Want to create a new secure account?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                type="button"
                className="text-white font-medium hover:underline cursor-pointer ml-1"
              >
                {isSignUp ? "Log In instead" : "Sign Up instead"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
