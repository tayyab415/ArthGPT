import { DeterministicAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type XirrResults, type Cashflow } from '../core/SessionState';

/**
 * XirrAgent — Stage 2A (Deterministic)
 * 
 * Calculates XIRR (Extended Internal Rate of Return) for each fund and the overall portfolio.
 * Uses Newton-Raphson method for the calculation.
 * This is a deterministic agent — no LLM calls, pure math.
 */
export class XirrAgent extends DeterministicAgent<PortfolioSessionState> {
  constructor() {
    super('XirrEngine', 2);
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const portfolioData = state.get('portfolio_data');
    
    if (!portfolioData?.funds || portfolioData.funds.length === 0) {
      throw new Error('No portfolio data available for XIRR calculation');
    }

    console.log(`[Agent: ${this.name}] Calculating XIRR for ${portfolioData.funds.length} funds...`);

    const fundXirrs: XirrResults['fundXirrs'] = [];
    let totalInvested = 0;
    let totalCurrentValue = 0;
    const traceLines: string[] = [];

    for (const fund of portfolioData.funds) {
      // Generate simulated cashflows based on invested amount and current value
      const cashflows = this.generateCashflows(fund.investedAmount, fund.currentValue, fund.name);
      
      // Calculate XIRR
      const xirr = this.calculateXirr(cashflows);
      
      fundXirrs.push({
        fund: fund.name,
        xirr,
        cashflows,
      });

      totalInvested += fund.investedAmount;
      totalCurrentValue += fund.currentValue;

      traceLines.push(`${fund.name}: XIRR = ${xirr.toFixed(2)}% (Invested: ₹${fund.investedAmount.toLocaleString('en-IN')}, Current: ₹${fund.currentValue.toLocaleString('en-IN')})`);
    }

    // Calculate portfolio-level XIRR
    const portfolioCashflows = this.generatePortfolioCashflows(totalInvested, totalCurrentValue);
    const portfolioXirr = this.calculateXirr(portfolioCashflows);

    const calculationTrace = [
      '=== XIRR Calculation Trace ===',
      `Total Invested: ₹${totalInvested.toLocaleString('en-IN')}`,
      `Current Value: ₹${totalCurrentValue.toLocaleString('en-IN')}`,
      `Absolute Return: ${(((totalCurrentValue - totalInvested) / totalInvested) * 100).toFixed(2)}%`,
      '',
      '--- Per-Fund XIRR ---',
      ...traceLines,
      '',
      `--- Portfolio XIRR: ${portfolioXirr.toFixed(2)}% ---`,
      '',
      'Method: Newton-Raphson iteration (max 100 iterations, tolerance 0.0001)',
    ].join('\n');

    const xirrResults: XirrResults = {
      portfolioXirr,
      fundXirrs,
      calculationTrace,
    };

    state.set('xirr_results', xirrResults);
    console.log(`[Agent: ${this.name}] Portfolio XIRR: ${portfolioXirr.toFixed(2)}%`);
  }

  /**
   * Generate simulated cashflows for a fund
   * In production, this would come from actual transaction history (CAMS/KFintech)
   */
  private generateCashflows(investedAmount: number, currentValue: number, fundName: string): Cashflow[] {
    const now = new Date();
    const cashflows: Cashflow[] = [];
    
    // Simulate SIP investments over the past 2-3 years
    const monthsInvested = 24 + Math.floor(Math.random() * 12); // 24-36 months
    const sipAmount = investedAmount / monthsInvested;
    
    for (let i = monthsInvested; i >= 1; i--) {
      const investDate = new Date(now);
      investDate.setMonth(investDate.getMonth() - i);
      
      cashflows.push({
        date: investDate.toISOString().split('T')[0],
        amount: -sipAmount, // Negative = outflow
        type: 'investment',
      });
    }

    // Add current value as final positive cashflow
    cashflows.push({
      date: now.toISOString().split('T')[0],
      amount: currentValue,
      type: 'current_value',
    });

    return cashflows;
  }

  /**
   * Generate portfolio-level cashflows
   */
  private generatePortfolioCashflows(totalInvested: number, totalCurrentValue: number): Cashflow[] {
    const now = new Date();
    const monthsInvested = 30; // Assume 30 months average
    const sipAmount = totalInvested / monthsInvested;
    
    const cashflows: Cashflow[] = [];
    
    for (let i = monthsInvested; i >= 1; i--) {
      const investDate = new Date(now);
      investDate.setMonth(investDate.getMonth() - i);
      
      cashflows.push({
        date: investDate.toISOString().split('T')[0],
        amount: -sipAmount,
        type: 'investment',
      });
    }

    cashflows.push({
      date: now.toISOString().split('T')[0],
      amount: totalCurrentValue,
      type: 'current_value',
    });

    return cashflows;
  }

  /**
   * Calculate XIRR using Newton-Raphson method
   */
  private calculateXirr(cashflows: Cashflow[]): number {
    if (cashflows.length < 2) return 0;

    const dates = cashflows.map(cf => new Date(cf.date).getTime());
    const amounts = cashflows.map(cf => cf.amount);
    const minDate = Math.min(...dates);

    // Convert dates to years from first date
    const years = dates.map(d => (d - minDate) / (365.25 * 24 * 60 * 60 * 1000));

    // Newton-Raphson iteration
    let rate = 0.1; // Initial guess: 10%
    const tolerance = 0.0001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;

      for (let j = 0; j < amounts.length; j++) {
        const discountFactor = Math.pow(1 + rate, years[j]);
        npv += amounts[j] / discountFactor;
        derivative -= years[j] * amounts[j] / Math.pow(1 + rate, years[j] + 1);
      }

      if (Math.abs(derivative) < 1e-10) break; // Avoid division by zero

      const newRate = rate - npv / derivative;
      
      if (Math.abs(newRate - rate) < tolerance) {
        return Math.round(newRate * 10000) / 100; // Convert to percentage with 2 decimals
      }

      rate = newRate;

      // Clamp to reasonable range
      if (rate < -0.99) rate = -0.99;
      if (rate > 10) rate = 10; // 1000% max
    }

    return Math.round(rate * 10000) / 100;
  }
}
