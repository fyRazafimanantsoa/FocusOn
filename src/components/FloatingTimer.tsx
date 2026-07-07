import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Play, Pause, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Ensure documentPictureInPicture is typed
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: any): Promise<Window>;
      window: Window | null;
    };
  }
}

interface FloatingTimerProps {
  isMinimized: boolean;
  setIsMinimized: (val: boolean) => void;
  focusState: string;
  taskName: string;
  timeRemaining: number;
  guiltFreeRemaining: number;
  formatTime: (secs: number) => string;
  handlePauseToggle: () => void;
  handleCompleteSession: () => void;
  minimizedNoteText: string;
  setMinimizedNoteText: (val: string) => void;
  brainDumps: string[];
  setBrainDumps: React.Dispatch<React.SetStateAction<string[]>>;
  tinyStep: string;
  playSuccessChime: () => void;
  minimizedPosition: { x: number, y: number };
  setMinimizedPosition: (pos: { x: number, y: number }) => void;
  minimizedSize: { width: number, height: number };
  setMinimizedSize: (size: { width: number, height: number }) => void;
  handleDragMouseDown: (e: any) => void;
  handleResizeMouseDown: (e: any) => void;
}

export function FloatingTimer(props: FloatingTimerProps) {
  const {
    isMinimized,
    setIsMinimized,
    focusState,
    taskName,
    timeRemaining,
    guiltFreeRemaining,
    formatTime,
    handlePauseToggle,
    handleCompleteSession,
    minimizedNoteText,
    setMinimizedNoteText,
    brainDumps,
    setBrainDumps,
    tinyStep,
    playSuccessChime,
    minimizedPosition,
    minimizedSize,
    handleDragMouseDown,
    handleResizeMouseDown
  } = props;

  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  // Attempt to open PiP window if supported and requested
  useEffect(() => {
    if (isMinimized && !pipWindow) {
      if (window.documentPictureInPicture) {
        // Try to open PiP window. This might fail if not triggered by user gesture
        window.documentPictureInPicture.requestWindow({
          width: minimizedSize.width,
          height: minimizedSize.height
        }).then(pip => {
          setPipWindow(pip);
          
          // Copy styles
          Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach((el) => {
            pip.document.head.appendChild(el.cloneNode(true));
          });

          // Create container
          const container = pip.document.createElement("div");
          container.style.height = "100vh";
          container.style.width = "100vw";
          container.style.backgroundColor = "#0A0A0B"; // Match dark theme
          pip.document.body.appendChild(container);
          pip.document.body.style.margin = "0";
          pip.document.body.style.padding = "0";
          pip.document.body.style.overflow = "hidden";
          pipContainerRef.current = container;

          pip.addEventListener("pagehide", () => {
            setPipWindow(null);
            setIsMinimized(false);
          });
        }).catch(err => {
          console.warn("PiP failed, using in-page fallback", err);
          // Fall back to in-page if PiP fails
        });
      }
    } else if (!isMinimized && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [isMinimized]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pipWindow) {
        pipWindow.close();
      }
    };
  }, [pipWindow]);

  const content = (
    <div className="flex flex-col h-full bg-[#0A0A0B] text-white overflow-hidden select-none" style={{
      width: pipWindow ? "100%" : `${minimizedSize.width}px`,
      height: pipWindow ? "100%" : `${minimizedSize.height}px`
    }}>
      {/* Header / Title Bar - acts as DRAG HANDLE for fallback only */}
      <div
        onMouseDown={!pipWindow ? handleDragMouseDown : undefined}
        onTouchStart={!pipWindow ? handleDragMouseDown : undefined}
        className={`px-3 py-1.5 bg-[#121214] border-b border-zinc-900 flex items-center justify-between shrink-0 text-zinc-400 hover:bg-[#151518] transition-colors ${!pipWindow ? "cursor-move active:cursor-grabbing" : ""}`}
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
            onClick={() => {
              if (pipWindow) pipWindow.close();
              setIsMinimized(false);
            }}
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

        {/* Responsive Quick Note Creator */}
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
              {brainDumps.length} notes
            </span>
          </div>
        </div>
      </div>

      {/* Drag Handle in corner for Resize (only for fallback) */}
      {!pipWindow && (
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
      )}
    </div>
  );

  if (!isMinimized || !["focusing", "paused", "interval_break", "guilt_free_break"].includes(focusState)) {
    return null;
  }

  if (pipWindow && pipContainerRef.current) {
    return createPortal(content, pipContainerRef.current);
  }

  // Fallback to in-page PiP
  return (
    <AnimatePresence>
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
        className="fixed z-[9999] border-2 border-zinc-850 shadow-[0_15px_50px_rgba(0,0,0,0.85)] rounded-lg overflow-hidden flex flex-col"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
