import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AgentEvent } from '../hooks/useSSE';

export interface LoadingPipelineStep {
  id: string;
  text: string;
  agent: string;
  stage: number;
  agentMatches: string[];
}

export interface LoadingPipelineConfig {
  title: string;
  subtitle: string;
  traceLabel: string;
  steps: LoadingPipelineStep[];
  footer?: string;
}

const taxPipelineSteps: LoadingPipelineStep[] = [
  {
    id: 'input',
    text: 'Extracting salary structure...',
    agent: 'InputCollector • Gemini Flash',
    stage: 1,
    agentMatches: ['InputCollector'],
  },
  {
    id: 'old-regime',
    text: 'Computing Old Regime tax...',
    agent: 'OldRegimeCalc • Deterministic',
    stage: 2,
    agentMatches: ['OldRegimeCalc'],
  },
  {
    id: 'new-regime',
    text: 'Computing New Regime tax...',
    agent: 'NewRegimeCalc • Deterministic',
    stage: 2,
    agentMatches: ['NewRegimeCalc'],
  },
  {
    id: 'optimizer',
    text: 'Analysing missed deductions...',
    agent: 'TaxOptimizer • Gemini Pro',
    stage: 3,
    agentMatches: ['TaxOptimizer'],
  },
  {
    id: 'compliance',
    text: 'Running compliance check...',
    agent: 'ComplianceChecker • Gemini Flash',
    stage: 4,
    agentMatches: ['ComplianceChecker'],
  },
  {
    id: 'disclaimer',
    text: 'Finalizing report...',
    agent: 'DisclaimerInjector • Gemini Flash',
    stage: 4,
    agentMatches: ['DisclaimerInjector'],
  },
];

const taxLoadingConfig: LoadingPipelineConfig = {
  title: 'ArthaGPT is analysing',
  subtitle: 'Multi-agent tax pipeline executing in real-time.',
  traceLabel: 'InputCollector -> ParallelAgent (Old/New) -> TaxOptimizer -> ComplianceLoop',
  steps: taxPipelineSteps,
  footer: 'Live agent execution trace • Streaming via SSE',
};

// Legacy fallback steps (used when no SSE connection)
const legacySteps = [
  { text: 'Reading your portfolio statement...', agent: 'CASParser API' },
  { text: 'Fetching NAV history for 6 funds...', agent: 'mfapi.in' },
  { text: 'Calculating your true XIRR...', agent: 'Portfolio Agent • Gemini 3.1 Pro' },
  { text: 'Checking for stock overlap...', agent: 'Portfolio Agent • Overlap Analysis' },
  { text: 'Computing tax under both regimes...', agent: 'Tax Agent • Deterministic Engine' },
  { text: 'Building your retirement roadmap...', agent: 'FIRE Agent • Deterministic Engine' },
  { text: 'Generating your personalised report...', agent: 'Narrative Agent • Gemini 3 Flash' },
];

interface StepStatus {
  status: 'pending' | 'running' | 'complete' | 'error';
  latencyMs?: number;
  timestamp?: string;
  error?: string;
}

interface LoadingProps {
  onComplete: () => void;
  /** Optional: SSE events from the pipeline */
  events?: AgentEvent[];
  /** Whether using real SSE or legacy fake animation */
  useRealAgents?: boolean;
  /** Custom pipeline copy and real-agent step mapping */
  pipeline?: LoadingPipelineConfig;
  /** Render as a full-screen loader or a compact in-panel loader */
  layout?: 'fullscreen' | 'panel';
}

function buildInitialStatuses(steps: LoadingPipelineStep[]) {
  return steps.reduce<Record<string, StepStatus>>((acc, step) => {
    acc[step.id] = { status: 'pending' };
    return acc;
  }, {});
}

