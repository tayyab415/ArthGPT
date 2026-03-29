import { LlmAgent } from '../core/Agent';
import { SessionState, type FireSessionState } from '../core/SessionState';
import { buildFallbackMacroParameters, fetchMacroParametersLive, FIRE_MODELS } from '../utils/fireGemini';

export class MacroAgent extends LlmAgent<FireSessionState> {
  constructor() {
    super('MacroAgent', 1, FIRE_MODELS.FLASH);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    console.log(`[Agent: ${this.name}] Fetching live macro parameters...`);

    try {
      const macroParameters = await fetchMacroParametersLive();
      state.set('macro_parameters', macroParameters);
      console.log(
        `[Agent: ${this.name}] Live macro snapshot ready: inflation ${(macroParameters.inflationRate.value * 100).toFixed(2)}%, Nifty mean ${(macroParameters.niftyMeanReturn.value * 100).toFixed(2)}%`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[Agent: ${this.name}] Live macro lookup failed, using fallback snapshot: ${reason}`);
      state.set('macro_parameters', buildFallbackMacroParameters(reason));
    }
  }
}
