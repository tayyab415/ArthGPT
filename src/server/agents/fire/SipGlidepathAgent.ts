import { DeterministicAgent } from '../core/Agent';
import { SessionState, type FireSessionState, type SipPlan } from '../core/SessionState';
import { buildGlidepath, computeTargetCorpus, FIRE_STEP_UP_RATE, solveRequiredSip } from '../utils/fire';

export class SipGlidepathAgent extends DeterministicAgent<FireSessionState> {
  constructor() {
    super('SipGlidepathEngine', 2);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const fireInputs = state.get('fire_inputs');
    const macroParameters = state.get('macro_parameters');

    if (!fireInputs || !macroParameters) {
      throw new Error('GoalProfiler and MacroAgent must complete before SipGlidepathEngine.');
    }

    const targetCorpus = computeTargetCorpus(fireInputs, macroParameters);
    const medianSipRequired = solveRequiredSip(targetCorpus, fireInputs, macroParameters);
    const safetySipRequired = solveRequiredSip(targetCorpus, fireInputs, macroParameters, { conservative: true });
    const glidepath = buildGlidepath(fireInputs);
    const firstAllocation = glidepath[0] || { equity: 90, debt: 10 };

    const sipPlan: SipPlan = {
      medianSipRequired,
      safetySipRequired,
      stepUpRate: FIRE_STEP_UP_RATE,
      firstYearMonthlyPlan: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        sip: medianSipRequired,
        equity: firstAllocation.equity,
        debt: firstAllocation.debt,
      })),
      glidepath,
      notes: `Median plan targets ₹${Math.round(targetCorpus).toLocaleString('en-IN')} at retirement using live macro assumptions.`,
    };

    state.set('sip_plan', sipPlan);
    console.log(`[Agent: ${this.name}] Median SIP ₹${medianSipRequired.toLocaleString('en-IN')}/month, safety SIP ₹${safetySipRequired.toLocaleString('en-IN')}/month`);
  }
}
