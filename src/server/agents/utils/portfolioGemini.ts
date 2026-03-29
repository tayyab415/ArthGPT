import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import type { 
  PortfolioInput, 
  PortfolioData, 
  PortfolioFund,
  RebalancingPlan,
  RebalancingRecommendation,
  XirrResults,
  OverlapData,
  ExpenseAnalysis,
  BenchmarkComparison,
} from '../core/SessionState';
import { MODELS } from './gemini';

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Extract and standardize portfolio data from raw input using Gemini Flash.
 */
export async function extractPortfolioData(rawInput: PortfolioInput): Promise<PortfolioData> {
  const prompt = `You are a mutual fund analyst. Parse the following fund data and standardize it.
For each fund:
1. Identify if it's Regular or Direct plan (look for "Regular", "Direct" in name, or default to Regular)
2. Categorize it: Large Cap, Mid Cap, Small Cap, Flexi Cap, Multi Cap, Index, or Other
3. Identify the AMC (HDFC, SBI, Mirae, Axis, ICICI, etc.)
4. Calculate current value as units × NAV

Input data:
${JSON.stringify(rawInput, null, 2)}

Extract the structured portfolio data.`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          funds: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Fund name' },
                units: { type: Type.NUMBER, description: 'Number of units' },
                nav: { type: Type.NUMBER, description: 'Current NAV' },
                currentValue: { type: Type.NUMBER, description: 'Current value (units × NAV)' },
                investedAmount: { type: Type.NUMBER, description: 'Amount invested' },
                planType: { type: Type.STRING, description: 'Regular or Direct' },
                category: { type: Type.STRING, description: 'Fund category' },
                amc: { type: Type.STRING, description: 'Asset Management Company' },
              },
              required: ['name', 'units', 'nav', 'currentValue', 'investedAmount', 'planType', 'category', 'amc'],
            },
          },
          totalValue: { type: Type.NUMBER, description: 'Total portfolio value' },
          riskProfile: { type: Type.STRING, description: 'Risk profile from input' },
          extractionConfidence: { type: Type.STRING, description: 'Confidence level: HIGH, MEDIUM, or LOW' },
        },
        required: ['funds', 'totalValue', 'riskProfile', 'extractionConfidence'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  
  return {
    funds: (result.funds || []).map((f: PortfolioFund) => ({
      name: f.name,
      units: f.units,
      nav: f.nav,
      currentValue: f.currentValue || f.units * f.nav,
      investedAmount: f.investedAmount || f.currentValue * 0.9,
      planType: f.planType === 'Direct' ? 'Direct' : 'Regular',
      category: f.category as PortfolioFund['category'] || 'Other',
      amc: f.amc || 'Unknown AMC',
    })),
    totalValue: result.totalValue || 0,
    riskProfile: result.riskProfile || rawInput.riskProfile,
    extractionConfidence: (result.extractionConfidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
  };
}

/**
 * Generate rebalancing recommendations using Gemini Pro.
 * Synthesizes all Stage 2 outputs + risk profile.
 */
export async function generateRebalancingPlan(
  portfolioData: PortfolioData,
  xirrResults: XirrResults,
  overlapData: OverlapData,
  expenseAnalysis: ExpenseAnalysis,
  benchmarkComparison: BenchmarkComparison
): Promise<RebalancingPlan> {
  const prompt = `You are an expert portfolio rebalancing strategist. Analyze the following portfolio data and generate specific, actionable rebalancing recommendations.

PORTFOLIO OVERVIEW:
- Total Value: ₹${portfolioData.totalValue.toLocaleString('en-IN')}
- Risk Profile: ${portfolioData.riskProfile}
- Number of Funds: ${portfolioData.funds.length}

XIRR ANALYSIS:
- Portfolio XIRR: ${xirrResults.portfolioXirr}%
${xirrResults.fundXirrs.map(f => `- ${f.fund}: ${f.xirr}%`).join('\n')}

OVERLAP ANALYSIS:
- Total Overlapping Stocks: ${overlapData.totalOverlappingStocks}
- Concentration Risk: ${overlapData.concentrationRisk}
- Top Overlaps: ${overlapData.overlapMatrix.slice(0, 5).map(o => `${o.stock} (${o.combinedWeight}% across ${o.funds.length} funds)`).join(', ')}

EXPENSE ANALYSIS:
- Total Annual Expense Drag: ₹${expenseAnalysis.totalExpenseDrag.toLocaleString('en-IN')}
${expenseAnalysis.fundExpenses.filter(f => f.switchRecommended).map(f => `- ${f.fund}: Switch to Direct to save ₹${f.annualDrag.toLocaleString('en-IN')}/year`).join('\n')}

BENCHMARK COMPARISON:
${benchmarkComparison.funds.map(f => `- ${f.fund}: ${f.underperformer ? '⚠️ UNDERPERFORMING' : '✓'} ${f.fund3Y}% vs ${f.benchmark3Y}% (${f.benchmark})`).join('\n')}

Generate 2-3 specific rebalancing recommendations. For each:
1. Specify exact fund to redeem and units
2. Suggest alternative fund to invest
3. Explain the rationale (overlap reduction, expense savings, performance improvement)
4. Estimate tax implications (STCG if held <1yr, LTCG if >1yr)
5. Quantify expected benefits

IMPORTANT: All recommendations must be educational guidance, NOT investment advice. Include appropriate disclaimers.`;

  const response = await ai.models.generateContent({
    model: MODELS.PRO,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fundToRedeem: { type: Type.STRING, description: 'Fund name to redeem from' },
                units: { type: Type.NUMBER, description: 'Number of units to redeem' },
                currentValue: { type: Type.NUMBER, description: 'Current value of units to redeem' },
                holdingPeriod: { type: Type.STRING, description: 'How long the investment has been held' },
                taxImplication: { type: Type.STRING, description: 'STCG, LTCG, or No Tax' },
                estimatedTax: { type: Type.NUMBER, description: 'Estimated tax amount' },
                fundToInvest: { type: Type.STRING, description: 'Recommended fund to invest in' },
                reason: { type: Type.STRING, description: 'Main reason for this recommendation' },
                expenseBenefit: { type: Type.STRING, description: 'Expected expense ratio benefit' },
                overlapReduction: { type: Type.STRING, description: 'Expected overlap reduction' },
              },
              required: ['fundToRedeem', 'units', 'currentValue', 'holdingPeriod', 'taxImplication', 'estimatedTax', 'fundToInvest', 'reason', 'expenseBenefit', 'overlapReduction'],
            },
          },
          narrative: { type: Type.STRING, description: 'Overall narrative explaining the rebalancing strategy' },
          totalExpectedSavings: { type: Type.NUMBER, description: 'Total expected annual savings from all recommendations' },
        },
        required: ['recommendations', 'narrative', 'totalExpectedSavings'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');

  return {
    recommendations: (result.recommendations || []).map((r: RebalancingRecommendation) => ({
      fundToRedeem: r.fundToRedeem,
      units: r.units,
      currentValue: r.currentValue,
      holdingPeriod: r.holdingPeriod,
      taxImplication: r.taxImplication as 'STCG' | 'LTCG' | 'No Tax',
      estimatedTax: r.estimatedTax,
      fundToInvest: r.fundToInvest,
      reason: r.reason,
      expenseBenefit: r.expenseBenefit,
      overlapReduction: r.overlapReduction,
    })),
    narrative: result.narrative || 'Portfolio analysis complete. See recommendations above.',
    totalExpectedSavings: result.totalExpectedSavings || expenseAnalysis.totalExpenseDrag,
    disclaimer: 'This is AI-generated educational guidance, NOT licensed investment advice. Mutual fund investments are subject to market risks. Please consult a SEBI-registered investment advisor before making investment decisions.',
  };
}

