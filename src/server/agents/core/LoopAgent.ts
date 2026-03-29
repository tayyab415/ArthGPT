import { Agent } from './Agent';
import { SessionState, type TaxSessionState } from './SessionState';

/**
 * Result of a loop iteration - determines whether to continue or exit
 */
export interface LoopIterationResult {
  shouldExit: boolean;
  reason?: string;
}

/**
 * LoopAgent runs sub-agents in a loop until an exit condition is met
 * or the maximum number of iterations is reached.
 * 
 * Used for compliance review where:
 * - First pass checks for violations
 * - If violations found, second pass fixes them
 * - Loop exits when CLEAN or max iterations reached
 */
export class LoopAgent<T extends Record<string, unknown> = TaxSessionState> extends Agent<T> {
  private agents: Agent<T>[];
  private maxIterations: number;
  private exitCondition: (state: SessionState<T>, iteration: number) => LoopIterationResult;

  constructor(
    name: string,
    stage: number,
    agents: Agent<T>[],
    maxIterations: number,
    exitCondition: (state: SessionState<T>, iteration: number) => LoopIterationResult
  ) {
    super(name, stage);
    this.agents = agents;
    this.maxIterations = maxIterations;
    this.exitCondition = exitCondition;
  }

  protected async run(state: SessionState<T>): Promise<void> {
    console.log(`[LoopAgent: ${this.name}] Starting loop (max ${this.maxIterations} iterations)...`);

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      console.log(`[LoopAgent: ${this.name}] Iteration ${iteration + 1}/${this.maxIterations}`);

      // Run all agents in sequence for this iteration
      for (const agent of this.agents) {
        await agent.execute(state);
      }

      // Check exit condition
      const result = this.exitCondition(state, iteration);
      if (result.shouldExit) {
        console.log(`[LoopAgent: ${this.name}] Exit condition met: ${result.reason || 'condition satisfied'}`);
        return;
      }
    }

    console.log(`[LoopAgent: ${this.name}] Max iterations (${this.maxIterations}) reached.`);
  }

  /**
   * Get all agents in the loop
   */
  getAgents(): Agent<T>[] {
    return [...this.agents];
  }
}

/**
 * Create a compliance loop exit condition for Tax Pipeline.
 * Exits when compliance_status is 'CLEAN'.
 */
export function createComplianceExitCondition<T extends Record<string, unknown>>(): (state: SessionState<T>, iteration: number) => LoopIterationResult {
  return (state: SessionState<T>) => {
    const status = state.get('compliance_status' as keyof T);
    if (status === 'CLEAN') {
      return { shouldExit: true, reason: 'No compliance violations found' };
    }
    return { shouldExit: false };
  };
}
