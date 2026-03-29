import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type PortfolioFund, type PortfolioData } from '../core/SessionState';
import { extractPortfolioData } from '../utils/portfolioGemini';
import { resolveFund } from '../utils/mfapi';

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

    let portfolioData: PortfolioData;

    try {
      // Use Gemini to extract and standardize portfolio data
      portfolioData = await extractPortfolioData(rawInput);
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

      portfolioData = {
        funds,
        totalValue,
        riskProfile: rawInput.riskProfile,
        extractionConfidence: 'MEDIUM',
      };

      console.log(`[Agent: ${this.name}] Extracted ${funds.length} funds (fallback). Total value: ₹${totalValue.toLocaleString('en-IN')}`);
    }

    // Enrich funds with real MFapi data
    const enrichedData = await this.enrichWithMfapi(portfolioData);
    state.set('portfolio_data', enrichedData);
  }

  /**
   * Enrich portfolio funds with real NAV data from MFapi.in.
   * Falls back to mock data (original values) when MFapi can't resolve a fund.
   */
  private async enrichWithMfapi(portfolioData: PortfolioData): Promise<PortfolioData> {
    const enrichedFunds = await Promise.all(
      portfolioData.funds.map(async (fund) => {
        try {
          const resolved = await resolveFund(fund.name);
          if (resolved) {
            console.log(`[Agent: ${this.name}] MFapi resolved "${fund.name}" → NAV ₹${resolved.latestNav}`);
            return {
              ...fund,
              nav: resolved.latestNav,
              currentValue: fund.units * resolved.latestNav,
              amc: resolved.fundHouse,
              isin: resolved.isin,
              schemeCode: resolved.schemeCode,
              dataSource: 'mfapi' as const,
            };
          }
        } catch (err) {
          console.warn(`[Agent: ${this.name}] MFapi enrichment failed for ${fund.name}:`, err);
        }
        return { ...fund, dataSource: 'mock' as const };
      })
    );

    const enrichedTotalValue = enrichedFunds.reduce((sum, f) => sum + f.currentValue, 0);
    const mfapiCount = enrichedFunds.filter(f => f.dataSource === 'mfapi').length;
    console.log(`[Agent: ${this.name}] MFapi enrichment: ${mfapiCount}/${enrichedFunds.length} funds resolved. Total value: ₹${enrichedTotalValue.toLocaleString('en-IN')}`);

    return {
      ...portfolioData,
      funds: enrichedFunds,
      totalValue: enrichedTotalValue,
    };
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
