import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type OverlapData } from '../core/SessionState';
import { mockRetrieveFundHoldings } from './mockFundData';

/**
 * OverlapAgent — Stage 2B
 * 
 * Analyzes stock overlap across funds in the portfolio.
 * Uses the three-layer data retrieval architecture:
 * - Layer 1: RAG store (HIGH confidence)
 * - Layer 2: Exa MCP (MEDIUM confidence)
 * - Layer 3: Google Search (LOW confidence)
 * 
 * Tags each data point with its confidence level.
 */
export class OverlapAgent extends LlmAgent<PortfolioSessionState> {
  constructor() {
    super('OverlapAgent', 2, 'gemini-2.5-flash');
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const portfolioData = state.get('portfolio_data');
    
    if (!portfolioData?.funds || portfolioData.funds.length === 0) {
      throw new Error('No portfolio data available for overlap analysis');
    }

    console.log(`[Agent: ${this.name}] Analyzing holdings overlap for ${portfolioData.funds.length} funds...`);

    // Retrieve holdings for all funds in parallel
    const holdingsPromises = portfolioData.funds.map(fund => 
      mockRetrieveFundHoldings(fund.name).then(result => ({
        fund: fund.name,
        holdings: result.holdings,
        confidence: result.confidence,
        source: result.source,
      }))
    );

    const fundHoldings = await Promise.all(holdingsPromises);

    // Build overlap matrix
    const stockToFunds: Map<string, { funds: string[]; weights: number[]; confidence: OverlapData['overlapMatrix'][0]['confidence'] }> = new Map();

    // Track overall confidence (lowest confidence of any data source used)
    let overallConfidence: OverlapData['confidence'] = 'HIGH';

    for (const { fund, holdings, confidence } of fundHoldings) {
      // Update overall confidence
      if (confidence === 'LOW') overallConfidence = 'LOW';
      else if (confidence === 'MEDIUM' && overallConfidence === 'HIGH') overallConfidence = 'MEDIUM';

      for (const holding of holdings) {
        const stockKey = holding.stock.toLowerCase().trim();
        
        if (!stockToFunds.has(stockKey)) {
          stockToFunds.set(stockKey, { funds: [], weights: [], confidence });
        }
        
        const entry = stockToFunds.get(stockKey)!;
        entry.funds.push(fund);
        entry.weights.push(holding.weight);
        
        // Use lowest confidence for this stock
        if (confidence === 'LOW') entry.confidence = 'LOW';
        else if (confidence === 'MEDIUM' && entry.confidence === 'HIGH') entry.confidence = 'MEDIUM';
      }
    }

    // Find overlapping stocks (present in 2+ funds)
    const overlaps: OverlapData['overlapMatrix'] = [];
    
    for (const [stock, data] of stockToFunds.entries()) {
      if (data.funds.length >= 2) {
        // Combined weight = sum of weights across funds (rough approximation)
        const combinedWeight = data.weights.reduce((sum, w) => sum + w, 0);
        
        overlaps.push({
          stock: this.capitalizeStock(stock),
          funds: data.funds,
          combinedWeight: Math.round(combinedWeight * 10) / 10,
          confidence: data.confidence,
        });
      }
    }

    // Sort by combined weight (highest first)
    overlaps.sort((a, b) => b.combinedWeight - a.combinedWeight);

    // Determine concentration risk
    const topOverlapWeight = overlaps.length > 0 ? overlaps[0].combinedWeight : 0;
    const concentrationRisk = this.assessConcentrationRisk(overlaps.length, topOverlapWeight);

    const overlapData: OverlapData = {
      totalOverlappingStocks: overlaps.length,
      overlapMatrix: overlaps,
      concentrationRisk,
      confidence: overallConfidence,
    };

    state.set('overlap_data', overlapData);
    console.log(`[Agent: ${this.name}] Found ${overlaps.length} overlapping stocks. Confidence: ${overallConfidence}`);
  }

  private capitalizeStock(stock: string): string {
    return stock
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private assessConcentrationRisk(overlapCount: number, topWeight: number): string {
    if (overlapCount > 15 || topWeight > 20) {
      return 'HIGH: Significant stock concentration across funds. Consider diversifying into funds with different holdings.';
    } else if (overlapCount > 8 || topWeight > 12) {
      return 'MEDIUM: Moderate overlap detected. Some concentration risk exists.';
    } else {
      return 'LOW: Good diversification across fund holdings.';
    }
  }
}
