import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type PortfolioFund, type PortfolioData } from '../core/SessionState';
import { extractPortfolioData } from '../utils/portfolioGemini';

/**
 * IngestionAgent — Stage 1
 * 
 * Parses raw fund input and standardizes it into structured portfolio_data.
 * Uses Gemini Flash with JSON schema for reliable extraction.
 */
export class IngestionAgent extends LlmAgent<PortfolioSessionState> {
  constructor() {
    super('IngestionAgent', 1, 'gemini-2.5-flash');
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const rawInput = state.get('raw_input');
    
    if (!rawInput?.funds || rawInput.funds.length === 0) {
      throw new Error('No funds provided in input');
    }

    console.log(`[Agent: ${this.name}] Parsing ${rawInput.funds.length} funds...`);

    try {
      // Use Gemini to extract and standardize portfolio data
      const portfolioData = await extractPortfolioData(rawInput);
      
      state.set('portfolio_data', portfolioData);
      console.log(`[Agent: ${this.name}] Extracted ${portfolioData.funds.length} funds. Total value: ₹${portfolioData.totalValue.toLocaleString('en-IN')}`);
    } catch (error) {
      // Fallback: Direct conversion without LLM
      console.warn(`[Agent: ${this.name}] LLM extraction failed, using direct conversion:`, error);
      
      const funds: PortfolioFund[] = rawInput.funds.map(f => ({
        name: f.name,
        units: f.units,
        nav: f.nav,
        currentValue: f.units * f.nav,
        investedAmount: f.investedAmount || f.units * f.nav * 0.9, // Assume 10% gain if not provided
        planType: f.name.toLowerCase().includes('direct') ? 'Direct' as const : 'Regular' as const,
        category: this.inferCategory(f.name),
        amc: this.inferAmc(f.name),
      }));

      const totalValue = funds.reduce((sum, f) => sum + f.currentValue, 0);

      const portfolioData: PortfolioData = {
        funds,
        totalValue,
        riskProfile: rawInput.riskProfile,
        extractionConfidence: 'MEDIUM',
      };

      state.set('portfolio_data', portfolioData);
      console.log(`[Agent: ${this.name}] Extracted ${funds.length} funds (fallback). Total value: ₹${totalValue.toLocaleString('en-IN')}`);
    }
  }

  private inferCategory(fundName: string): PortfolioFund['category'] {
    const name = fundName.toLowerCase();
    if (name.includes('small cap') || name.includes('smallcap')) return 'Small Cap';
    if (name.includes('mid cap') || name.includes('midcap')) return 'Mid Cap';
    if (name.includes('large cap') || name.includes('largecap') || 
        name.includes('bluechip') || name.includes('top 100')) return 'Large Cap';
    if (name.includes('flexi cap') || name.includes('flexicap')) return 'Flexi Cap';
    if (name.includes('multi cap') || name.includes('multicap')) return 'Multi Cap';
    if (name.includes('index') || name.includes('nifty')) return 'Index';
    return 'Other';
  }

  private inferAmc(fundName: string): string {
    const name = fundName.toLowerCase();
    if (name.includes('hdfc')) return 'HDFC AMC';
    if (name.includes('icici') || name.includes('prudential')) return 'ICICI Prudential';
    if (name.includes('sbi')) return 'SBI MF';
    if (name.includes('axis')) return 'Axis AMC';
    if (name.includes('mirae')) return 'Mirae Asset';
    if (name.includes('kotak')) return 'Kotak AMC';
    if (name.includes('nippon') || name.includes('reliance')) return 'Nippon India';
    if (name.includes('parag parikh') || name.includes('ppfas')) return 'PPFAS AMC';
    if (name.includes('dsp')) return 'DSP AMC';
    if (name.includes('aditya birla') || name.includes('absl')) return 'Aditya Birla Sun Life';
    return 'Unknown AMC';
  }
}
