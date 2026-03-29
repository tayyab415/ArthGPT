import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useWhatIf, type FireInputsServer, type WhatIfOverrides } from '../hooks/useWhatIf';
import type { FireMacroParameters } from '../hooks/useSSE';

interface WhatIfPanelProps {
  fireInputs: FireInputsServer | null;
  macroParameters: FireMacroParameters | null;
  baselineSuccessProbability: number;
  baselineSip: number;
  baselineRetirementAge: number;
  baselineMonthlyDraw: number;
  defaultEquityAllocation?: number;
}

interface SliderConfig {
  key: keyof WhatIfOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  baseline: number;
  format: (v: number) => string;
  deltaFormat: (delta: number) => string;
}

function formatINR(value: number): string {
  if (value >= 1e5) return `\u20B9${(value / 1e3).toFixed(0)}K`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactINR(value: number): string {
  if (value >= 1e7) return `\u20B9${(value / 1e7).toFixed(1)}Cr`;
  if (value >= 1e5) return `\u20B9${(value / 1e5).toFixed(1)}L`;
  if (value >= 1e3) return `\u20B9${(value / 1e3).toFixed(0)}K`;
  return `\u20B9${value.toFixed(0)}`;
}

export function WhatIfPanel({
  fireInputs,
  macroParameters,
  baselineSuccessProbability,
  baselineSip,
  baselineRetirementAge,
  baselineMonthlyDraw,
  defaultEquityAllocation = 70,
}: WhatIfPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    overrides,
    setOverride,
    result,
    isLoading,
    error,
    resetOverrides,
  } = useWhatIf(fireInputs, macroParameters, baselineSuccessProbability);

  const sliders = useMemo<SliderConfig[]>(
    () => [
      {
        key: 'monthlySipOverride',
        label: 'Monthly SIP',
        min: 1000,
        max: 500000,
        step: 1000,
        baseline: baselineSip,
        format: (v: number) => formatINR(v),
        deltaFormat: (d: number) => `${d >= 0 ? '+' : ''}\u20B9${Math.abs(d / 1e3).toFixed(0)}K`,
      },
      {
        key: 'retirementAgeOverride',
        label: 'Retirement Age',
        min: 40,
        max: 70,
        step: 1,
        baseline: baselineRetirementAge,
        format: (v: number) => String(v),
        deltaFormat: (d: number) => `${d >= 0 ? '+' : ''}${d}yr`,
      },
      {
        key: 'targetMonthlyDrawOverride',
        label: 'Monthly Draw',
        min: 10000,
        max: 500000,
        step: 5000,
        baseline: baselineMonthlyDraw,
        format: (v: number) => formatINR(v),
        deltaFormat: (d: number) => `${d >= 0 ? '+' : ''}\u20B9${Math.abs(d / 1e3).toFixed(0)}K`,
      },
      {
        key: 'equityAllocationOverride',
        label: 'Equity Allocation',
        min: 30,
        max: 100,
        step: 5,
        baseline: defaultEquityAllocation,
        format: (v: number) => `${v}%`,
        deltaFormat: (d: number) => `${d >= 0 ? '+' : ''}${d}%`,
      },
    ],
    [baselineSip, baselineRetirementAge, baselineMonthlyDraw, defaultEquityAllocation]
  );

  // Don't render if we don't have the required data
  if (!fireInputs || !macroParameters) return null;

  // Normalize baseline probability: if 0-1 scale, convert to 0-100
  const baselinePct =
    baselineSuccessProbability >= 0 && baselineSuccessProbability <= 1
      ? baselineSuccessProbability * 100
      : baselineSuccessProbability;

  // What-if result probability
  const whatIfProbability = result?.successProbability;
  const whatIfPct =
    whatIfProbability != null
      ? whatIfProbability >= 0 && whatIfProbability <= 1
        ? whatIfProbability * 100
        : whatIfProbability
      : null;

  const deltaPP = whatIfPct != null ? whatIfPct - baselinePct : null;

  // Color-code the probability
  const displayPct = whatIfPct ?? baselinePct;
  const probColor =
    displayPct < 50
      ? 'text-coral-500'
      : displayPct < 75
        ? 'text-yellow-400'
        : 'text-emerald-400';
  const barColor =
    displayPct < 50
      ? 'bg-coral-500'
      : displayPct < 75
        ? 'bg-yellow-400'
        : 'bg-emerald-400';

  const percentiles = result?.retirementCorpusPercentiles;
  const hasOverrides = Object.values(overrides).some((v) => v !== undefined);

  return (
    <div className="rounded-3xl bg-navy-900 border border-navy-700 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-gold-500" />
          <span className="text-lg font-semibold text-white">What-If Builder</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="whatif-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-6">
              {/* Reset button */}
              {hasOverrides && (
                <div className="flex justify-end">
                  <button
                    onClick={resetOverrides}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold-500 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              )}

              {/* Sliders */}
              <div className="space-y-5">
                {sliders.map((slider) => {
                  const current =
                    (overrides[slider.key] as number | undefined) ?? slider.baseline;
                  const delta = current - slider.baseline;

                  return (
                    <div key={slider.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">
                          {slider.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-white">
                            {slider.format(current)}
                          </span>
                          {delta !== 0 && (
                            <span
                              className={`text-xs font-mono ${
                                delta > 0 ? 'text-emerald-400' : 'text-coral-500'
                              }`}
                            >
                              ({slider.deltaFormat(delta)})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        value={current}
                        onChange={(e) =>
                          setOverride(slider.key, Number(e.target.value))
                        }
                        className="w-full"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Results display */}
              <div className="rounded-2xl bg-navy-800 border border-navy-700 p-5 space-y-4">
                {/* Success probability */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">Success Probability:</span>
                    <span className={`text-2xl font-bold font-mono ${probColor}`}>
                      {displayPct.toFixed(1)}%
                    </span>
                    {isLoading && (
                      <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
                    )}
                  </div>
                  {deltaPP != null && (
                    <span
                      className={`text-sm font-mono ${
                        deltaPP >= 0 ? 'text-emerald-400' : 'text-coral-500'
                      }`}
                    >
                      {deltaPP >= 0 ? '\u2191' : '\u2193'}{' '}
                      {deltaPP >= 0 ? '+' : ''}
                      {deltaPP.toFixed(1)}pp from base
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-navy-950 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, displayPct))}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>

                {/* Percentiles */}
                {percentiles && (
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">P10: </span>
                      <span className="font-mono text-white">
                        {formatCompactINR(percentiles.p10)}
                      </span>
                    </div>
                    <span className="text-navy-700">|</span>
                    <div>
                      <span className="text-slate-500">P50: </span>
                      <span className="font-mono text-white">
                        {formatCompactINR(percentiles.p50)}
                      </span>
                    </div>
                    <span className="text-navy-700">|</span>
                    <div>
                      <span className="text-slate-500">P90: </span>
                      <span className="font-mono text-white">
                        {formatCompactINR(percentiles.p90)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <p className="text-xs text-coral-500">
                    What-If error: {error}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
