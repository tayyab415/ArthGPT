import type { TaxInput, TaxResult } from '../../taxEngine';

export type { TaxResult };

// Agent event types for SSE streaming
export interface AgentEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'pipeline_complete';
  agent: string;
  stage: number;
  latencyMs?: number;
  data?: unknown;
  error?: string;
  timestamp: string;
}

// Execution log entry for "Show Your Math"
export interface AgentLogEntry {
  agent: string;
  stage: number;
  startTime: string;
  endTime?: string;
  latencyMs?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

// Missed deduction suggestion
export interface MissedDeduction {
  section: string;
  currentAmount: number;
  maxAmount: number;
  missedAmount: number;
  potentialSaving: number;
  description: string;
}

// Tax saving instrument suggestion
export interface TaxSavingSuggestion {
  instrument: string;
  section: string;
  maxBenefit: number;
  lockIn: string;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

// Compliance violation
export interface ComplianceViolation {
  type: string;
  location: string;
  description: string;
  severity: 'warning' | 'error';
}

// Structured salary data (extracted by InputCollector)
export interface SalaryStructure {
  baseSalary: number;
  hraReceived: number;
  rentPaid: number;
  section80C: number;
  section80CCD1B: number;
  section80D: number;
  homeLoanInterest: number;
  isMetro: boolean;
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes?: string;
}

// Tax optimization result (from TaxOptimizer agent)
export interface TaxOptimization {
  winner: 'old' | 'new';
  savings: number;
  missedDeductions: MissedDeduction[];
  narrative: string;
  suggestions: TaxSavingSuggestion[];
  disclaimer: string;
}

// Full Tax Pipeline session state
export interface TaxSessionState {
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;

  // Input (written by InputCollector)
  raw_input: TaxInput;
  salary_structure?: SalaryStructure;

  // Stage 2 outputs (written by ParallelAgent)
  old_tax_result?: TaxResult;
  new_tax_result?: TaxResult;

  // Stage 3 output (written by TaxOptimizer)
  tax_optimization?: TaxOptimization;

  // Stage 4 output (written by Compliance Loop)
  compliance_status?: 'CLEAN' | ComplianceViolation[];
  compliant_narrative?: string;

  // Execution trace (for "Show Your Math")
  execution_log: AgentLogEntry[];

  // Pipeline metadata
  pipeline_start?: string;
  pipeline_end?: string;
  total_latency_ms?: number;
}

// Event emitter callback type
export type EventCallback = (event: AgentEvent) => void;

/**
 * SessionState manages the shared state passed between agents in a pipeline.
 * It also handles event emission for SSE streaming.
 */
export class SessionState<T extends Record<string, unknown> = TaxSessionState> {
  private state: T;
  private eventCallbacks: EventCallback[] = [];

  constructor(initialState: Partial<T> = {}) {
    this.state = {
      execution_log: [],
      ...initialState,
    } as unknown as T;
  }

  /**
   * Get a value from session state
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.state[key];
  }

  /**
   * Set a value in session state
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.state[key] = value;
  }

  /**
   * Get the full state object
   */
  getAll(): T {
    return { ...this.state };
  }

  /**
   * Merge partial state updates
   */
  merge(updates: Partial<T>): void {
    Object.assign(this.state, updates);
  }

  /**
   * Add an execution log entry
   */
  addLogEntry(entry: AgentLogEntry): void {
    const log = (this.state as unknown as TaxSessionState).execution_log;
    if (Array.isArray(log)) {
      log.push(entry);
    }
  }

  /**
   * Update the latest unfinished matching log entry.
   * This avoids corrupting logs when multiple agents complete in parallel.
   */
  updateLogEntry(agent: string, stage: number, updates: Partial<AgentLogEntry>): void {
    const log = (this.state as unknown as TaxSessionState).execution_log;
    if (!Array.isArray(log) || log.length === 0) {
      return;
    }

    for (let i = log.length - 1; i >= 0; i -= 1) {
      const entry = log[i];
      if (entry.agent === agent && entry.stage === stage && !entry.endTime) {
        Object.assign(entry, updates);
        return;
      }
    }
  }

  /**
   * Register an event callback for SSE streaming
   */
  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove an event callback
   */
  offEvent(callback: EventCallback): void {
    this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Emit an event to all registered callbacks
   */
  emit(event: AgentEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (e) {
        console.error('[SessionState] Event callback error:', e);
      }
    }
  }

  /**
   * Emit agent start event
   */
  emitAgentStart(agent: string, stage: number): void {
    const timestamp = new Date().toISOString();
    this.addLogEntry({
      agent,
      stage,
      startTime: timestamp,
    });
    this.emit({
      type: 'agent_start',
      agent,
      stage,
      timestamp,
    });
  }

