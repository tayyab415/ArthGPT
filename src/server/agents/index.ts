// Core agent framework
export { Agent, DeterministicAgent, LlmAgent } from './core/Agent';
export { SequentialAgent } from './core/SequentialAgent';
export { ParallelAgent } from './core/ParallelAgent';
export { LoopAgent, createComplianceExitCondition } from './core/LoopAgent';
export { 
  SessionState, 
  createTaxSessionState,
  createPortfolioSessionState,
  createFireSessionState,
  type TaxSessionState,
  type PortfolioSessionState,
  type FireSessionState,
  type PortfolioInput,
  type PortfolioData,
  type PortfolioFund,
  type XirrResults,
  type OverlapData,
  type ExpenseAnalysis,
  type BenchmarkComparison,
  type RebalancingPlan,
  type RebalancingRecommendation,
  type ConfidenceLevel,
  type AgentEvent,
  type AgentLogEntry,
  type SalaryStructure,
  type TaxOptimization,
  type MissedDeduction,
  type TaxSavingSuggestion,
  type ComplianceViolation,
  type EventCallback,
  type FireInput,
  type FireInputs,
  type MacroParameters,
  type MonteCarloResults,
  type SipPlan,
  type InsuranceGaps,
  type FireRoadmap,
  type FireSummary,
} from './core/SessionState';

// Tax pipeline agents
export { InputCollectorAgent } from './tax/InputCollectorAgent';
export { OldRegimeAgent } from './tax/OldRegimeAgent';
export { NewRegimeAgent } from './tax/NewRegimeAgent';
export { TaxOptimizerAgent } from './tax/TaxOptimizerAgent';
export { ComplianceCheckerAgent } from './tax/ComplianceCheckerAgent';
export { DisclaimerInjectorAgent } from './tax/DisclaimerInjectorAgent';
export { TaxPipeline, taxPipeline } from './tax/TaxPipeline';

// Portfolio pipeline agents
export { IngestionAgent } from './portfolio/IngestionAgent';
export { XirrAgent } from './portfolio/XirrAgent';
export { OverlapAgent } from './portfolio/OverlapAgent';
export { ExpenseAgent } from './portfolio/ExpenseAgent';
export { BenchmarkAgent } from './portfolio/BenchmarkAgent';
export { RebalancingStrategistAgent } from './portfolio/RebalancingStrategistAgent';
export { PortfolioPipeline, portfolioPipeline } from './portfolio/PortfolioPipeline';

// FIRE pipeline agents
export { GoalProfilerAgent } from './fire/GoalProfilerAgent';
export { MacroAgent } from './fire/MacroAgent';
export { MonteCarloAgent } from './fire/MonteCarloAgent';
export { SipGlidepathAgent } from './fire/SipGlidepathAgent';
export { InsuranceGapAgent } from './fire/InsuranceGapAgent';
export { RoadmapBuilderAgent } from './fire/RoadmapBuilderAgent';
export { FirePipeline, firePipeline } from './fire/FirePipeline';

// Gemini utilities
export { extractSalaryStructure, generateTaxOptimization, checkCompliance, injectDisclaimer, MODELS } from './utils/gemini';
export { extractPortfolioData, generateRebalancingPlan, generateFallbackRebalancingPlan } from './utils/portfolioGemini';
