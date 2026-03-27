export interface FireInput {
  age: number;
  retireAge: number;
  income: number;
  existingMfCorpus: number;
  existingPpfCorpus: number;
  targetMonthlyDraw: number; // in today's money
  declaredLifeCover?: number;
}

export interface FireResult {
  inflationAdjustedTarget: number;
  requiredCorpus: number;
  existingCorpusFutureValue: number;
  gapToFill: number;
  requiredMonthlySip: number;
  insuranceGap: number;
  glidepath: { year: number; equity: number; debt: number }[];
  sipAllocation: { category: string; percentage: number; amount: number }[];
}

export function calculateFire(input: FireInput): FireResult {
  // Sanitise inputs
  const age = Math.max(18, Math.min(80, Number(input.age) || 18));
  const retireAge = Math.max(age + 1, Number(input.retireAge) || age + 10);
  const income = Math.max(0, Number(input.income) || 0);
  const existingMfCorpus = Math.max(0, Number(input.existingMfCorpus) || 0);
  const existingPpfCorpus = Math.max(0, Number(input.existingPpfCorpus) || 0);
  const targetMonthlyDraw = Math.max(1, Number(input.targetMonthlyDraw) || 50000);
  const declaredLifeCover = Math.max(0, Number(input.declaredLifeCover) || 0);

  const yearsToRetirement = retireAge - age; // guaranteed >= 1 from sanitisation
  const inflationRate = 0.06;
  const safeWithdrawalRate = 0.03;
  const equityReturn = 0.12;
  const ppfReturn = 0.071;

  // Step 1: Inflation-adjust the target
  const inflationAdjustedMonthlyDraw = targetMonthlyDraw * Math.pow(1 + inflationRate, yearsToRetirement);
  
  // Step 2: Calculate required corpus
  const requiredAnnualDraw = inflationAdjustedMonthlyDraw * 12;
  const requiredCorpus = requiredAnnualDraw / safeWithdrawalRate;

  // Step 3: Credit existing corpus
  const mfFutureValue = existingMfCorpus * Math.pow(1 + equityReturn, yearsToRetirement);
  const ppfFutureValue = existingPpfCorpus * Math.pow(1 + ppfReturn, yearsToRetirement);
  const existingCorpusFutureValue = mfFutureValue + ppfFutureValue;

  const gapToFill = Math.max(0, requiredCorpus - existingCorpusFutureValue);

  // Step 4: Back-calculate monthly SIP
  const months = yearsToRetirement * 12;
  const monthlyRate = equityReturn / 12;
  
  let requiredMonthlySip = 0;
  if (gapToFill > 0 && months > 0) {
    requiredMonthlySip = gapToFill / ( (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate * (1 + monthlyRate) );
  }

  // Step 5: Insurance gap (uses profile-provided life cover, no hardcoded fallback)
  const requiredLifeCover = income * 12; // 12x annual income
  const insuranceGap = Math.max(0, requiredLifeCover - declaredLifeCover);

  // Glidepath
  const currentYear = new Date().getFullYear();
  const glidepath = [];
  for (let i = 0; i <= yearsToRetirement; i += 5) {
    const year = currentYear + i;
    const remainingYears = yearsToRetirement - i;
    let equity = 75;
    let debt = 25;
    if (remainingYears <= 5) {
      equity = 40;
      debt = 60;
    } else if (remainingYears <= 10) {
      equity = 60;
      debt = 40;
    } else if (remainingYears <= 15) {
      equity = 70;
      debt = 30;
    }
    glidepath.push({ year, equity, debt });
  }

  return {
    inflationAdjustedTarget: inflationAdjustedMonthlyDraw,
    requiredCorpus,
    existingCorpusFutureValue,
    gapToFill,
    requiredMonthlySip,
    insuranceGap,
    glidepath,
    sipAllocation: [
      { category: 'Large Cap', percentage: 60, amount: requiredMonthlySip * 0.6 },
      { category: 'Mid/Small Cap', percentage: 25, amount: requiredMonthlySip * 0.25 },
      { category: 'Debt', percentage: 15, amount: requiredMonthlySip * 0.15 },
    ]
  };
}