  /**
   * Emit agent complete event
   */
  emitAgentComplete(agent: string, stage: number, latencyMs: number, data?: unknown): void {
    const timestamp = new Date().toISOString();
    this.updateLogEntry(agent, stage, {
      endTime: timestamp,
      latencyMs,
      outputs: data as Record<string, unknown>,
    });
    this.emit({
      type: 'agent_complete',
      agent,
      stage,
      latencyMs,
      data,
      timestamp,
    });
  }

  /**
   * Emit agent error event
   */
  emitAgentError(agent: string, stage: number, error: string): void {
    const timestamp = new Date().toISOString();
    this.updateLogEntry(agent, stage, {
      endTime: timestamp,
      error,
    });
    this.emit({
      type: 'agent_error',
      agent,
      stage,
      error,
      timestamp,
    });
  }

  /**
   * Emit pipeline complete event
   */
  emitPipelineComplete(): void {
    const timestamp = new Date().toISOString();
    this.emit({
      type: 'pipeline_complete',
      agent: 'Pipeline',
      stage: 0,
      data: this.getAll(),
      timestamp,
    });
  }
}

/**
 * Create a new TaxSessionState with initial raw input
 */
export function createTaxSessionState(rawInput: TaxInput): SessionState<TaxSessionState> {
  return new SessionState<TaxSessionState>({
    raw_input: rawInput,
    execution_log: [],
    pipeline_start: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Portfolio Pipeline Types
// ═══════════════════════════════════════════════════════════════════════════

// Confidence level for data provenance
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// Raw portfolio input (from frontend)
export interface PortfolioInput {
  funds: Array<{
    name: string;
    units: number;
    nav: number;
    investedAmount?: number;
  }>;
  riskProfile: 'Conservative' | 'Moderate' | 'Aggressive';
  investmentHorizon?: string;
}

// Structured portfolio data (after ingestion)
export interface PortfolioData {
  funds: PortfolioFund[];
  totalValue: number;
  riskProfile: string;
  extractionConfidence: ConfidenceLevel;
}

export interface PortfolioFund {
  name: string;
  units: number;
  nav: number;
  currentValue: number;
  investedAmount: number;
  planType: 'Regular' | 'Direct';
  category: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Flexi Cap' | 'Multi Cap' | 'Index' | 'Other';
  amc: string;
  isin?: string;
  schemeCode?: number;
  dataSource?: 'mfapi' | 'mock';
}

// Cashflow for XIRR calculation
export interface Cashflow {
  date: string;
  amount: number;
  type: 'investment' | 'redemption' | 'current_value';
}

// XIRR results (Stage 2A)
export interface XirrResults {
  portfolioXirr: number;
  fundXirrs: Array<{
    fund: string;
    xirr: number;
    cashflows: Cashflow[];
  }>;
  calculationTrace: string;
}

// Overlap data (Stage 2B)
export interface OverlapData {
  totalOverlappingStocks: number;
  overlapMatrix: Array<{
    stock: string;
    funds: string[];
    combinedWeight: number;
    confidence: ConfidenceLevel;
  }>;
  concentrationRisk: string;
  confidence: ConfidenceLevel;
  amcConcentrationWarnings?: string[];
}

// Expense analysis (Stage 2C)
export interface ExpenseAnalysis {
  totalExpenseDrag: number;
  fundExpenses: Array<{
    fund: string;
    regularER: number;
    directER: number;
    annualDrag: number;
    switchRecommended: boolean;
    confidence: ConfidenceLevel;
  }>;
}

// Benchmark comparison (Stage 2D)
export interface BenchmarkComparison {
  funds: Array<{
    fund: string;
    category: string;
    benchmark: string;
    fund1Y: number;
    benchmark1Y: number;
    fund3Y: number;
    benchmark3Y: number;
    underperformer: boolean;
    confidence: ConfidenceLevel;
  }>;
}

// Rebalancing recommendation
export interface RebalancingRecommendation {
  fundToRedeem: string;
  units: number;
  currentValue: number;
  holdingPeriod: string;
  taxImplication: 'STCG' | 'LTCG' | 'No Tax';
  estimatedTax: number;
  fundToInvest: string;
  reason: string;
  expenseBenefit: string;
  overlapReduction: string;
}

// Rebalancing plan (Stage 3)
export interface RebalancingPlan {
  recommendations: RebalancingRecommendation[];
  narrative: string;
  totalExpectedSavings: number;
  disclaimer: string;
}

// Full Portfolio Pipeline session state
export interface PortfolioSessionState {
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;

  // Input (from frontend)
  raw_input: PortfolioInput;

  // Stage 1 output (written by IngestionAgent)
  portfolio_data?: PortfolioData;

  // Stage 2 outputs (written by ParallelAgent)
  xirr_results?: XirrResults;
  overlap_data?: OverlapData;
  expense_analysis?: ExpenseAnalysis;
  benchmark_comparison?: BenchmarkComparison;

  // Stage 3 output (written by RebalancingStrategist)
  rebalancing_plan?: RebalancingPlan;

  // Stage 4 output (written by Compliance Loop)
  compliance_status?: 'CLEAN' | ComplianceViolation[];
  compliant_plan?: string;

  // Execution trace (for "Show Your Math")
  execution_log: AgentLogEntry[];

  // Pipeline metadata
  pipeline_start?: string;
  pipeline_end?: string;
  total_latency_ms?: number;
}

/**
 * Create a new PortfolioSessionState with initial raw input
 */
export function createPortfolioSessionState(rawInput: PortfolioInput): SessionState<PortfolioSessionState> {
  return new SessionState<PortfolioSessionState>({
    raw_input: rawInput,
    execution_log: [],
    pipeline_start: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRE Pipeline Types
// ═══════════════════════════════════════════════════════════════════════════

// Raw FIRE input (from frontend)
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

export interface FireInputs {
  currentAge: number;
  retirementAge: number;
  yearsToRetirement: number;
  annualIncome: number;
  existingMfCorpus: number;
  existingPpfCorpus: number;
  existingCorpus: number;
  currentMonthlySip: number;
  targetMonthlyDrawToday: number;
  declaredLifeCover: number;
  lifeExpectancyAge: number;
}

export interface MacroSource {
  label: string;
  url?: string;
  retrievedAt: string;
}

export interface MacroMetric {
  value: number;
  asOf: string;
  sourceLabel: string;
  sourceUrl?: string;
  notes?: string;
}

export interface MacroParameters {
  repoRate: MacroMetric;
  inflationRate: MacroMetric;
  niftyMeanReturn: MacroMetric;
  niftyStdDev: MacroMetric;
  bondYield: MacroMetric;
  fdRate: MacroMetric;
  asOf: string;
  sourceMode: 'live' | 'mixed' | 'fallback';
  sources: MacroSource[];
  notes?: string;
}

export interface FanChartPoint {
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface ShortfallAnalysis {
  failingSimulations: number;
  averageShortfall: number;
  averageDepletionAge: number | null;
}

export interface MonteCarloResults {
  iterations: number;
  seed: number;
  targetCorpusAtRetirement: number;
  successProbability: number;
  retirementCorpusPercentiles: {
    p10: number;
    p50: number;
    p90: number;
  };
  fanChartData: FanChartPoint[];
  shortfallAnalysis: ShortfallAnalysis;
  calculationTrace: string;
}

export interface GlidepathPoint {
  age: number;
  equity: number;
  debt: number;
}

export interface SipPlanMonth {
  month: number;
  sip: number;
  equity: number;
  debt: number;
}

export interface SipPlan {
  medianSipRequired: number;
  safetySipRequired: number;
  stepUpRate: number;
  firstYearMonthlyPlan: SipPlanMonth[];
  glidepath: GlidepathPoint[];
  notes: string;
}

export interface InsuranceGaps {
  requiredLifeCover: number;
  declaredLifeCover: number;
  lifeCoverGap: number;
  recommendedHealthCover: number;
  summary: string;
}

export interface FireRecommendedAction {
  title: string;
  amount?: number;
  impact: string;
  timeframe: string;
}

export interface FireTimelineItem {
  title: string;
  timeframe: string;
  detail: string;
}

export interface FireRoadmap {
  headline: string;
  narrative: string;
  probabilityInterpretation: string;
  recommendedActions: FireRecommendedAction[];
  timeline: FireTimelineItem[];
}

export interface FireSummary {
  successProbability: number;
  p10Corpus: number;
  p50Corpus: number;
  p90Corpus: number;
  medianSipRequired: number;
  safetySipRequired: number;
  insuranceGap: number;
  macroAsOf: string;
  macroSourceMode: MacroParameters['sourceMode'];
  roadmapHeadline: string;
  roadmapNarrative?: string;
}

export interface FireSessionState {
  [key: string]: unknown;

  raw_input: FireInput;

  fire_inputs?: FireInputs;
  macro_parameters?: MacroParameters;

  monte_carlo_results?: MonteCarloResults;
  sip_plan?: SipPlan;
  insurance_gaps?: InsuranceGaps;

  fire_roadmap?: FireRoadmap;
  fire_summary?: FireSummary;

  compliance_status?: 'CLEAN' | ComplianceViolation[];
  compliant_narrative?: string;

  execution_log: AgentLogEntry[];
  pipeline_start?: string;
  pipeline_end?: string;
  total_latency_ms?: number;
}

export function createFireSessionState(rawInput: FireInput): SessionState<FireSessionState> {
  return new SessionState<FireSessionState>({
    raw_input: rawInput,
    execution_log: [],
    pipeline_start: new Date().toISOString(),
  });
}
