import { DeterministicAgent } from '../core/Agent';
import { SessionState, type FireSessionState, type InsuranceGaps } from '../core/SessionState';

export class InsuranceGapAgent extends DeterministicAgent<FireSessionState> {
  constructor() {
    super('InsuranceGapAgent', 2);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const fireInputs = state.get('fire_inputs');
    if (!fireInputs) {
      throw new Error('GoalProfiler must complete before InsuranceGapAgent.');
    }

    const requiredLifeCover = fireInputs.annualIncome * 12;
    const lifeCoverGap = Math.max(0, requiredLifeCover - fireInputs.declaredLifeCover);
    const recommendedHealthCover = 2000000;

    const insuranceGaps: InsuranceGaps = {
      requiredLifeCover,
      declaredLifeCover: fireInputs.declaredLifeCover,
      lifeCoverGap,
      recommendedHealthCover,
      summary: lifeCoverGap > 0
        ? `Declared life cover is short by ₹${lifeCoverGap.toLocaleString('en-IN')} against the 12x income rule.`
        : 'Declared life cover already meets the 12x income rule.',
    };

    state.set('insurance_gaps', insuranceGaps);
    console.log(`[Agent: ${this.name}] Life cover gap: ₹${lifeCoverGap.toLocaleString('en-IN')}`);
  }
}
