import type {
  FanChartPoint,
  FireInputs,
  GlidepathPoint,
  MacroParameters,
  MonteCarloResults,
  ShortfallAnalysis,
} from '../core/SessionState';

export const FIRE_SAFE_WITHDRAWAL_RATE = 0.03;
export const FIRE_STEP_UP_RATE = 0.10;
export const FIRE_DEFAULT_ITERATIONS = 1000;
export const FIRE_DEFAULT_SEED = 20260329;

interface SimulationInputs {
  fireInputs: FireInputs;
  macroParameters: MacroParameters;
  monthlySipOverride?: number;
  retirementAgeOverride?: number;
  targetMonthlyDrawOverride?: number;
  equityAllocationOverride?: number;
}

interface SimulationRunOptions extends SimulationInputs {
  iterations?: number;
  seed?: number;
  includeFanChart?: boolean;
}

interface SimulationSummary {
  successProbability: number;
  targetCorpusAtRetirement: number;
  retirementCorpusPercentiles: {
    p10: number;
    p50: number;
    p90: number;
  };
  fanChartData: FanChartPoint[];
  shortfallAnalysis: ShortfallAnalysis;
}

export function getMacroValue(metric: { value: number } | number | undefined, fallback = 0): number {
  if (typeof metric === 'number') {
    return metric;
  }

  if (metric && typeof metric.value === 'number' && Number.isFinite(metric.value)) {
    return metric.value;
  }

  return fallback;
}

export function buildGlidepath(fireInputs: FireInputs): GlidepathPoint[] {
  const years = Math.max(1, fireInputs.yearsToRetirement);
  const glidepath: GlidepathPoint[] = [];

  for (let offset = 0; offset <= years; offset += 1) {
    const progress = offset / years;
    const equity = Math.round(90 - (30 * progress));
    glidepath.push({
      age: fireInputs.currentAge + offset,
      equity,
      debt: 100 - equity,
    });
  }

  return glidepath;
}

export function getAllocationForAge(
  age: number,
  fireInputs: FireInputs,
): { equity: number; debt: number } {
  if (age >= fireInputs.retirementAge) {
    return { equity: 60, debt: 40 };
  }

  const years = Math.max(1, fireInputs.yearsToRetirement);
  const elapsed = Math.max(0, age - fireInputs.currentAge);
  const progress = Math.min(1, elapsed / years);
  const equity = 90 - (30 * progress);

  return {
    equity,
    debt: 100 - equity,
  };
}

export function computeTargetCorpus(
  fireInputs: FireInputs,
  macroParameters: MacroParameters,
): number {
  const inflationRate = getMacroValue(macroParameters.inflationRate, 0.06);
  const inflationAdjustedMonthlyDraw = fireInputs.targetMonthlyDrawToday * Math.pow(1 + inflationRate, fireInputs.yearsToRetirement);
  const annualDraw = inflationAdjustedMonthlyDraw * 12;

  return annualDraw / FIRE_SAFE_WITHDRAWAL_RATE;
}