/**
 * Fallback rebalancing generation when Gemini is unavailable
 */
export function generateFallbackRebalancingPlan(
  portfolioData: PortfolioData,
  expenseAnalysis: ExpenseAnalysis,
  overlapData: OverlapData
): RebalancingPlan {
  const recommendations: RebalancingRecommendation[] = [];

  // Find funds to switch from Regular to Direct
  const regularFunds = expenseAnalysis.fundExpenses.filter(f => f.switchRecommended);
  
  for (const fund of regularFunds.slice(0, 2)) {
    const portfolioFund = portfolioData.funds.find(f => f.name.includes(fund.fund.split(' ')[0]));
    
    if (portfolioFund) {
      recommendations.push({
        fundToRedeem: fund.fund,
        units: portfolioFund.units,
        currentValue: portfolioFund.currentValue,
        holdingPeriod: '14 months (estimated)',
        taxImplication: 'LTCG',
        estimatedTax: Math.round(portfolioFund.currentValue * 0.003), // ~0.3% estimated
        fundToInvest: fund.fund.replace('Regular', 'Direct'),
        reason: 'Switch to Direct plan to eliminate distributor commission',
        expenseBenefit: `${(fund.regularER - fund.directER).toFixed(2)}% lower expense ratio`,
        overlapReduction: 'No change (same fund, different plan)',
      });
    }
  }

  return {
    recommendations,
    narrative: `Your portfolio has ${regularFunds.length} fund(s) where switching from Regular to Direct plan would save you ₹${expenseAnalysis.totalExpenseDrag.toLocaleString('en-IN')} annually. Additionally, ${overlapData.totalOverlappingStocks} stocks are present across multiple funds, creating concentration risk.`,
    totalExpectedSavings: expenseAnalysis.totalExpenseDrag,
    disclaimer: 'This is AI-generated educational guidance, NOT licensed investment advice. Mutual fund investments are subject to market risks. Please consult a SEBI-registered investment advisor before making investment decisions.',
  };
}
