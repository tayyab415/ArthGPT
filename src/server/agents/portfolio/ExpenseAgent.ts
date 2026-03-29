import { LlmAgent } from '../core/Agent';
import { SessionState, type PortfolioSessionState, type ExpenseAnalysis } from '../core/SessionState';
import { mockRetrieveExpenseRatios } from './mockFundData';

/**
 * ExpenseAgent — Stage 2C
 * 
 * Analyzes expense ratios across funds and identifies switching opportunities
 * from Regular to Direct plans.
 * 
 * Calculates annual expense drag: (regular_ER - direct_ER) × portfolio_value
 */
export class ExpenseAgent extends LlmAgent<PortfolioSessionState> {
  constructor() {
    super('ExpenseAgent', 2, 'gemini-2.5-flash');
  }

  protected async run(state: SessionState<PortfolioSessionState>): Promise<void> {
    const portfolioData = state.get('portfolio_data');
    
    if (!portfolioData?.funds || portfolioData.funds.length === 0) {
      throw new Error('No portfolio data available for expense analysis');
    }

    console.log(`[Agent: ${this.name}] Analyzing expense ratios for ${portfolioData.funds.length} funds...`);

    // Retrieve expense ratios for all funds in parallel
    const expensePromises = portfolioData.funds.map(fund =>
      mockRetrieveExpenseRatios(fund.name).then(result => ({
        fund: fund.name,
        currentValue: fund.currentValue,
        planType: fund.planType,
        regularER: result.regularER,
        directER: result.directER,
        confidence: result.confidence,
        source: result.source,
      }))
    );

    const fundExpenses = await Promise.all(expensePromises);

    // Calculate expense analysis for each fund
    const expenseAnalysis: ExpenseAnalysis['fundExpenses'] = [];
    let totalExpenseDrag = 0;

    for (const expense of fundExpenses) {
      // Calculate annual drag
      const erDifference = expense.regularER - expense.directER;
      const annualDrag = Math.round((erDifference / 100) * expense.currentValue);
      
      // Recommend switch if:
      // 1. Currently in Regular plan
      // 2. Annual savings > ₹1000
      // 3. Fund value > ₹50,000
      const switchRecommended = 
        expense.planType === 'Regular' && 
        annualDrag > 1000 && 
        expense.currentValue > 50000;

      expenseAnalysis.push({
        fund: expense.fund,
        regularER: expense.regularER,
        directER: expense.directER,
        annualDrag,
        switchRecommended,
        confidence: expense.confidence,
      });

      // Add to total drag only for Regular plans
      if (expense.planType === 'Regular') {
        totalExpenseDrag += annualDrag;
      }
    }

    // Sort by annual drag (highest savings opportunity first)
    expenseAnalysis.sort((a, b) => b.annualDrag - a.annualDrag);

    const result: ExpenseAnalysis = {
      totalExpenseDrag,
      fundExpenses: expenseAnalysis,
    };

    state.set('expense_analysis', result);
    console.log(`[Agent: ${this.name}] Total annual expense drag: ₹${totalExpenseDrag.toLocaleString('en-IN')}`);
  }
}
