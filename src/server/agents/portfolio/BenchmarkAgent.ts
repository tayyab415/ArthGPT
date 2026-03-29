import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type BenchmarkComparison } from '../core/SessionState';
import { mockRetrieveBenchmarkData, inferFundCategory, mockGenerateFundReturns } from './mockFundData';

/**
 * BenchmarkAgent — Stage 2D
 * 
 * Compares fund performance against category benchmarks.
 * Flags underperformers (>2% below benchmark over 3 years).
 */
export class BenchmarkAgent extends LlmAgent<PortfolioSessionState> {
  constructor() {
    super('BenchmarkAgent', 2, 'gemini-2.5-flash');
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const portfolioData = state.get('portfolio_data');
    
    if (!portfolioData?.funds || portfolioData.funds.length === 0) {
      throw new Error('No portfolio data available for benchmark comparison');
    }

    console.log(`[Agent: ${this.name}] Comparing ${portfolioData.funds.length} funds against benchmarks...`);

    // Analyze each fund against its category benchmark
    const comparisonPromises = portfolioData.funds.map(async fund => {
      const category = inferFundCategory(fund.name);
      const benchmarkData = await mockRetrieveBenchmarkData(fund.name);
      const fundReturns = mockGenerateFundReturns(fund.name);
      
      // Check if fund is underperforming (>2% below benchmark over 3Y)
      const alpha3Y = fundReturns.y3 - benchmarkData.benchmark3Y;
      const underperformer = alpha3Y < -2;

      return {
        fund: fund.name,
        category,
        benchmark: benchmarkData.benchmark,
        fund1Y: fundReturns.y1,
        benchmark1Y: benchmarkData.benchmark1Y,
        fund3Y: fundReturns.y3,
        benchmark3Y: benchmarkData.benchmark3Y,
        underperformer,
        confidence: benchmarkData.confidence,
      };
    });

    const comparisons = await Promise.all(comparisonPromises);

    const result: BenchmarkComparison = {
      funds: comparisons,
    };

    state.set('benchmark_comparison', result);

    const underperformers = comparisons.filter(c => c.underperformer);
    console.log(`[Agent: ${this.name}] Found ${underperformers.length} underperforming fund(s)`);
  }
}
