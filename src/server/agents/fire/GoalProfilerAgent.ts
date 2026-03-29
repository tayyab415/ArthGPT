import { DeterministicAgent } from '../core/Agent';
import { SessionState, type FireInputs, type FireSessionState } from '../core/SessionState';

export class GoalProfilerAgent extends DeterministicAgent<FireSessionState> {
  constructor() {
    super('GoalProfiler', 1);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const rawInput = state.get('raw_input');
    if (!rawInput) {
      throw new Error('No FIRE input provided');
    }

    const currentAge = clamp(Math.round(rawInput.age), 18, 80);
    const retirementAge = Math.max(currentAge + 1, Math.round(rawInput.retireAge));
    const annualIncome = Math.max(0, rawInput.income);
    const existingMfCorpus = Math.max(0, rawInput.existingMfCorpus);
    const existingPpfCorpus = Math.max(0, rawInput.existingPpfCorpus);
    const currentMonthlySip = Math.max(0, rawInput.monthlySipCurrent);
    const targetMonthlyDrawToday = Math.max(1000, rawInput.targetMonthlyDraw);
    const declaredLifeCover = Math.max(0, rawInput.declaredLifeCover);

    const fireInputs: FireInputs = {
      currentAge,
      retirementAge,
      yearsToRetirement: retirementAge - currentAge,
      annualIncome,
      existingMfCorpus,
      existingPpfCorpus,
      existingCorpus: existingMfCorpus + existingPpfCorpus,
      currentMonthlySip,
      targetMonthlyDrawToday,
      declaredLifeCover,
      lifeExpectancyAge: 85,
    };

    state.set('fire_inputs', fireInputs);
    console.log(`[Agent: ${this.name}] Profiled FIRE input: age ${currentAge} -> ${retirementAge}, income ₹${annualIncome.toLocaleString('en-IN')}`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
