import { DeterministicAgent } from '../core/Agent';
import { SessionState, type FireSessionState } from '../core/SessionState';
import { FIRE_DEFAULT_ITERATIONS, FIRE_DEFAULT_SEED, runMonteCarlo } from '../utils/fire';

export class MonteCarloAgent extends DeterministicAgent<FireSessionState> {
  constructor() {
    super('MonteCarloEngine', 2);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const fireInputs = state.get('fire_inputs');
    const macroParameters = state.get('macro_parameters');

    if (!fireInputs || !macroParameters) {
      throw new Error('GoalProfiler and MacroAgent must complete before MonteCarloEngine.');
    }

    console.log(
      `[Agent: ${this.name}] Running ${FIRE_DEFAULT_ITERATIONS} simulations using ${(macroParameters.niftyMeanReturn.value * 100).toFixed(2)}% mean and ${(macroParameters.niftyStdDev.value * 100).toFixed(2)}% volatility...`,
    );

    const results = runMonteCarlo(fireInputs, macroParameters, {
      iterations: FIRE_DEFAULT_ITERATIONS,
      seed: FIRE_DEFAULT_SEED,
    });

    state.set('monte_carlo_results', results);
    console.log(`[Agent: ${this.name}] Success probability: ${results.successProbability.toFixed(1)}%`);
  }
}
