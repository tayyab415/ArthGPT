import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Cpu, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AgentEvent } from '../hooks/useSSE';

interface AgentExecutionLogProps {
  events: AgentEvent[];
  isLoading?: boolean;
}

/**
 * Displays the execution trace from the tax pipeline.
 * Shows "Show Your Math" details for each agent stage.
 */
export function AgentExecutionLog({ events, isLoading = false }: AgentExecutionLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (events.length === 0 && !isLoading) {
    return null;
  }

  // Group events by agent
  const agentGroups = new Map<string, { start?: AgentEvent; complete?: AgentEvent; error?: AgentEvent }>();
  
  for (const event of events) {
    if (event.agent === 'Pipeline') continue;
    
    if (!agentGroups.has(event.agent)) {
      agentGroups.set(event.agent, {});
    }
    
    const group = agentGroups.get(event.agent)!;
    if (event.type === 'agent_start') group.start = event;
    else if (event.type === 'agent_complete') group.complete = event;
    else if (event.type === 'agent_error') group.error = event;
  }

  // Calculate total pipeline time
  const pipelineComplete = events.find(e => e.type === 'pipeline_complete');
  const firstEvent = events.find(e => e.type === 'agent_start');
  let totalTime: number | undefined;
  
  if (pipelineComplete && firstEvent) {
    totalTime = new Date(pipelineComplete.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();
  }

  // Get agent type label
  const getAgentType = (agent: string): { type: string; icon: React.ElementType; color: string } => {
    if (agent.includes('Regime')) {
      return { type: 'Deterministic', icon: Cpu, color: 'teal' };
    }
    if (agent.includes('Collector') || agent.includes('Checker') || agent.includes('Injector')) {
      return { type: 'LLM (Flash)', icon: Zap, color: 'blue' };
    }
    if (agent.includes('Optimizer')) {
      return { type: 'LLM (Pro)', icon: Zap, color: 'gold' };
    }
    return { type: 'Agent', icon: Cpu, color: 'slate' };
  };

  return (
    <div className="border border-navy-700 rounded-xl overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-navy-800 hover:bg-navy-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-white">Agent Execution Trace</span>
          {totalTime !== undefined && (
            <span className="text-xs font-mono text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded">
              {totalTime}ms total
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-navy-900 border-t border-navy-700"
          >
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 mb-4">
                Real-time execution trace showing each agent's processing time and status.
              </p>

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-navy-700" />

                <div className="space-y-3">
                  {Array.from(agentGroups.entries()).map(([agent, group]) => {
                    const { type, icon: Icon, color } = getAgentType(agent);
                    const hasError = !!group.error;
                    const isComplete = !!group.complete;
                    const isRunning = !!group.start && !isComplete && !hasError;

                    return (
                      <div key={agent} className="flex items-start gap-4 pl-2">
                        {/* Timeline dot */}
                        <div className={cn(
                          "relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          hasError 
                            ? "bg-coral-500/20 text-coral-500"
                            : isComplete 
                              ? "bg-gold-500/20 text-gold-500"
                              : isRunning
                                ? "bg-blue-500/20 text-blue-500"
                                : "bg-navy-700 text-slate-500"
                        )}>
                          {hasError ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : isComplete ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : isRunning ? (
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-600" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-white">{agent}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-mono",
                              `bg-${color}-500/10 text-${color}-500`
                            )}>
                              {type}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            {group.start && (
                              <span className="text-slate-500 font-mono">
                                Started: {new Date(group.start.timestamp).toLocaleTimeString([], {
                                  hour12: false,
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  fractionalSecondDigits: 3,
                                })}
                              </span>
                            )}
                            {group.complete && group.complete.latencyMs !== undefined && (
                              <span className="text-gold-500 font-mono font-medium">
                                {group.complete.latencyMs}ms
                              </span>
                            )}
                            {hasError && group.error?.error && (
                              <span className="text-coral-400">
                                Error: {group.error.error}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Stats */}
              {totalTime !== undefined && (
                <div className="mt-6 pt-4 border-t border-navy-800">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500">Agents</p>
                      <p className="text-lg font-mono text-white">{agentGroups.size}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">LLM Calls</p>
                      <p className="text-lg font-mono text-white">
                        {Array.from(agentGroups.keys()).filter(a => 
                          a.includes('Collector') || a.includes('Optimizer') || 
                          a.includes('Checker') || a.includes('Injector')
                        ).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Time</p>
                      <p className="text-lg font-mono text-gold-500">{totalTime}ms</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Parallelism Note */}
              {agentGroups.has('OldRegimeCalc') && agentGroups.has('NewRegimeCalc') && (
                <div className="mt-4 p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <p className="text-xs text-teal-400">
                    <strong>Parallelism Detected:</strong> OldRegimeCalc and NewRegimeCalc ran concurrently via ParallelAgent, 
                    reducing total computation time.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
