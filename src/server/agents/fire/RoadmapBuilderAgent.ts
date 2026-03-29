import { LlmAgent } from '../core/Agent';
import { SessionState, type FireRoadmap, type FireSessionState } from '../core/SessionState';
import { estimateSuccessProbability } from '../utils/fire';
import {
  type FireScenarioComparison,
  FIRE_MODELS,
  generateDeterministicFireRoadmap,
  generateFireRoadmap,
} from '../utils/fireGemini';

export class RoadmapBuilderAgent extends LlmAgent<FireSessionState> {
  constructor() {
    super('RoadmapBuilder', 3, FIRE_MODELS.PRO);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const fireInputs = state.get('fire_inputs');
    const macroParameters = state.get('macro_parameters');
    const monteCarloResults = state.get('monte_carlo_results');
    const sipPlan = state.get('sip_plan');
    const insuranceGaps = state.get('insurance_gaps');

    if (!fireInputs || !macroParameters || !monteCarloResults || !sipPlan || !insuranceGaps) {
      throw new Error('Stage 2 data must be complete before RoadmapBuilder.');
    }

    console.log(`[Agent: ${this.name}] Interpreting Monte Carlo distribution and building roadmap...`);

    const scenarioComparisons = this.buildScenarioComparisons(
      fireInputs,
      macroParameters,
      monteCarloResults.successProbability,
    );

    let roadmap: FireRoadmap;
    try {
      roadmap = await generateFireRoadmap({
        fireInputs,
        macroParameters,
        monteCarloResults,
        sipPlan,
        insuranceGaps,
        scenarioComparisons,
      });
    } catch (error) {
      console.warn(`[Agent: ${this.name}] LLM roadmap generation failed, using deterministic fallback:`, error);
      roadmap = generateDeterministicFireRoadmap({
        fireInputs,
        monteCarloResults,
        sipPlan,
        insuranceGaps,
        scenarioComparisons,
      });
    }

    state.set('fire_roadmap', roadmap);
    state.set('fire_summary', {
      successProbability: monteCarloResults.successProbability,
      p10Corpus: monteCarloResults.retirementCorpusPercentiles.p10,
      p50Corpus: monteCarloResults.retirementCorpusPercentiles.p50,
      p90Corpus: monteCarloResults.retirementCorpusPercentiles.p90,
      medianSipRequired: sipPlan.medianSipRequired,
      safetySipRequired: sipPlan.safetySipRequired,
      insuranceGap: insuranceGaps.lifeCoverGap,
      macroAsOf: macroParameters.asOf,
      macroSourceMode: macroParameters.sourceMode,
      roadmapHeadline: roadmap.headline,
      roadmapNarrative: roadmap.narrative,
    });

    console.log(`[Agent: ${this.name}] Roadmap headline: ${roadmap.headline}`);
  }

  private buildScenarioComparisons(
    fireInputs: NonNullable<FireSessionState['fire_inputs']>,
    macroParameters: NonNullable<FireSessionState['macro_parameters']>,
    baseSuccessProbability: number,
  ): FireScenarioComparison[] {
    const sipIncrease = 10000;
    const successWithHigherSip = estimateSuccessProbability(fireInputs, macroParameters, {
      monthlySipOverride: fireInputs.currentMonthlySip + sipIncrease,
      iterations: 300,
      seed: 20260330,
    });

    const successWithDelay = estimateSuccessProbability(fireInputs, macroParameters, {
      retirementAgeOverride: fireInputs.retirementAge + 2,
      iterations: 300,
      seed: 20260331,
    });

    const reducedDraw = Math.max(25000, Math.round(fireInputs.targetMonthlyDrawToday * 0.85));
    const successWithReducedDraw = estimateSuccessProbability(fireInputs, macroParameters, {
      targetMonthlyDrawOverride: reducedDraw,
      iterations: 300,
      seed: 20260332,
    });

    return [
      {
        label: `Increase SIP by ₹${sipIncrease.toLocaleString('en-IN')}/month`,
        description: `Base plan is ${baseSuccessProbability.toFixed(1)}%; higher SIP lifts the success rate to ${successWithHigherSip.toFixed(1)}%.`,
        successProbability: successWithHigherSip,
      },
      {
        label: 'Delay retirement by 2 years',
        description: `Retiring 2 years later moves the success rate to ${successWithDelay.toFixed(1)}%.`,
        successProbability: successWithDelay,
      },
      {
        label: `Reduce monthly draw to ₹${reducedDraw.toLocaleString('en-IN')}`,
        description: `Cutting the withdrawal target improves the success rate to ${successWithReducedDraw.toFixed(1)}%.`,
        successProbability: successWithReducedDraw,
      },
    ];
  }
}
