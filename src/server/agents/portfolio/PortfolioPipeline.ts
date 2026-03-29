import { SequentialAgent } from '../core/SequentialAgent';
import { ParallelAgent } from '../core/ParallelAgent';
import { LoopAgent, createComplianceExitCondition } from '../core/LoopAgent';
import { SessionState, type PortfolioSessionState, createPortfolioSessionState, type PortfolioInput } from '../core/SessionState';
import { IngestionAgent } from './IngestionAgent';
import { XirrAgent } from './XirrAgent';
import { OverlapAgent } from './OverlapAgent';
import { ExpenseAgent } from './ExpenseAgent';
import { BenchmarkAgent } from './BenchmarkAgent';
import { RebalancingStrategistAgent } from './RebalancingStrategistAgent';
// Reuse compliance agents from tax pipeline
import { ComplianceCheckerAgent } from '../tax/ComplianceCheckerAgent';
import { DisclaimerInjectorAgent } from '../tax/DisclaimerInjectorAgent';

/**
 * Portfolio Pipeline Orchestrator
 * 
 * Implements the multi-agent Portfolio X-Ray pipeline as a SequentialAgent with nested structures:
 * 
 * Stage 1: IngestionAgent (LlmAgent)
 *     ↓
 * Stage 2: ParallelAgent (4-way fan-out)
 *     ├── XirrEngine (DeterministicAgent)
 *     ├── OverlapAgent (LlmAgent)
 *     ├── ExpenseAgent (LlmAgent)
 *     └── BenchmarkAgent (LlmAgent)
 *     ↓
 * Stage 3: RebalancingStrategist (LlmAgent)
 *     ↓
 * Stage 4: LoopAgent (max 2 iterations)
 *     ├── ComplianceChecker (reused from Tax)
 *     └── DisclaimerInjector (reused from Tax)
 */
export class PortfolioPipeline {
  private pipeline: SequentialAgent<PortfolioSessionState>;

  constructor() {
    // Stage 1: Ingestion Agent
    const ingestionAgent = new IngestionAgent();

    // Stage 2: 4-Way Parallel Fan-Out
    const parallelAnalysis = new ParallelAgent<PortfolioSessionState>(
      'Stage2_ParallelAnalysis',
      2,
      [
        new XirrAgent(),
        new OverlapAgent(),
        new ExpenseAgent(),
        new BenchmarkAgent(),
      ]
    );

    // Stage 3: Rebalancing Strategist
    const rebalancingStrategist = new RebalancingStrategistAgent();

    // Stage 4: Compliance Loop (reuse from Tax pipeline)
    // Note: These agents work on the `compliant_narrative` field which is set from rebalancing_plan.narrative
    const complianceLoop = new LoopAgent<PortfolioSessionState>(
      'Stage4_ComplianceLoop',
      4,
      [
        new PortfolioComplianceAdapter(), // Adapter to read from rebalancing_plan
        new ComplianceCheckerAgent() as unknown as import('../core/Agent').Agent<PortfolioSessionState>,
        new DisclaimerInjectorAgent() as unknown as import('../core/Agent').Agent<PortfolioSessionState>,
      ],
      2, // max 2 iterations
      createComplianceExitCondition()
    );

    // Wire everything into the main SequentialAgent
    this.pipeline = new SequentialAgent<PortfolioSessionState>(
      'PortfolioPipeline',
      0,
      [ingestionAgent, parallelAnalysis, rebalancingStrategist, complianceLoop]
    );
  }

  /**
   * Execute the portfolio pipeline with the given input.
   * Returns the full session state with all results.
   */
  async execute(input: PortfolioInput): Promise<PortfolioSessionState> {
    console.log('\n[Orchestrator] Starting Portfolio Pipeline...');
    console.log(`[Orchestrator] Input: ${input.funds.length} funds, Risk Profile: ${input.riskProfile}`);
    
    const startTime = performance.now();
    
    // Create session state with raw input
    const state = createPortfolioSessionState(input);

    try {
      // Execute the pipeline
      await this.pipeline.execute(state);
      
      const latencyMs = Math.round(performance.now() - startTime);
      console.log(`[Orchestrator] Pipeline complete. (Total: ${latencyMs}ms)\n`);
      
      // Update final metadata
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      
      // Emit pipeline complete event
      state.emitPipelineComplete();
      
      return state.getAll();
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      console.error(`[Orchestrator] Pipeline failed after ${latencyMs}ms:`, error);
      
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      
      throw error;
    }
  }

  /**
   * Execute with SSE event streaming.
   * Calls the callback for each agent event.
   */
  async executeWithEvents(
    input: PortfolioInput,
    onEvent: (event: import('../core/SessionState').AgentEvent) => void
  ): Promise<PortfolioSessionState> {
    const state = createPortfolioSessionState(input);
    
    // Register event callback
    state.onEvent(onEvent);
    
    console.log('\n[Orchestrator] Starting Portfolio Pipeline with event streaming...');
    console.log(`[Orchestrator] Input: ${input.funds.length} funds, Risk Profile: ${input.riskProfile}`);
    
    const startTime = performance.now();

    try {
      await this.pipeline.execute(state);
      
      const latencyMs = Math.round(performance.now() - startTime);
      console.log(`[Orchestrator] Pipeline complete. (Total: ${latencyMs}ms)\n`);
      
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      
      state.emitPipelineComplete();
      
      return state.getAll();
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      console.error(`[Orchestrator] Pipeline failed after ${latencyMs}ms:`, error);
      
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      
      throw error;
    } finally {
      // Clean up event listener
      state.offEvent(onEvent);
    }
  }
}

/**
 * Adapter agent to prepare portfolio data for compliance checking.
 * Copies rebalancing_plan.narrative to tax_optimization.narrative (which compliance expects).
 */
import { Agent } from '../core/Agent';

class PortfolioComplianceAdapter extends Agent<PortfolioSessionState> {
  constructor() {
    super('ComplianceAdapter', 4);
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const rebalancingPlan = state.get('rebalancing_plan');
    
    if (rebalancingPlan?.narrative) {
      // Create a tax_optimization object that compliance agents expect
      state.set('tax_optimization' as keyof PortfolioSessionState, {
        narrative: rebalancingPlan.narrative,
        winner: 'old', // Dummy value
        savings: 0,
        missedDeductions: [],
        suggestions: [],
        disclaimer: rebalancingPlan.disclaimer,
      } as unknown as PortfolioSessionState['tax_optimization']);
    }
  }
}

// Export a singleton instance for convenience
export const portfolioPipeline = new PortfolioPipeline();
