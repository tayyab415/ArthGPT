import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type RebalancingPlan } from '../core/SessionState';
import { generateRebalancingPlan, generateFallbackRebalancingPlan } from '../utils/portfolioGemini';

/**
 * RebalancingStrategistAgent — Stage 3
 * 
 * Reads all 4 Stage 2 outputs + risk profile and synthesizes
 * specific, actionable, fund-level rebalancing recommendations.
 * 
 * Uses Gemini Pro for multi-factor reasoning.
 */
export class RebalancingStrategistAgent extends LlmAgent<PortfolioSessionState> {
  constructor() {
    super('RebalancingStrategist', 3, 'gemini-2.5-pro');
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const portfolioData = state.get('portfolio_data');
    const xirrResults = state.get('xirr_results');
    const overlapData = state.get('overlap_data');
    const expenseAnalysis = state.get('expense_analysis');
    const benchmarkComparison = state.get('benchmark_comparison');

    if (!portfolioData || !xirrResults || !overlapData || !expenseAnalysis || !benchmarkComparison) {
      throw new Error('Missing Stage 2 data for rebalancing synthesis');
    }

    console.log(`[Agent: ${this.name}] Synthesizing rebalancing recommendations...`);

    let rebalancingPlan: RebalancingPlan;

    try {
      // Use Gemini Pro for comprehensive analysis
      rebalancingPlan = await generateRebalancingPlan(
        portfolioData,
        xirrResults,
        overlapData,
        expenseAnalysis,
        benchmarkComparison
      );
    } catch (error) {
      // Fallback to deterministic generation
      console.warn(`[Agent: ${this.name}] LLM generation failed, using fallback:`, error);
      rebalancingPlan = generateFallbackRebalancingPlan(
        portfolioData,
        expenseAnalysis,
        overlapData
      );
    }

    state.set('rebalancing_plan', rebalancingPlan);
    console.log(`[Agent: ${this.name}] Generated ${rebalancingPlan.recommendations.length} recommendation(s). Expected savings: ₹${rebalancingPlan.totalExpectedSavings.toLocaleString('en-IN')}/year`);
  }
}
