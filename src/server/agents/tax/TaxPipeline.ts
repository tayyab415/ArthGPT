import { SequentialAgent } from '../core/SequentialAgent';
import { ParallelAgent } from '../core/ParallelAgent';
import { LoopAgent, createComplianceExitCondition } from '../core/LoopAgent';
import { SessionState, type TaxSessionState, createTaxSessionState } from '../core/SessionState';
import { InputCollectorAgent } from './InputCollectorAgent';
import { OldRegimeAgent } from './OldRegimeAgent';
import { NewRegimeAgent } from './NewRegimeAgent';
import { TaxOptimizerAgent } from './TaxOptimizerAgent';
import { ComplianceCheckerAgent } from './ComplianceCheckerAgent';
import { DisclaimerInjectorAgent } from './DisclaimerInjectorAgent';
import type { TaxInput } from '../../taxEngine';

/**
 * Tax Pipeline Orchestrator
 * 
 * Implements the multi-agent tax pipeline as a SequentialAgent with nested structures:
 * 
 * Stage 1: InputCollector (LlmAgent)
 *     ↓
 * Stage 2: ParallelAgent
 *     ├── OldRegimeCalc (DeterministicAgent)
 *     └── NewRegimeCalc (DeterministicAgent)
 *     ↓
 * Stage 3: TaxOptimizer (LlmAgent)
 *     ↓
 * Stage 4: LoopAgent (max 2 iterations)
 *     ├── ComplianceChecker
 *     └── DisclaimerInjector
 */
export class TaxPipeline {
  private pipeline: SequentialAgent<TaxSessionState>;

  constructor() {
    // Stage 1: Input Collector
    const inputCollector = new InputCollectorAgent();

    // Stage 2: Parallel Regime Computation
    const parallelCompute = new ParallelAgent<TaxSessionState>(
      'Stage2_ParallelCompute',
      2,
      [new OldRegimeAgent(), new NewRegimeAgent()]
    );

    // Stage 3: Tax Optimizer
    const taxOptimizer = new TaxOptimizerAgent();

    // Stage 4: Compliance Loop
    const complianceLoop = new LoopAgent<TaxSessionState>(
      'Stage4_ComplianceLoop',
      4,
      [new ComplianceCheckerAgent(), new DisclaimerInjectorAgent()],
      2, // max 2 iterations
      createComplianceExitCondition()
    );

    // Wire everything into the main SequentialAgent
    this.pipeline = new SequentialAgent<TaxSessionState>(
      'TaxPipeline',
      0,
      [inputCollector, parallelCompute, taxOptimizer, complianceLoop]
    );
  }

  /**
   * Execute the tax pipeline with the given input.
   * Returns the full session state with all results.
   */
  async execute(input: TaxInput): Promise<TaxSessionState> {
    console.log('\n[Orchestrator] Starting Tax Pipeline...');
    console.log(`[Orchestrator] Input: Gross ₹${(input.baseSalary + input.hraReceived).toLocaleString('en-IN')}`);
    
    const startTime = performance.now();
    
    // Create session state with raw input
    const state = createTaxSessionState(input);

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
    input: TaxInput,
    onEvent: (event: import('../core/SessionState').AgentEvent) => void
  ): Promise<TaxSessionState> {
    const state = createTaxSessionState(input);
    
    // Register event callback
    state.onEvent(onEvent);
    
    console.log('\n[Orchestrator] Starting Tax Pipeline with event streaming...');
    console.log(`[Orchestrator] Input: Gross ₹${(input.baseSalary + input.hraReceived).toLocaleString('en-IN')}`);
    
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

// Export a singleton instance for convenience
export const taxPipeline = new TaxPipeline();
