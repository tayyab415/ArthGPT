export interface TaxInput {
  baseSalary: number;
  hraReceived: number;
  rentPaid: number;
  section80C: number;
  section80CCD1B: number;
  section80D: number;
  homeLoanInterest: number;
  isMetro: boolean;
}

export interface TaxResult {
  grossSalary: number;
  standardDeduction: number;
  hraExemption: number;
  section80C: number;
  section80CCD1B: number;
  homeLoanInterest: number;
  section80D: number;
  taxableIncome: number;
  taxOnSlab: number;
  rebate87A: number;
  taxAfterRebate: number;
  cess: number;
  totalTaxLiability: number;
  slabBreakdown: { slab: string; rate: string; amount: number }[];
}

export interface TaxComparison {
  oldRegime: TaxResult;
  newRegime: TaxResult;
  winner: 'old' | 'new';
  savings: number;
  missedDeductions: {
    section80D: number;
    section80CCD1B: number;
    potentialTaxSaving80D: number;
    potentialTaxSaving80CCD1B: number;
  };
  hraBreakdown: {
    hraReceived: number;
    metroLimit: number;
    rentMinus10Percent: number;
  };
}

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

export function calculateTax(input: TaxInput): TaxComparison {
  // Sanitise all inputs — protect against NaN, negative, and undefined
  const safe = (v: unknown) => Math.max(0, Number(v) || 0);
  const baseSalary = safe(input.baseSalary);
  const hraReceived = safe(input.hraReceived);
  const rentPaid = safe(input.rentPaid);
  const s80C = Math.min(safe(input.section80C), 150000);
  const s80CCD1B = Math.min(safe(input.section80CCD1B), 50000);
  const s80D = Math.min(safe(input.section80D), 100000);
  const hlInterest = Math.min(safe(input.homeLoanInterest), 200000);
  const isMetro = Boolean(input.isMetro);

  const grossSalary = baseSalary + hraReceived;

  // --- Old Regime ---
  const oldStandardDeduction = 50000;
  
  // HRA Exemption (Section 10(13A))
  const hra1 = hraReceived;
  const hra2 = isMetro ? baseSalary * 0.5 : baseSalary * 0.4;
  const hra3 = Math.max(0, rentPaid - (baseSalary * 0.1));
  const oldHraExemption = rentPaid > 0 ? Math.min(hra1, hra2, hra3) : 0;

  // Deductions under Chapter VI-A
  const old80C = s80C;
  const old80CCD1B = s80CCD1B;
  const old80D = s80D;
  const oldHomeLoan = hlInterest;

  const oldTaxableIncome = Math.max(0,
    grossSalary
    - oldStandardDeduction
    - oldHraExemption
    - old80C
    - old80CCD1B
    - old80D
    - oldHomeLoan
  );

  const oldSlabResult = calculateOldRegimeSlabs(oldTaxableIncome);
  let oldTaxOnSlab = oldSlabResult.tax;

  // Rebate 87A (Old Regime): up to ₹12,500 if taxable income ≤ ₹5L
  let oldRebate87A = 0;
  if (oldTaxableIncome <= 500000) {
    oldRebate87A = Math.min(oldTaxOnSlab, 12500);
  }
  const oldTaxAfterRebate = Math.max(0, oldTaxOnSlab - oldRebate87A);

  const oldCess = oldTaxAfterRebate * 0.04;
  const oldTotalTax = oldTaxAfterRebate + oldCess;

  // --- New Regime (Section 115BAC — FY 2025-26) ---
  const newStandardDeduction = 75000;
  // Only standard deduction allowed (and employer NPS 80CCD(2) — not in scope here)
  const newTaxableIncome = Math.max(0, grossSalary - newStandardDeduction);

  const newSlabResult = calculateNewRegimeSlabs(newTaxableIncome);
  let newTaxOnSlab = newSlabResult.tax;

  // Rebate 87A (New Regime): 100% rebate up to ₹60,000 if total income ≤ ₹12L
  let newRebate87A = 0;
  if (newTaxableIncome <= 1200000) {
    newRebate87A = Math.min(newTaxOnSlab, 60000);
  }
  const newTaxAfterRebate = Math.max(0, newTaxOnSlab - newRebate87A);

  const newCess = newTaxAfterRebate * 0.04;
  const newTotalTax = newTaxAfterRebate + newCess;

  const winner = newTotalTax <= oldTotalTax ? 'new' : 'old';
  const savings = Math.abs(oldTotalTax - newTotalTax);

  // Calculate potential savings from missed deductions (using marginal old regime slab rate)
  const marginalRate = oldTaxableIncome > 1000000 ? 0.312 : oldTaxableIncome > 500000 ? 0.208 : 0.052;
  const missed80D = Math.max(0, 25000 - s80D);
  const missed80CCD1B = Math.max(0, 50000 - s80CCD1B);

  return {
    oldRegime: {
      grossSalary,
      standardDeduction: oldStandardDeduction,
      hraExemption: oldHraExemption,
      section80C: old80C,
      section80CCD1B: old80CCD1B,
      homeLoanInterest: oldHomeLoan,
      section80D: old80D,
      taxableIncome: oldTaxableIncome,
      taxOnSlab: oldTaxOnSlab,
      rebate87A: oldRebate87A,
      taxAfterRebate: oldTaxAfterRebate,
      cess: oldCess,
      totalTaxLiability: oldTotalTax,
      slabBreakdown: oldSlabResult.breakdown,
    },
    newRegime: {
      grossSalary,
      standardDeduction: newStandardDeduction,
      hraExemption: 0,
      section80C: 0,
      section80CCD1B: 0,
      homeLoanInterest: 0,
      section80D: 0,
      taxableIncome: newTaxableIncome,
      taxOnSlab: newTaxOnSlab,
      rebate87A: newRebate87A,
      taxAfterRebate: newTaxAfterRebate,
      cess: newCess,
      totalTaxLiability: newTotalTax,
      slabBreakdown: newSlabResult.breakdown,
    },
    winner,
    savings,
    missedDeductions: {
      section80D: missed80D,
      section80CCD1B: missed80CCD1B,
      potentialTaxSaving80D: Math.round(missed80D * marginalRate),
      potentialTaxSaving80CCD1B: Math.round(missed80CCD1B * marginalRate),
    },
    hraBreakdown: {
      hraReceived: hra1,
      metroLimit: hra2,
      rentMinus10Percent: hra3,
    },
  };
}
