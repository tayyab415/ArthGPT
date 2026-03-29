import { SessionState, type TaxSessionState } from './SessionState';

/**
 * Base Agent abstract class.
 * All agents in the pipeline extend this class.
 */
export abstract class Agent<T extends Record<string, unknown> = TaxSessionState> {
  readonly name: string;
  readonly stage: number;

  constructor(name: string, stage: number) {
    this.name = name;
    this.stage = stage;
  }

  /**
   * Execute the agent's logic.
   * Subclasses must implement this method.
   */
  protected abstract run(state: SessionState<T>): Promise<void>;

  /**
   * Execute with timing, logging, and event emission.
   */
  async execute(state: SessionState<T>): Promise<void> {
    const startTime = performance.now();
    console.log(`[Agent: ${this.name}] Starting...`);
    state.emitAgentStart(this.name, this.stage);

    try {
      await this.run(state);
      const latencyMs = Math.round(performance.now() - startTime);
      console.log(`[Agent: ${this.name}] Complete. (Latency: ${latencyMs}ms)`);
      state.emitAgentComplete(this.name, this.stage, latencyMs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Agent: ${this.name}] Error: ${errorMessage}`);
      state.emitAgentError(this.name, this.stage, errorMessage);
      throw error;
    }
  }
}

/**
 * Deterministic agent that wraps pure computation (no LLM calls).
 * Used for tax calculations where math must be exact.
 */
export abstract class DeterministicAgent<T extends Record<string, unknown> = TaxSessionState> extends Agent<T> {
  constructor(name: string, stage: number) {
    super(name, stage);
  }
}

/**
 * LLM agent that makes calls to Gemini.
 * Used for extraction, reasoning, and narrative generation.
 */
export abstract class LlmAgent<T extends Record<string, unknown> = TaxSessionState> extends Agent<T> {
  readonly model: string;

  constructor(name: string, stage: number, model: string) {
    super(name, stage);
    this.model = model;
  }
}
