import { Agent } from '../core/Agent';
import { LoopAgent, createComplianceExitCondition } from '../core/LoopAgent';
import { ParallelAgent } from '../core/ParallelAgent';
import { SequentialAgent } from '../core/SequentialAgent';
import {
  createFireSessionState,
  SessionState,
  type AgentEvent,
  type FireInput,
  type FireRoadmap,
  type FireSessionState,
} from '../core/SessionState';
import { ComplianceCheckerAgent } from '../tax/ComplianceCheckerAgent';
import { DisclaimerInjectorAgent } from '../tax/DisclaimerInjectorAgent';
import { GoalProfilerAgent } from './GoalProfilerAgent';
import { InsuranceGapAgent } from './InsuranceGapAgent';
import { MacroAgent } from './MacroAgent';
import { MonteCarloAgent } from './MonteCarloAgent';
import { RoadmapBuilderAgent } from './RoadmapBuilderAgent';
import { SipGlidepathAgent } from './SipGlidepathAgent';

const FIRE_COMPLIANCE_DISCLAIMER = 'Monte Carlo simulations are based on historical-style return distributions and assumed macro parameters. They express probabilities, not guarantees. Actual market conditions may differ materially. This is AI-generated educational guidance, not licensed financial advice.';

export class FirePipeline {
  private pipeline: SequentialAgent<FireSessionState>;

  constructor() {
    const stage1 = new ParallelAgent<FireSessionState>(
      'Stage1_ParallelGather',
      1,
      [new GoalProfilerAgent(), new MacroAgent()],
    );

    const stage2 = new ParallelAgent<FireSessionState>(
      'Stage2_ParallelCompute',
      2,
      [new MonteCarloAgent(), new SipGlidepathAgent(), new InsuranceGapAgent()],
    );

    const stage3 = new RoadmapBuilderAgent();

    const stage4 = new LoopAgent<FireSessionState>(
      'Stage4_ComplianceLoop',
      4,
      [
        new FireComplianceAdapter(),
        new ComplianceCheckerAgent() as unknown as Agent<FireSessionState>,
        new DisclaimerInjectorAgent() as unknown as Agent<FireSessionState>,
      ],
      2,
      createComplianceExitCondition(),
    );

    this.pipeline = new SequentialAgent<FireSessionState>('FirePipeline', 0, [stage1, stage2, stage3, stage4]);
  }

  async execute(input: FireInput): Promise<FireSessionState> {
    console.log('\n[Orchestrator] Starting FIRE Pipeline...');
    console.log(`[Orchestrator] Input: age ${input.age}, retireAge ${input.retireAge}, income ₹${input.income.toLocaleString('en-IN')}`);

    const startTime = performance.now();
    const state = createFireSessionState(input);

    try {
      await this.pipeline.execute(state);
      const latencyMs = Math.round(performance.now() - startTime);
      console.log(`[Orchestrator] FIRE pipeline complete. (Total: ${latencyMs}ms)\n`);

      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      this.finalizeState(state);
      state.emitPipelineComplete();
      return state.getAll();
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      console.error(`[Orchestrator] FIRE pipeline failed after ${latencyMs}ms:`, error);
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      throw error;
    }
  }

  async executeWithEvents(input: FireInput, onEvent: (event: AgentEvent) => void): Promise<FireSessionState> {
    const state = createFireSessionState(input);
    state.onEvent(onEvent);

    console.log('\n[Orchestrator] Starting FIRE Pipeline with event streaming...');
    console.log(`[Orchestrator] Input: age ${input.age}, retireAge ${input.retireAge}, income ₹${input.income.toLocaleString('en-IN')}`);

    const startTime = performance.now();

    try {
      await this.pipeline.execute(state);
      const latencyMs = Math.round(performance.now() - startTime);
      console.log(`[Orchestrator] FIRE pipeline complete. (Total: ${latencyMs}ms)\n`);

      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      this.finalizeState(state);
      state.emitPipelineComplete();
      return state.getAll();
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      console.error(`[Orchestrator] FIRE pipeline failed after ${latencyMs}ms:`, error);
      state.set('pipeline_end', new Date().toISOString());
      state.set('total_latency_ms', latencyMs);
      throw error;
    } finally {
      state.offEvent(onEvent);
    }
  }

  private finalizeState(state: SessionState<FireSessionState>): void {
    const compliantNarrative = state.get('compliant_narrative');
    const fireRoadmap = state.get('fire_roadmap');
    const fireSummary = state.get('fire_summary');

    if (compliantNarrative && fireRoadmap) {
      state.set('fire_roadmap', {
        ...fireRoadmap,
        narrative: compliantNarrative,
      } as FireRoadmap);
    }

    if (fireSummary) {
      state.set('fire_summary', {
        ...fireSummary,
        roadmapNarrative: compliantNarrative || fireSummary.roadmapNarrative,
      });
    }
  }
}

class FireComplianceAdapter extends Agent<FireSessionState> {
  constructor() {
    super('FireComplianceAdapter', 4);
  }

  protected async run(state: SessionState<FireSessionState>): Promise<void> {
    const fireRoadmap = state.get('fire_roadmap');
    if (!fireRoadmap?.narrative) {
      throw new Error('RoadmapBuilder must run before compliance.');
    }

    state.set('tax_optimization' as keyof FireSessionState, {
      narrative: fireRoadmap.narrative,
      winner: 'new',
      savings: 0,
      missedDeductions: [],
      suggestions: [],
      disclaimer: FIRE_COMPLIANCE_DISCLAIMER,
    } as FireSessionState[keyof FireSessionState]);
    state.set('compliance_context' as keyof FireSessionState, 'fire' as FireSessionState[keyof FireSessionState]);
    state.set('compliance_target_narrative' as keyof FireSessionState, fireRoadmap.narrative as FireSessionState[keyof FireSessionState]);
    state.set('compliance_disclaimer' as keyof FireSessionState, FIRE_COMPLIANCE_DISCLAIMER as FireSessionState[keyof FireSessionState]);
  }
}

export const firePipeline = new FirePipeline();
