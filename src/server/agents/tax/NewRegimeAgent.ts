import { DeterministicAgent } from '../core/Agent';
import { SessionState, type TaxSessionState } from '../core/SessionState';
import type { TaxResult } from '../../taxEngine';

/**
 * Calculate new regime tax slabs (FY 2025-26).
 * This is deterministic math - no LLM involved.
 */
function calculateNewRegimeSlabs(taxableIncome: number): { tax: number; breakdown: { slab: string; rate: string; amount: number }[] } {
  const breakdown: { slab: string; rate: string; amount: number }[] = [];
  let remaining = taxableIncome;
  let tax = 0;

  // Slab 1: Up to ₹4L — 0%
  const slab1 = Math.min(remaining, 400000);
  breakdown.push({ slab: '₹0 – ₹4,00,000', rate: '0%', amount: 0 });
  remaining -= slab1;

  // Slab 2: ₹4L – ₹8L — 5%
  if (remaining > 0) {
    const slab2 = Math.min(remaining, 400000);
    const slab2Tax = slab2 * 0.05;
    tax += slab2Tax;
    breakdown.push({ slab: '₹4,00,001 – ₹8,00,000', rate: '5%', amount: slab2Tax });
    remaining -= slab2;
  }

  // Slab 3: ₹8L – ₹12L — 10%
  if (remaining > 0) {
    const slab3 = Math.min(remaining, 400000);
    const slab3Tax = slab3 * 0.10;
    tax += slab3Tax;
    breakdown.push({ slab: '₹8,00,001 – ₹12,00,000', rate: '10%', amount: slab3Tax });
    remaining -= slab3;
  }

  // Slab 4: ₹12L – ₹16L — 15%
  if (remaining > 0) {
    const slab4 = Math.min(remaining, 400000);
    const slab4Tax = slab4 * 0.15;
    tax += slab4Tax;
    breakdown.push({ slab: '₹12,00,001 – ₹16,00,000', rate: '15%', amount: slab4Tax });
    remaining -= slab4;
  }

  // Slab 5: ₹16L – ₹20L — 20%
  if (remaining > 0) {
    const slab5 = Math.min(remaining, 400000);
    const slab5Tax = slab5 * 0.20;
    tax += slab5Tax;
    breakdown.push({ slab: '₹16,00,001 – ₹20,00,000', rate: '20%', amount: slab5Tax });
    remaining -= slab5;
  }

  // Slab 6: ₹20L – ₹24L — 25%
  if (remaining > 0) {
    const slab6 = Math.min(remaining, 400000);
    const slab6Tax = slab6 * 0.25;
    tax += slab6Tax;
    breakdown.push({ slab: '₹20,00,001 – ₹24,00,000', rate: '25%', amount: slab6Tax });
    remaining -= slab6;
  }

  // Slab 7: Above ₹24L — 30%
  if (remaining > 0) {
    const slab7Tax = remaining * 0.30;
    tax += slab7Tax;
    breakdown.push({ slab: 'Above ₹24,00,000', rate: '30%', amount: slab7Tax });
  }

  return { tax, breakdown };
}

/**
 * Stage 2B: New Regime Calculator Agent
 * 
 * Executes deterministic new tax regime computation (Section 115BAC, FY 2025-26).
 * Wraps the existing tax slab logic from taxEngine.ts.
 * Writes to session_state.new_tax_result.
 */
export class NewRegimeAgent extends DeterministicAgent<TaxSessionState> {
  constructor() {
    super('NewRegimeCalc', 2);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const salary = state.get('salary_structure');
    
    if (!salary) {
      throw new Error('No salary_structure found in session state. InputCollector must run first.');
    }

    console.log(`[Agent: ${this.name}] Computing new regime tax...`);

    const grossSalary = salary.baseSalary + salary.hraReceived;
    
    // New regime: Only standard deduction of ₹75,000 allowed
    const standardDeduction = 75000;
    
    // No other deductions in new regime
    const taxableIncome = Math.max(0, grossSalary - standardDeduction);

    // Calculate tax using new regime slabs
    const slabResult = calculateNewRegimeSlabs(taxableIncome);
    const taxOnSlab = slabResult.tax;

    // Rebate 87A (New Regime): 100% rebate up to ₹60,000 if total income ≤ ₹12L
    const rebate87A = taxableIncome <= 1200000 ? Math.min(taxOnSlab, 60000) : 0;
    const taxAfterRebate = Math.max(0, taxOnSlab - rebate87A);

    // Health & Education Cess (4%)
    const cess = taxAfterRebate * 0.04;
    const totalTaxLiability = taxAfterRebate + cess;

    const result: TaxResult = {
      grossSalary,
      standardDeduction,
      hraExemption: 0,  // No HRA exemption in new regime
      section80C: 0,     // No 80C in new regime
      section80CCD1B: 0, // No 80CCD(1B) in new regime
      homeLoanInterest: 0, // No home loan interest in new regime
      section80D: 0,     // No 80D in new regime
      taxableIncome,
      taxOnSlab,
      rebate87A,
      taxAfterRebate,
      cess,
      totalTaxLiability,
      slabBreakdown: slabResult.breakdown,
    };

    console.log(`[Agent: ${this.name}] New regime tax: ₹${totalTaxLiability.toLocaleString('en-IN')}`);

    state.set('new_tax_result', result);
  }
}
