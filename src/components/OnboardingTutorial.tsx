import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  Zap, 
  Layers, 
  Clock, 
  Compass, 
  Target 
} from "lucide-react";

interface OnboardingTutorialProps {
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
}

interface Step {
  title: string;
  tagline: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
}

export default function OnboardingTutorial({ onComplete, onSkip }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const steps: Step[] = [
    {
      title: "Welcome to FocusOn",
      tagline: "Serene ADHD-first deep work companion",
      description: "Focus is not a rigid mental cage—it's a dynamic flow. FocusOn is crafted to reduce start friction, track drift cycles without shame, and guide you gently back to key flow states.",
      badge: "PHILOSOPHY",
      icon: <Sparkles className="w-8 h-8 text-yellow-400" />
    },
    {
      title: "Target & Micro-Steps",
      tagline: "Break the starting friction instantly",
      description: "Cognitive overload happens when tasks are too large. FocusOn forces you to declare a single, concrete Target, and then slice it into a single 'ADHD Molecular Step'. Focus solely on completing this single, tiny draft step first.",
      badge: "STEP 1 OF 4",
      icon: <Target className="w-8 h-8 text-red-400" />
    },
    {
      title: "Drift Tracking & Recovery",
      tagline: "Dopamine-regulated non-punitive cycles",
      description: "Getting distracted is natural. When a distraction occurs, log your 'Drift Choice' (learning, break, or return). We track your recovery and help you re-anchor without making you feel guilty.",
      badge: "STEP 2 OF 4",
      icon: <Zap className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Isolate & Track Projects",
      tagline: "Structured registries for mental focus",
      description: "Organize your focus sessions under color-coded Projects. Set weekly allocation goals, track progress logs, and export your historical focus logs securely as CSV or JSON format anytime.",
      badge: "STEP 3 OF 4",
      icon: <Layers className="w-8 h-8 text-blue-400" />
    },
    {
      title: "visual Atmosphere & Overdrive",
      tagline: "Tailor the interface to your natural rhythm",
      description: "Toggle Overdrive Mode in settings for low-friction 20-minute defaults, or shift visual themes between 'Dark Butterfly' and 'Light Butterfly' to protect your visual endurance.",
      badge: "STEP 4 OF 4",
      icon: <Clock className="w-8 h-8 text-green-400" />
    }
  ];

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsSubmitting(true);
      await onComplete();
      setIsSubmitting(false);
    }
  };

  const handleSkipClick = async () => {
    setIsSubmitting(true);
    await onSkip();
    setIsSubmitting(false);
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#121212] border border-[#222222] shadow-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden"
        id="onboarding-tutorial-modal"
      >
        {/* Step progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1A1A1A]">
          <div 
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content View */}
        <div className="flex-1 flex flex-col justify-between mt-4">
          
          {/* Header block */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono tracking-widest text-[#888888] uppercase font-bold">
              {step.badge}
            </span>
            <button
              onClick={handleSkipClick}
              disabled={isSubmitting}
              className="text-[10px] font-mono tracking-wider text-zinc-400 hover:text-white uppercase transition-colors cursor-pointer"
            >
              Skip Tour
            </button>
          </div>

          {/* Core Body with sliding animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="my-6 text-left space-y-4"
            >
              <div className="inline-flex p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                {step.icon}
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                {step.title}
              </h3>
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest leading-relaxed">
                {step.tagline}
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Bottom controls */}
          <div className="flex items-center justify-between border-t border-zinc-900 pt-5 mt-2">
            
            {/* Dots indicator */}
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === currentStep ? "bg-white scale-125" : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            {/* Buttons action */}
            <div className="flex items-center gap-3">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-mono tracking-wider uppercase border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-white text-black font-mono font-bold text-xs tracking-wider uppercase hover:bg-zinc-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{currentStep === steps.length - 1 ? "Finish" : "Next"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
}
