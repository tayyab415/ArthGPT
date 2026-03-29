import { LlmAgent } from '../core/Agent';
import { SessionState, type TaxSessionState, type TaxOptimization, type SalaryStructure, type TaxResult } from '../core/SessionState';
import { generateTaxOptimization, MODELS } from '../utils/gemini';

/**
 * Stage 3: Tax Optimizer Agent
 * 
 * Reads old_tax_result and new_tax_result, reasons about the differences,
 * identifies missed deductions (like 80CCD1B), and outputs a final narrative.
 * Writes to session_state.tax_optimization.
 * 
 * Uses Gemini 3.1 Pro for deep reasoning.
 * Falls back to deterministic analysis if LLM unavailable.
 */
export class TaxOptimizerAgent extends LlmAgent<TaxSessionState> {
  constructor() {
    super('TaxOptimizer', 3, MODELS.PRO);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const oldResult = state.get('old_tax_result');
    const newResult = state.get('new_tax_result');
    const salaryStructure = state.get('salary_structure');
    
    if (!oldResult || !newResult) {
      throw new Error('Stage 2 results not found. OldRegimeCalc and NewRegimeCalc must run first.');
    }
    
    if (!salaryStructure) {
      throw new Error('No salary_structure found. InputCollector must run first.');
    }

    console.log(`[Agent: ${this.name}] Generating tax optimization analysis...`);
    console.log(`[Agent: ${this.name}] Old regime: ₹${oldResult.totalTaxLiability.toLocaleString('en-IN')}`);
    console.log(`[Agent: ${this.name}] New regime: ₹${newResult.totalTaxLiability.toLocaleString('en-IN')}`);

    let optimization: TaxOptimization;

    try {
      // Use Gemini Pro for deep reasoning about tax optimization
      optimization = await generateTaxOptimization(oldResult, newResult, salaryStructure);
    } catch (error) {
      // Fallback: deterministic analysis when LLM unavailable
      console.log(`[Agent: ${this.name}] LLM unavailable, using deterministic analysis`);
      optimization = this.generateDeterministicOptimization(oldResult, newResult, salaryStructure);
    }

    console.log(`[Agent: ${this.name}] Optimization complete:`);
    console.log(`  - Winner: ${optimization.winner.toUpperCase()} regime`);
    console.log(`  - Savings: ₹${optimization.savings.toLocaleString('en-IN')}`);
    console.log(`  - Missed deductions: ${optimization.missedDeductions.length}`);
    console.log(`  - Suggestions: ${optimization.suggestions.length}`);

    state.set('tax_optimization', optimization);
  }

  /**
   * Fallback deterministic analysis when LLM is unavailable
   */
  private generateDeterministicOptimization(
    oldResult: TaxResult,
    newResult: TaxResult,
    salaryStructure: SalaryStructure
  ): TaxOptimization {
    const winner = oldResult.totalTaxLiability < newResult.totalTaxLiability ? 'old' : 'new';
    const savings = Math.abs(oldResult.totalTaxLiability - newResult.totalTaxLiability);

    const missedDeductions = [];
    const suggestions = [];

    // Check for common missed deductions
    if (salaryStructure.section80CCD1B === 0 || salaryStructure.section80CCD1B === undefined) {
      missedDeductions.push({
        section: '80CCD(1B)',
        missedAmount: 50000,
        potentialSaving: 15600,
        description: 'NPS contribution up to ₹50,000 is deductible under this section.',
      });
      suggestions.push({
        instrument: 'NPS Tier-1',
        section: '80CCD(1B)',
        maxBenefit: 50000,
        lockIn: 'Till retirement',
        riskLevel: 'Medium',
        description: 'Invest up to ₹50,000 in NPS Tier-1 for additional tax savings.',
      });
    }

    if ((salaryStructure.section80D === 0 || salaryStructure.section80D === undefined) && winner === 'old') {
      missedDeductions.push({
        section: '80D',
        missedAmount: 25000,
        potentialSaving: 7800,
        description: 'Health insurance premium up to ₹25,000 is deductible.',
      });
      suggestions.push({
        instrument: 'Health Insurance',
        section: '80D',
        maxBenefit: 25000,
        lockIn: 'Annual',
        riskLevel: 'Low',
        description: 'Get health insurance to save taxes and protect against medical expenses.',
      });
    }

    if (salaryStructure.section80C < 150000 && winner === 'old') {
      const remaining = 150000 - salaryStructure.section80C;
      missedDeductions.push({
        section: '80C',
        missedAmount: remaining,
        potentialSaving: Math.round(remaining * 0.312),
        description: `You have ₹${remaining.toLocaleString('en-IN')} unused in 80C limit.`,
      });
      suggestions.push({
        instrument: 'ELSS Funds',
        section: '80C',
        maxBenefit: remaining,
        lockIn: '3 years',
        riskLevel: 'High',
        description: 'ELSS offers best liquidity among 80C options with equity market returns.',
      });
    }

    const narrative = `Based on your inputs, the **${winner.toUpperCase()} REGIME** saves you **₹${savings.toLocaleString('en-IN')}** in taxes.

${winner === 'old' 
  ? `Old Regime works better for you because your deductions (80C, HRA exemption, etc.) reduce your taxable income significantly.`
  : `New Regime works better for you because the lower slab rates and standard deduction outweigh your claimed deductions.`}

${missedDeductions.length > 0 
  ? `\n**Optimization Opportunity:** You haven't utilized ${missedDeductions.map(d => d.section).join(', ')}. By investing in these, you could save an additional ₹${missedDeductions.reduce((sum, d) => sum + d.potentialSaving, 0).toLocaleString('en-IN')}.`
  : ''}`;

    const disclaimer = 'This is AI-generated educational guidance for informational purposes only. It is not professional tax or financial advice. Tax laws change frequently — please consult a qualified tax advisor or CA for your specific situation.';

    return {
      winner,
      savings,
      missedDeductions,
      suggestions,
      narrative,
      disclaimer,
    };
  }
}
