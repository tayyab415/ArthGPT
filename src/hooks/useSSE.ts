import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Agent event from the SSE stream.
 */
export interface AgentEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'pipeline_complete';
  agent: string;
  stage: number;
  latencyMs?: number;
  data?: unknown;
  error?: string;
  timestamp: string;
}

/**
 * SSE connection state.
 */
export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'complete';

/**
 * FIRE pipeline input.
 */
export interface FireInput {
  age: number;
  retireAge: number;
  income: number;
  existingMfCorpus: number;
  existingPpfCorpus: number;
  targetMonthlyDraw: number;
  declaredLifeCover: number;
  monthlySipCurrent: number;
}

export interface FireMacroSource {
  label: string;
  url?: string;
  retrievedAt?: string;
}

export interface FireMacroMetric {
  value: number;
  asOf: string;
  sourceLabel: string;
  sourceUrl?: string;
  notes?: string;
}

export interface FireMacroParameters {
  repoRate: FireMacroMetric;
  inflationRate: FireMacroMetric;
  niftyMeanReturn: FireMacroMetric;
  niftyStdDev: FireMacroMetric;
  bondYield: FireMacroMetric;
  fdRate: FireMacroMetric;
  asOf: string;
  sourceMode: 'live' | 'fallback' | 'mixed';
  sources?: FireMacroSource[];
}

export interface FirePercentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloShortfallAnalysis {
  averageShortfall?: number;
  averageDepletionAge?: number;
  failingSimulations?: number;
}

export interface MonteCarloResults {
  iterations: number;
  seed: number;
  targetCorpusAtRetirement: number;
  successProbability: number;
  retirementCorpusPercentiles: FirePercentiles;
  fanChartData?: Array<Record<string, unknown>>;
  shortfallAnalysis?: MonteCarloShortfallAnalysis;
}

export interface SipPlan {
  medianSipRequired: number;
  safetySipRequired: number;
  stepUpRate?: number;
  firstYearMonthlyPlan?: Array<{ month: number; sip?: number; amount?: number; note?: string; equity?: number; debt?: number }>;
  glidepath?: Array<{ age: number; equity: number; debt: number }>;
}

export interface InsuranceGaps {
  requiredLifeCover: number;
  declaredLifeCover: number;
  lifeCoverGap: number;
  recommendedHealthCover?: number;
}

export interface FireRoadmapAction {
  title: string;
  detail?: string;
  amount?: number;
  impact: string;
  timeframe: string;
}

export interface FireRoadmapTimelineItem {
  title: string;
  detail: string;
  timeframe?: string;
  milestone?: string;
}

export interface FireRoadmap {
  headline: string;
  narrative: string;
  probabilityInterpretation?: string;
  recommendedActions?: FireRoadmapAction[];
  timeline?: FireRoadmapTimelineItem[];
  disclaimer?: string;
}

export interface FireSummary {
  successProbability: number;
  p10Corpus: number;
  p50Corpus: number;
  p90Corpus: number;
  medianSipRequired: number;
  safetySipRequired: number;
  insuranceGap: number;
  macroAsOf?: string;
  macroSourceMode?: string;
  roadmapHeadline?: string;
  probabilityInterpretation?: string;
  narrative?: string;
}

export interface FirePipelineResult {
  fire_summary?: FireSummary;
  monte_carlo_results?: MonteCarloResults;
  sip_plan?: SipPlan;
  insurance_gaps?: InsuranceGaps;
  fire_roadmap?: FireRoadmap;
  macro_parameters?: FireMacroParameters;
  compliant_narrative?: string;
  execution_log?: unknown[];
}

/**
 * Options for useSSE hook.
 */
interface UseSSEOptions<T> {
  url: string;
  body: T;
  onEvent?: (event: AgentEvent) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

/**
 * Return type of useSSE hook.
 */
interface UseSSEResult {
  status: SSEStatus;
  events: AgentEvent[];
  result: unknown | null;
  error: string | null;
  start: () => void;
  abort: () => void;
}

async function consumeStream<T>(options: {
  url: string;
  body: T;
  signal: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  onConnected?: () => void;
}): Promise<void> {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  options.onConnected?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6).trim();
      if (!data) continue;

      try {
        const event = JSON.parse(data) as AgentEvent;
        options.onEvent?.(event);
      } catch {
        console.warn('Failed to parse SSE data:', data);
      }
    }
  }
}

/**
 * Hook to consume SSE events from a pipeline endpoint.
 */