export function Loading({
  onComplete,
  events = [],
  useRealAgents = false,
  pipeline,
  layout = 'fullscreen',
}: LoadingProps) {
  const activePipeline = pipeline ?? taxLoadingConfig;
  const activeSteps = useRealAgents ? activePipeline.steps : [];
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    () => buildInitialStatuses(activeSteps.length > 0 ? activeSteps : taxPipelineSteps)
  );
  const [legacyStep, setLegacyStep] = useState(0);
  const timestamps = useRef<string[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!useRealAgents) return;

    completedRef.current = false;
    setStepStatuses(buildInitialStatuses(activeSteps.length > 0 ? activeSteps : taxPipelineSteps));
  }, [activeSteps, useRealAgents]);

  useEffect(() => {
    if (!useRealAgents || events.length === 0) return;

    for (const event of events) {
      const step = activeSteps.find((candidate) => candidate.agentMatches.includes(event.agent));
      if (!step) continue;

      setStepStatuses((prev) => {
        const next = { ...prev };

        if (event.type === 'agent_start') {
          next[step.id] = {
            status: 'running',
            timestamp: new Date(event.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
        } else if (event.type === 'agent_complete') {
          next[step.id] = {
            status: 'complete',
            latencyMs: event.latencyMs,
            timestamp: new Date(event.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
        } else if (event.type === 'agent_error') {
          next[step.id] = {
            status: 'error',
            error: event.error,
            timestamp: new Date(event.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          };
        }

        return next;
      });

      if (event.type === 'pipeline_complete' && !completedRef.current) {
        completedRef.current = true;
        setTimeout(onComplete, 500);
      }
    }
  }, [activeSteps, events, onComplete, useRealAgents]);

  useEffect(() => {
    if (useRealAgents) return;

    const interval = setInterval(() => {
      setLegacyStep((prev) => {
        if (prev >= legacySteps.length - 1) {
          clearInterval(interval);
          setTimeout(onComplete, 1000);
          return prev;
        }

        const next = prev + 1;
        timestamps.current[next] = new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return next;
      });
    }, 1200);

    timestamps.current[0] = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return () => clearInterval(interval);
  }, [onComplete, useRealAgents]);

  const steps = useRealAgents ? activeSteps : legacySteps;
  const shellClasses =
    layout === 'panel'
      ? 'flex flex-col items-center justify-center w-full px-4 py-10'
      : 'flex flex-col items-center justify-center min-h-screen p-6 max-w-xl mx-auto w-full';

  const getStepState = (index: number) => {
    if (useRealAgents) {
      const step = activeSteps[index];
      const status = stepStatuses[step?.id];
      return {
        isCompleted: status?.status === 'complete',
        isCurrent: status?.status === 'running',
        isError: status?.status === 'error',
        latencyMs: status?.latencyMs,
        timestamp: status?.timestamp,
        error: status?.error,
      };
    }

    return {
      isCompleted: index < legacyStep,
      isCurrent: index === legacyStep,
      isError: false,
      latencyMs: undefined,
      timestamp: timestamps.current[index],
      error: undefined,
    };
  };

  return (
    <div className={shellClasses}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={layout === 'panel' ? 'w-full max-w-4xl space-y-8' : 'w-full space-y-8'}
      >
        <div className="text-center space-y-3 mb-12">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 mb-4"
          >
            <Sparkles className="w-8 h-8 text-gold-500" />
          </motion.div>
          <h2 className="text-3xl font-semibold text-white">{useRealAgents ? activePipeline.title : 'ArthaGPT is analysing'}</h2>
          <p className="text-slate-400">
            {useRealAgents ? activePipeline.subtitle : 'Our multi-agent system is processing your financial life.'}
          </p>
          <p className="text-xs text-slate-600 font-mono">
            {useRealAgents ? activePipeline.traceLabel : 'Orchestrator -> 3 Specialist Agents -> Output Agents'}
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const state = getStepState(index);
            const { isCompleted, isCurrent, isError, latencyMs, timestamp, error } = state;
            const stepText = 'text' in step ? step.text : '';
            const agentText = 'agent' in step ? step.agent : '';

            return (
              <motion.div
                key={stepText}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border transition-all duration-500',
                  isError
                    ? 'bg-coral-500/10 border-coral-500/30'
                    : isCompleted
                      ? 'bg-navy-900/50 border-gold-500/20'
                      : isCurrent
                        ? 'bg-navy-800 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                        : 'bg-transparent border-transparent opacity-30'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors duration-500',
                    isError
                      ? 'bg-coral-500/10 text-coral-500'
                      : isCompleted
                        ? 'bg-gold-500/10 text-gold-500'
                        : isCurrent
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'text-slate-700'
                  )}
                >
                  {isError ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'font-medium text-sm block',
                      isError
                        ? 'text-coral-400'
                        : isCompleted
                          ? 'text-slate-200'
                          : isCurrent
                            ? 'text-white'
                            : 'text-slate-500'
                    )}
                  >
                    {stepText}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">{agentText}</span>
                  {isError && error && <span className="text-[10px] text-coral-400 block mt-1">{error}</span>}
                </div>

                <div className="text-right shrink-0">
                  {(isCompleted || isCurrent || isError) && timestamp && (
                    <span className="text-[10px] font-mono text-slate-600 block">{timestamp}</span>
                  )}
                  {isCompleted && latencyMs !== undefined && (
                    <span className="text-[10px] font-mono text-gold-500/70 block">{latencyMs}ms</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-600">
            {useRealAgents ? activePipeline.footer || 'Live agent execution trace • Streaming via SSE' : 'Total processing time: ~8 seconds'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