export function projectCorpusAtRetirement(
  fireInputs: FireInputs,
  macroParameters: MacroParameters,
  monthlySip: number,
  options?: {
    retirementAgeOverride?: number;
    targetMonthlyDrawOverride?: number;
    conservative?: boolean;
  },
): number {
  const retirementAge = Math.max(fireInputs.currentAge + 1, options?.retirementAgeOverride ?? fireInputs.retirementAge);
  const effectiveInputs: FireInputs = {
    ...fireInputs,
    retirementAge,
    yearsToRetirement: retirementAge - fireInputs.currentAge,
    targetMonthlyDrawToday: options?.targetMonthlyDrawOverride ?? fireInputs.targetMonthlyDrawToday,
  };

  const equityMean = getMacroValue(macroParameters.niftyMeanReturn, 0.12) - (options?.conservative ? 0.03 : 0);
  const debtMean = Math.max(
    getMacroValue(macroParameters.fdRate, 0.068),
    getMacroValue(macroParameters.bondYield, 0.071),
  ) - (options?.conservative ? 0.01 : 0);

  let equityCorpus = effectiveInputs.existingMfCorpus;
  let debtCorpus = effectiveInputs.existingPpfCorpus;
  let runningSip = Math.max(0, monthlySip);

  for (let age = effectiveInputs.currentAge; age < effectiveInputs.retirementAge; age += 1) {
    const allocation = getAllocationForAge(age, effectiveInputs);
    const rebalancedCorpus = equityCorpus + debtCorpus;
    equityCorpus = rebalancedCorpus * (allocation.equity / 100);
    debtCorpus = rebalancedCorpus * (allocation.debt / 100);

    equityCorpus *= 1 + Math.max(-0.30, equityMean);
    debtCorpus *= 1 + Math.max(-0.05, debtMean);

    const annualSip = runningSip * 12;
    equityCorpus += annualSip * (allocation.equity / 100);
    debtCorpus += annualSip * (allocation.debt / 100);
    runningSip *= 1 + FIRE_STEP_UP_RATE;
  }

  return equityCorpus + debtCorpus;
}

