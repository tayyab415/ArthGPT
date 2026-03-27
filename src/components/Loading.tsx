import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

const steps = [
  { text: "Reading your portfolio statement...", agent: "CASParser API" },
  { text: "Fetching NAV history for 6 funds...", agent: "mfapi.in" },
  { text: "Calculating your true XIRR...", agent: "Portfolio Agent • Gemini 3.1 Pro" },
  { text: "Checking for stock overlap...", agent: "Portfolio Agent • Overlap Analysis" },
  { text: "Computing tax under both regimes...", agent: "Tax Agent • Deterministic Engine" },
  { text: "Building your retirement roadmap...", agent: "FIRE Agent • Deterministic Engine" },
  { text: "Generating your personalised report...", agent: "Narrative Agent • Gemini 3 Flash" },
];

export function Loading({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const timestamps = useRef<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setTimeout(onComplete, 1000);
          return prev;
        }
        const next = prev + 1;
        timestamps.current[next] = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
        return next;
      });
    }, 1200);

    timestamps.current[0] = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full space-y-8"
      >
        <div className="text-center space-y-3 mb-12">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 mb-4"
          >
            <Sparkles className="w-8 h-8 text-gold-500" />
          </motion.div>
          <h2 className="text-3xl font-semibold text-white">ArthaGPT is analysing</h2>
          <p className="text-slate-400">Our multi-agent system is processing your financial life.</p>
          <p className="text-xs text-slate-600 font-mono">Orchestrator → 3 Specialist Agents → Output Agents</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <motion.div
                key={step.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all duration-500",
                  isCompleted ? "bg-navy-900/50 border-gold-500/20" : isCurrent ? "bg-navy-800 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : "bg-transparent border-transparent opacity-30"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors duration-500",
                  isCompleted ? "bg-gold-500/10 text-gold-500" : isCurrent ? "bg-blue-500/10 text-blue-500" : "text-slate-700"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-medium text-sm block",
                    isCompleted ? "text-slate-200" : isCurrent ? "text-white" : "text-slate-500"
                  )}>{step.text}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{step.agent}</span>
                </div>

                {(isCompleted || isCurrent) && (
                  <span className="text-[10px] font-mono text-slate-600 shrink-0">
                    {timestamps.current[index] || ''}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-600">Total processing time: ~8 seconds</p>
        </div>
      </motion.div>
    </div>
  );
}
