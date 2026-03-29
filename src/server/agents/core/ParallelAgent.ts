import { Agent } from './Agent';
import { SessionState, type TaxSessionState } from './SessionState';

/**
 * ParallelAgent runs a list of sub-agents concurrently using Promise.all.
 * All agents receive the same SessionState and can write to different keys.
 * The pipeline continues only after ALL agents complete.
 */
export class ParallelAgent<T extends Record<string, unknown> = TaxSessionState> extends Agent<T> {
  private agents: Agent<T>[];

  constructor(name: string, stage: number, agents: Agent<T>[]) {
    super(name, stage);
    this.agents = agents;
  }

  protected async run(state: SessionState<T>): Promise<void> {
    const agentNames = this.agents.map(a => a.name).join(', ');
    console.log(`[ParallelAgent: ${this.name}] Spawning ${this.agents.length} agents in parallel: ${agentNames}`);

    // Run all agents concurrently
    const results = await Promise.allSettled(
      this.agents.map(agent => agent.execute(state))
    );

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    if (failures.length > 0) {
      const errors = failures.map(f => f.reason?.message || String(f.reason)).join('; ');
      console.error(`[ParallelAgent: ${this.name}] ${failures.length} agent(s) failed: ${errors}`);
      throw new Error(`ParallelAgent failures: ${errors}`);
    }

    console.log(`[ParallelAgent: ${this.name}] All ${this.agents.length} agents completed successfully.`);
  }

  /**
   * Add an agent to run in parallel
   */
  addAgent(agent: Agent<T>): void {
    this.agents.push(agent);
  }

  /**
   * Get all agents
   */
  getAgents(): Agent<T>[] {
    return [...this.agents];
  }
}