export function solveRequiredSip(
  targetCorpus: number,
  fireInputs: FireInputs,
  macroParameters: MacroParameters,
  options?: {
    retirementAgeOverride?: number;
    targetMonthlyDrawOverride?: number;
    conservative?: boolean;
  },
): number {
  const currentCorpusProjection = projectCorpusAtRetirement(fireInputs, macroParameters, 0, options);
  if (currentCorpusProjection >= targetCorpus) {
    return 0;
  }

  let low = 0;
  let high = 500000;

  while (projectCorpusAtRetirement(fireInputs, macroParameters, high, options) < targetCorpus && high < 5000000) {
    high *= 2;
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const projected = projectCorpusAtRetirement(fireInputs, macroParameters, mid, options);
    if (projected >= targetCorpus) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.round(high);
}

export function runMonteCarlo(
  fireInputs: FireInputs,
  macroParameters: MacroParameters,
  options: {
    iterations?: number;
    seed?: number;
    monthlySipOverride?: number;
    retirementAgeOverride?: number;
    targetMonthlyDrawOverride?: number;
    equityAllocationOverride?: number;
  } = {},
): MonteCarloResults {
  const summary = runSimulationSummary({
    fireInputs,
    macroParameters,
    iterations: options.iterations ?? FIRE_DEFAULT_ITERATIONS,
    seed: options.seed ?? FIRE_DEFAULT_SEED,
    monthlySipOverride: options.monthlySipOverride,
    retirementAgeOverride: options.retirementAgeOverride,
    targetMonthlyDrawOverride: options.targetMonthlyDrawOverride,
    equityAllocationOverride: options.equityAllocationOverride,
    includeFanChart: true,
  });

  const targetCorpusAtRetirement = summary.targetCorpusAtRetirement;
  const inflationRate = getMacroValue(macroParameters.inflationRate, 0.06);
  const equityMean = getMacroValue(macroParameters.niftyMeanReturn, 0.12);
  const equityStd = getMacroValue(macroParameters.niftyStdDev, 0.18);
  const debtMean = Math.max(
    getMacroValue(macroParameters.fdRate, 0.068),
    getMacroValue(macroParameters.bondYield, 0.071),
  );

  const calculationTrace = [
    '=== FIRE Monte Carlo Trace ===',
    `Iterations: ${options.iterations ?? FIRE_DEFAULT_ITERATIONS}`,
    `Seed: ${options.seed ?? FIRE_DEFAULT_SEED}`,
    `Years to retirement: ${fireInputs.yearsToRetirement}`,
    `Live inflation assumption: ${(inflationRate * 100).toFixed(2)}%`,
    `Live Nifty mean return: ${(equityMean * 100).toFixed(2)}%`,
    `Live Nifty volatility: ${(equityStd * 100).toFixed(2)}%`,
    `Debt return assumption: ${(debtMean * 100).toFixed(2)}%`,
    `Current SIP used in simulation: ₹${Math.round(options.monthlySipOverride ?? fireInputs.currentMonthlySip).toLocaleString('en-IN')}/month`,
    `Target corpus at retirement: ₹${Math.round(targetCorpusAtRetirement).toLocaleString('en-IN')}`,
    `Success probability: ${summary.successProbability.toFixed(1)}%`,
    `Retirement corpus percentiles: P10 ₹${Math.round(summary.retirementCorpusPercentiles.p10).toLocaleString('en-IN')}, P50 ₹${Math.round(summary.retirementCorpusPercentiles.p50).toLocaleString('en-IN')}, P90 ₹${Math.round(summary.retirementCorpusPercentiles.p90).toLocaleString('en-IN')}`,
  ].join('\n');

  return {
    iterations: options.iterations ?? FIRE_DEFAULT_ITERATIONS,
    seed: options.seed ?? FIRE_DEFAULT_SEED,
    targetCorpusAtRetirement,
    successProbability: summary.successProbability,
    retirementCorpusPercentiles: summary.retirementCorpusPercentiles,
    fanChartData: summary.fanChartData,
    shortfallAnalysis: summary.shortfallAnalysis,
    calculationTrace,
  };
}

export function estimateSuccessProbability(
  fireInputs: FireInputs,
  macroParameters: MacroParameters,
  options: {
    iterations?: number;
    seed?: number;
    monthlySipOverride?: number;
    retirementAgeOverride?: number;
    targetMonthlyDrawOverride?: number;
    equityAllocationOverride?: number;
  } = {},
): number {
  return runSimulationSummary({
    fireInputs,
    macroParameters,
    iterations: options.iterations ?? 300,
    seed: options.seed ?? FIRE_DEFAULT_SEED + 99,
    monthlySipOverride: options.monthlySipOverride,
    retirementAgeOverride: options.retirementAgeOverride,
    targetMonthlyDrawOverride: options.targetMonthlyDrawOverride,
    equityAllocationOverride: options.equityAllocationOverride,
    includeFanChart: false,
  }).successProbability;
}

function runSimulationSummary(options: SimulationRunOptions): SimulationSummary {
  const retirementAge = Math.max(
    options.fireInputs.currentAge + 1,
    options.retirementAgeOverride ?? options.fireInputs.retirementAge,
  );
  const effectiveInputs: FireInputs = {
    ...options.fireInputs,
    retirementAge,
    yearsToRetirement: retirementAge - options.fireInputs.currentAge,
    targetMonthlyDrawToday: options.targetMonthlyDrawOverride ?? options.fireInputs.targetMonthlyDrawToday,
  };

  const clampedEquityOverride = options.equityAllocationOverride !== undefined
    ? clamp(options.equityAllocationOverride, 0, 100)
    : undefined;

  const iterations = Math.max(100, options.iterations ?? FIRE_DEFAULT_ITERATIONS);
  const seed = options.seed ?? FIRE_DEFAULT_SEED;
  const targetCorpusAtRetirement = computeTargetCorpus(effectiveInputs, options.macroParameters);
  const yearlyBalances: number[][] = [];
  const retirementCorpusValues: number[] = [];
  const shortfalls: number[] = [];
  const depletionAges: number[] = [];
  let successes = 0;

  for (let simulationIndex = 0; simulationIndex < iterations; simulationIndex += 1) {
    const rng = createMulberry32(seed + (simulationIndex * 9973));
    let equityCorpus = effectiveInputs.existingMfCorpus;
    let debtCorpus = effectiveInputs.existingPpfCorpus;
    let monthlySip = Math.max(0, options.monthlySipOverride ?? effectiveInputs.currentMonthlySip);
    let monthlyDraw = effectiveInputs.targetMonthlyDrawToday;
    let shortfall = 0;
    let depletedAge: number | null = null;
    const balances: number[] = [equityCorpus + debtCorpus];

    for (let age = effectiveInputs.currentAge; age < effectiveInputs.lifeExpectancyAge; age += 1) {
      const inflation = clamp(
        getMacroValue(options.macroParameters.inflationRate, 0.06) + (0.015 * sampleNormal(rng)),
        -0.01,
        0.15,
      );
      const equityReturn = clamp(
        getMacroValue(options.macroParameters.niftyMeanReturn, 0.12) + (getMacroValue(options.macroParameters.niftyStdDev, 0.18) * sampleNormal(rng)),
        -0.55,
        0.70,
      );
      const debtReturn = clamp(
        Math.max(
          getMacroValue(options.macroParameters.fdRate, 0.068),
          getMacroValue(options.macroParameters.bondYield, 0.071),
        ) + (0.02 * sampleNormal(rng)),
        -0.05,
        0.18,
      );

      const allocation = clampedEquityOverride !== undefined && age < effectiveInputs.retirementAge
        ? { equity: clampedEquityOverride, debt: 100 - clampedEquityOverride }
        : getAllocationForAge(age, effectiveInputs);
      const totalBeforeReturn = equityCorpus + debtCorpus;
      equityCorpus = totalBeforeReturn * (allocation.equity / 100);
      debtCorpus = totalBeforeReturn * (allocation.debt / 100);

      equityCorpus *= 1 + equityReturn;
      debtCorpus *= 1 + debtReturn;

      if (age < effectiveInputs.retirementAge) {
        const annualSip = monthlySip * 12;
        equityCorpus += annualSip * (allocation.equity / 100);
        debtCorpus += annualSip * (allocation.debt / 100);
        monthlySip *= 1 + FIRE_STEP_UP_RATE;
        monthlyDraw *= 1 + inflation;
      } else {
        const annualDraw = monthlyDraw * 12;
        const available = equityCorpus + debtCorpus;
        if (available >= annualDraw) {
          const postWithdrawal = available - annualDraw;
          equityCorpus = postWithdrawal * 0.60;
          debtCorpus = postWithdrawal * 0.40;
        } else {
          shortfall += annualDraw - available;
          if (depletedAge === null) {
            depletedAge = age + 1;
          }
          equityCorpus = 0;
          debtCorpus = 0;
        }
        monthlyDraw *= 1 + inflation;
      }

      const totalBalance = Math.max(0, equityCorpus + debtCorpus);
      balances.push(totalBalance);

      if (age + 1 === effectiveInputs.retirementAge) {
        retirementCorpusValues.push(totalBalance);
      }
    }

    if (depletedAge === null) {
      successes += 1;
    } else {
      shortfalls.push(shortfall);
      depletionAges.push(depletedAge);
    }

    if (options.includeFanChart) {
      balances.forEach((value, index) => {
        if (!yearlyBalances[index]) {
          yearlyBalances[index] = [];
        }
        yearlyBalances[index].push(value);
      });
    }
  }

  const sortedRetirementCorpusValues = [...retirementCorpusValues].sort((a, b) => a - b);
  const fanChartData = options.includeFanChart
    ? yearlyBalances.map((values, index) => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          age: effectiveInputs.currentAge + index,
          p10: percentile(sorted, 0.10),
          p50: percentile(sorted, 0.50),
          p90: percentile(sorted, 0.90),
        };
      })
    : [];

  return {
    successProbability: (successes / iterations) * 100,
    targetCorpusAtRetirement,
    retirementCorpusPercentiles: {
      p10: percentile(sortedRetirementCorpusValues, 0.10),
      p50: percentile(sortedRetirementCorpusValues, 0.50),
      p90: percentile(sortedRetirementCorpusValues, 0.90),
    },
    fanChartData,
    shortfallAnalysis: {
      failingSimulations: iterations - successes,
      averageShortfall: average(shortfalls),
      averageDepletionAge: depletionAges.length > 0 ? average(depletionAges) : null,
    },
  };
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = (values.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return values[lower];
  }

  const weight = index - lower;
  return values[lower] + ((values[upper] - values[lower]) * weight);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sampleNormal(rng: () => number): number {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createMulberry32(seed: number): () => number {
  let t = seed >>> 0;

  return () => {
    t += 0x6D2B79F5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
