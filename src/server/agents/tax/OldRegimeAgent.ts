import { DeterministicAgent } from '../core/Agent';
import { SessionState, type TaxSessionState } from '../core/SessionState';
import type { TaxResult } from '../../taxEngine';

/**
 * Calculate old regime tax slabs.
 * This is deterministic math - no LLM involved.
 */
function calculateOldRegimeSlabs(taxableIncome: number): { tax: number; breakdown: { slab: string; rate: string; amount: number }[] } {
  const breakdown: { slab: string; rate: string; amount: number }[] = [];
  let remaining = taxableIncome;
  let tax = 0;

  // Slab 1: Up to ₹2.5L — 0%
  const slab1 = Math.min(remaining, 250000);
  breakdown.push({ slab: '₹0 – ₹2,50,000', rate: '0%', amount: 0 });
  remaining -= slab1;

  // Slab 2: ₹2.5L – ₹5L — 5%
  if (remaining > 0) {
    const slab2 = Math.min(remaining, 250000);
    const slab2Tax = slab2 * 0.05;
    tax += slab2Tax;
    breakdown.push({ slab: '₹2,50,001 – ₹5,00,000', rate: '5%', amount: slab2Tax });
    remaining -= slab2;
  }

  // Slab 3: ₹5L – ₹10L — 20%
  if (remaining > 0) {
    const slab3 = Math.min(remaining, 500000);
    const slab3Tax = slab3 * 0.20;
    tax += slab3Tax;
    breakdown.push({ slab: '₹5,00,001 – ₹10,00,000', rate: '20%', amount: slab3Tax });
    remaining -= slab3;
  }

  // Slab 4: Above ₹10L — 30%
  if (remaining > 0) {
    const slab4Tax = remaining * 0.30;
    tax += slab4Tax;
    breakdown.push({ slab: 'Above ₹10,00,000', rate: '30%', amount: slab4Tax });
  }

  return { tax, breakdown };
}

/**
 * Stage 2A: Old Regime Calculator Agent
 * 
 * Executes deterministic old tax regime computation.
 * Wraps the existing tax slab logic from taxEngine.ts.
 * Writes to session_state.old_tax_result.
 */
export class OldRegimeAgent extends DeterministicAgent<TaxSessionState> {
  constructor() {
    super('OldRegimeCalc', 2);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const salary = state.get('salary_structure');
    
    if (!salary) {
      throw new Error('No salary_structure found in session state. InputCollector must run first.');
    }

    console.log(`[Agent: ${this.name}] Computing old regime tax...`);

    const grossSalary = salary.baseSalary + salary.hraReceived;
    const standardDeduction = 50000;

    // HRA Exemption calculation (Section 10(13A))
    const hra1 = salary.hraReceived;
    const hra2 = salary.isMetro ? salary.baseSalary * 0.5 : salary.baseSalary * 0.4;
    const hra3 = Math.max(0, salary.rentPaid - (salary.baseSalary * 0.1));
    const hraExemption = salary.rentPaid > 0 ? Math.min(hra1, hra2, hra3) : 0;

    // Deductions under Chapter VI-A
    const section80C = Math.min(salary.section80C, 150000);
    const section80CCD1B = Math.min(salary.section80CCD1B, 50000);
    const section80D = Math.min(salary.section80D, 100000);
    const homeLoanInterest = Math.min(salary.homeLoanInterest, 200000);

    // Calculate taxable income
    const taxableIncome = Math.max(0,
      grossSalary
      - standardDeduction
      - hraExemption
      - section80C
      - section80CCD1B
      - section80D
      - homeLoanInterest
    );

    // Calculate tax using slabs
    const slabResult = calculateOldRegimeSlabs(taxableIncome);
    const taxOnSlab = slabResult.tax;

    // Rebate 87A: up to ₹12,500 if taxable income ≤ ₹5L
    const rebate87A = taxableIncome <= 500000 ? Math.min(taxOnSlab, 12500) : 0;
    const taxAfterRebate = Math.max(0, taxOnSlab - rebate87A);

    // Health & Education Cess (4%)
    const cess = taxAfterRebate * 0.04;
    const totalTaxLiability = taxAfterRebate + cess;

    const result: TaxResult = {
      grossSalary,
      standardDeduction,
      hraExemption,
      section80C,
      section80CCD1B,
      homeLoanInterest,
      section80D,
      taxableIncome,
      taxOnSlab,
      rebate87A,
      taxAfterRebate,
      cess,
      totalTaxLiability,
      slabBreakdown: slabResult.breakdown,
    };

    console.log(`[Agent: ${this.name}] Old regime tax: ₹${totalTaxLiability.toLocaleString('en-IN')}`);

    state.set('old_tax_result', result);
  }
}