export function useSSE<T>(options: UseSSEOptions<T>): UseSSEResult {
  const { url, body, onEvent, onComplete, onError } = options;

  const [status, setStatus] = useState<SSEStatus>('idle');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    setStatus('connecting');
    setEvents([]);
    setResult(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      await consumeStream({
        url,
        body,
        signal: abortControllerRef.current.signal,
        onConnected: () => setStatus('connected'),
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);
          onEvent?.(event);

          if (event.type === 'pipeline_complete') {
            setResult(event.data);
            setStatus('complete');
            onComplete?.(event.data);
          } else if (event.type === 'agent_error') {
            setError(event.error || 'Unknown error');
            onError?.(event.error || 'Unknown error');
          }
        },
      });

      if (!abortControllerRef.current.signal.aborted) {
        setStatus('complete');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus('idle');
        return;
      }

      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
    }
  }, [body, onComplete, onError, onEvent, url]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    status,
    events,
    result,
    error,
    start,
    abort,
  };
}

export function useTaxPipeline() {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (input: {
    baseSalary: number;
    hraReceived: number;
    rentPaid?: number;
    section80C?: number;
    section80CCD1B?: number;
    section80D?: number;
    homeLoanInterest?: number;
    isMetro?: boolean;
  }) => {
    setStatus('connecting');
    setEvents([]);
    setResult(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      await consumeStream({
        url: '/api/v2/tax-pipeline',
        body: input,
        signal: abortControllerRef.current.signal,
        onConnected: () => setStatus('connected'),
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === 'pipeline_complete') {
            setResult(event.data);
            setStatus('complete');
          } else if (event.type === 'agent_error') {
            setError(event.error || 'Unknown error');
          }
        },
      });

      if (!abortControllerRef.current.signal.aborted) {
        setStatus('complete');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus('idle');
        return;
      }

      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    status,
    events,
    result,
    error,
    execute,
    abort,
    isLoading: status === 'connecting' || status === 'connected',
    isComplete: status === 'complete',
    isError: status === 'error',
  };
}

export function usePortfolioPipeline() {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (input: {
    funds: Array<{
      name: string;
      units: number;
      nav: number;
      investedAmount?: number;
    }>;
    riskProfile: 'Conservative' | 'Moderate' | 'Aggressive';
    investmentHorizon?: string;
  }) => {
    setStatus('connecting');
    setEvents([]);
    setResult(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      await consumeStream({
        url: '/api/v2/portfolio-pipeline',
        body: input,
        signal: abortControllerRef.current.signal,
        onConnected: () => setStatus('connected'),
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === 'pipeline_complete') {
            setResult(event.data);
            setStatus('complete');
          } else if (event.type === 'agent_error') {
            setError(event.error || 'Unknown error');
          }
        },
      });

      if (!abortControllerRef.current.signal.aborted) {
        setStatus('complete');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus('idle');
        return;
      }

      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getStageEvents = useCallback((stage: number) => {
    return events.filter((event) => event.stage === stage);
  }, [events]);

  const isStage2Complete = useCallback(() => {
    const stage2Agents = ['XirrEngine', 'OverlapAgent', 'ExpenseAgent', 'BenchmarkAgent'];
    const completedAgents = events
      .filter((event) => event.type === 'agent_complete' && event.stage === 2)
      .map((event) => event.agent);

    return stage2Agents.every((agent) => completedAgents.includes(agent));
  }, [events]);

  return {
    status,
    events,
    result,
    error,
    execute,
    abort,
    getStageEvents,
    isStage2Complete,
    isLoading: status === 'connecting' || status === 'connected',
    isComplete: status === 'complete',
    isError: status === 'error',
  };
}

export function useFirePipeline() {
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<FirePipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (input: FireInput) => {
    setStatus('connecting');
    setEvents([]);
    setResult(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      await consumeStream({
        url: '/api/v2/fire-pipeline',
        body: input,
        signal: abortControllerRef.current.signal,
        onConnected: () => setStatus('connected'),
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === 'pipeline_complete') {
            setResult(event.data as FirePipelineResult);
            setStatus('complete');
          } else if (event.type === 'agent_error') {
            setError(event.error || 'Unknown error');
          }
        },
      });

      if (!abortControllerRef.current.signal.aborted) {
        setStatus('complete');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStatus('idle');
        return;
      }

      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getStageEvents = useCallback((stage: number) => {
    return events.filter((event) => event.stage === stage);
  }, [events]);

  return {
    status,
    events,
    result,
    error,
    execute,
    abort,
    getStageEvents,
    isLoading: status === 'connecting' || status === 'connected',
    isComplete: status === 'complete',
    isError: status === 'error',
  };
}
