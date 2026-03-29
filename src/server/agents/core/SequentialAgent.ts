import { Agent } from './Agent';
import { SessionState, type TaxSessionState } from './SessionState';

/**
 * SequentialAgent runs a list of sub-agents in sequence.
 * Each agent receives the same SessionState and can read/write to it.
 * The pipeline proceeds only after each agent completes.
 */
export class SequentialAgent<T extends Record<string, unknown> = TaxSessionState> extends Agent<T> {
  private agents: Agent<T>[];

  constructor(name: string, stage: number, agents: Agent<T>[]) {
    super(name, stage);
    this.agents = agents;
  }

  protected async run(state: SessionState<T>): Promise<void> {
    console.log(`[SequentialAgent: ${this.name}] Running ${this.agents.length} agents in sequence...`);

    for (const agent of this.agents) {
      await agent.execute(state);
    }

    console.log(`[SequentialAgent: ${this.name}] All agents completed.`);
  }

  /**
   * Add an agent to the sequence
   */
  addAgent(agent: Agent<T>): void {
    this.agents.push(agent);
  }

  /**
   * Get all agents in the sequence
   */
  getAgents(): Agent<T>[] {
    return [...this.agents];
  }
}
