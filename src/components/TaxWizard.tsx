import React, { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Info, TrendingUp, ShieldCheck, PiggyBank, Calculator, Loader2, BarChart3, Edit3, Sparkles, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import type { UserProfile } from '../App';
import { useAnalysis } from '../contexts/AnalysisContext';
import { type AgentEvent } from '../hooks/useSSE';
import { AgentExecutionLog } from './AgentExecutionLog';

// ── Client-side tax engine (kept for instant reactivity during editing) ──
interface TaxInput {
  baseSalary: number;
  hraReceived: number;
  rentPaid: number;
  section80C: number;
  section80CCD1B: number;
  section80D: number;
  homeLoanInterest: number;
  isMetro: boolean;
}

interface SlabEntry { slab: string; rate: string; amount: number }

function calcOldSlabs(taxableIncome: number): { tax: number; breakdown: SlabEntry[] } {
  const bd: SlabEntry[] = [];
  let r = taxableIncome, t = 0;
  const s1 = Math.min(r, 250000); bd.push({ slab: '₹0 – ₹2,50,000', rate: '0%', amount: 0 }); r -= s1;
  if (r > 0) { const s = Math.min(r, 250000); const a = s * 0.05; t += a; bd.push({ slab: '₹2,50,001 – ₹5,00,000', rate: '5%', amount: a }); r -= s; }
  if (r > 0) { const s = Math.min(r, 500000); const a = s * 0.20; t += a; bd.push({ slab: '₹5,00,001 – ₹10,00,000', rate: '20%', amount: a }); r -= s; }
  if (r > 0) { const a = r * 0.30; t += a; bd.push({ slab: 'Above ₹10,00,000', rate: '30%', amount: a }); }
  return { tax: t, breakdown: bd };
}

function calcNewSlabs(taxableIncome: number): { tax: number; breakdown: SlabEntry[] } {
  const bd: SlabEntry[] = [];
  let r = taxableIncome, t = 0;
  const s1 = Math.min(r, 400000); bd.push({ slab: '₹0 – ₹4,00,000', rate: '0%', amount: 0 }); r -= s1;
  if (r > 0) { const s = Math.min(r, 400000); const a = s * 0.05; t += a; bd.push({ slab: '₹4,00,001 – ₹8,00,000', rate: '5%', amount: a }); r -= s; }
  if (r > 0) { const s = Math.min(r, 400000); const a = s * 0.10; t += a; bd.push({ slab: '₹8,00,001 – ₹12,00,000', rate: '10%', amount: a }); r -= s; }
  if (r > 0) { const s = Math.min(r, 400000); const a = s * 0.15; t += a; bd.push({ slab: '₹12,00,001 – ₹16,00,000', rate: '15%', amount: a }); r -= s; }
  if (r > 0) { const s = Math.min(r, 400000); const a = s * 0.20; t += a; bd.push({ slab: '₹16,00,001 – ₹20,00,000', rate: '20%', amount: a }); r -= s; }
  if (r > 0) { const s = Math.min(r, 400000); const a = s * 0.25; t += a; bd.push({ slab: '₹20,00,001 – ₹24,00,000', rate: '25%', amount: a }); r -= s; }
  if (r > 0) { const a = r * 0.30; t += a; bd.push({ slab: 'Above ₹24,00,000', rate: '30%', amount: a }); }
  return { tax: t, breakdown: bd };
}

function computeTax(input: TaxInput) {
  const grossSalary = input.baseSalary + input.hraReceived;
  if (grossSalary <= 0) return null;

  // Old Regime
  const oldSD = 50000;
  const hra1 = input.hraReceived;
  const hra2 = input.isMetro ? input.baseSalary * 0.5 : input.baseSalary * 0.4;
  const hra3 = Math.max(0, input.rentPaid - input.baseSalary * 0.1);
  const oldHra = input.rentPaid > 0 ? Math.min(hra1, hra2, hra3) : 0;
  const old80C = Math.min(Math.max(0, input.section80C), 150000);
  const old80CCD = Math.min(Math.max(0, input.section80CCD1B), 50000);
  const old80D = Math.min(Math.max(0, input.section80D), 25000);
  const oldHL = Math.min(Math.max(0, input.homeLoanInterest), 200000);

  const oldTaxable = Math.max(0, grossSalary - oldSD - oldHra - old80C - old80CCD - old80D - oldHL);
  const oldSlabs = calcOldSlabs(oldTaxable);
  const oldRebate = oldTaxable <= 500000 ? Math.min(oldSlabs.tax, 12500) : 0;
  const oldAfterRebate = Math.max(0, oldSlabs.tax - oldRebate);
  const oldCess = oldAfterRebate * 0.04;
  const oldTotal = oldAfterRebate + oldCess;

  // New Regime
  const newSD = 75000;
  const newTaxable = Math.max(0, grossSalary - newSD);
  const newSlabs = calcNewSlabs(newTaxable);
  const newRebate = newTaxable <= 1200000 ? Math.min(newSlabs.tax, 60000) : 0;
  const newAfterRebate = Math.max(0, newSlabs.tax - newRebate);
  const newCess = newAfterRebate * 0.04;
  const newTotal = newAfterRebate + newCess;

  const winner = newTotal <= oldTotal ? 'new' as const : 'old' as const;
  const savings = Math.abs(oldTotal - newTotal);
  const marginalRate = oldTaxable > 1000000 ? 0.312 : oldTaxable > 500000 ? 0.208 : 0.052;
  const missed80D = Math.max(0, 25000 - input.section80D);
  const missed80CCD = Math.max(0, 50000 - input.section80CCD1B);

  return {
    oldRegime: {
      grossSalary, standardDeduction: oldSD, hraExemption: oldHra,
      section80C: old80C, section80CCD1B: old80CCD, homeLoanInterest: oldHL, section80D: old80D,
      taxableIncome: oldTaxable, taxOnSlab: oldSlabs.tax, rebate87A: oldRebate,
      taxAfterRebate: oldAfterRebate, cess: oldCess, totalTaxLiability: oldTotal,
      slabBreakdown: oldSlabs.breakdown,
    },
    newRegime: {
      grossSalary, standardDeduction: newSD, hraExemption: 0,
      section80C: 0, section80CCD1B: 0, homeLoanInterest: 0, section80D: 0,
      taxableIncome: newTaxable, taxOnSlab: newSlabs.tax, rebate87A: newRebate,
      taxAfterRebate: newAfterRebate, cess: newCess, totalTaxLiability: newTotal,
      slabBreakdown: newSlabs.breakdown,
    },
    winner, savings, marginalRate,
    missedDeductions: {
      section80D: missed80D, section80CCD1B: missed80CCD,
      potentialTaxSaving80D: Math.round(missed80D * marginalRate),
      potentialTaxSaving80CCD1B: Math.round(missed80CCD * marginalRate),
    },
    hraBreakdown: { hraReceived: hra1, metroLimit: hra2, rentMinus10Percent: hra3 },
  };
}

// ── Helpers ──
function parseNum(s: string): number { return parseInt(s.replace(/[^0-9]/g, '')) || 0; }
function fmtINR(n: number): string { return new Intl.NumberFormat('en-IN').format(n); }
function fmtCurrency(val: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val); }

// ── Editable input row ──
function TaxInputRow({ label, value, onChange, max, hint }: { label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-navy-800/50 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-300">{label}</span>
        {hint && <span className="text-[10px] text-slate-600 block">{hint}</span>}
      </div>
      <div className="relative w-40">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₹</span>
        <input
          type="text"
          value={value ? fmtINR(value) : ''}
          onChange={(e) => {
            let v = parseNum(e.target.value);
            if (max !== undefined) v = Math.min(v, max);
            onChange(v);
          }}
          className="w-full bg-navy-950 border border-navy-700 rounded-lg pl-6 pr-2 py-1.5 text-white text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-gold-500/50"
        />
      </div>
    </div>
  );
}

// ═══════════ Main Component ═══════════
export function TaxWizard({ profile, setProfile }: { profile: UserProfile; setProfile: Dispatch<SetStateAction<UserProfile>> }) {
  const [hraOpen, setHraOpen] = useState(false);
  const [slabOpen, setSlabOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [useAgentMode, setUseAgentMode] = useState(false);

  // Tax pipeline hook for multi-agent execution
  const { taxPipeline: pipeline } = useAnalysis();

  // Local editable tax inputs — initialised from profile
  const [taxInputs, setTaxInputs] = useState<TaxInput>({
    baseSalary: profile.baseSalary || Math.round(profile.income * 0.833),
    hraReceived: profile.hraReceived || Math.round(profile.income * 0.167),
    rentPaid: profile.rentPaid || 0,
    section80C: profile.section80C || 0,
    section80CCD1B: profile.section80CCD1B || 0,
    section80D: profile.section80D || 0,
    homeLoanInterest: profile.homeLoanInterest || 0,
    isMetro: profile.isMetro,
  });

  // If user hasn't entered rent but is in a metro, default rent to HRA amount
  const firstRender = useState(true);
  if (firstRender[0] && taxInputs.rentPaid === 0 && taxInputs.hraReceived > 0) {
    firstRender[1](false);
    setTaxInputs(prev => ({ ...prev, rentPaid: prev.hraReceived }));
  }

  // All calculation happens client-side (deterministic) — instant on every input change
  const data = useMemo(() => computeTax(taxInputs), [taxInputs]);

  // Extract AI-generated narrative from pipeline result
  const aiNarrative = useMemo(() => {
    if (!pipeline.result) return null;
    const result = pipeline.result as {
      tax_optimization?: {
        narrative?: string;
        suggestions?: Array<{
          instrument: string;
          section: string;
          maxBenefit: number;
          lockIn: string;
          riskLevel: string;
          description: string;
        }>;
        missedDeductions?: Array<{
          section: string;
          missedAmount: number;
          potentialSaving: number;
          description: string;
        }>;
      };
      compliant_narrative?: string;
    };
    return {
      narrative: result.compliant_narrative || result.tax_optimization?.narrative,
      suggestions: result.tax_optimization?.suggestions,
      missedDeductions: result.tax_optimization?.missedDeductions,
    };
  }, [pipeline.result]);

  // Run pipeline when agent mode is enabled
  const runPipeline = useCallback(() => {
    pipeline.execute({
      baseSalary: taxInputs.baseSalary,
      hraReceived: taxInputs.hraReceived,
      rentPaid: taxInputs.rentPaid,
      section80C: taxInputs.section80C,
      section80CCD1B: taxInputs.section80CCD1B,
      section80D: taxInputs.section80D,
      homeLoanInterest: taxInputs.homeLoanInterest,
      isMetro: taxInputs.isMetro,
    });
  }, [taxInputs, pipeline]);

  // Sync back to profile when inputs change
  const syncToProfile = useCallback(() => {
    setProfile(p => ({
      ...p,
      baseSalary: taxInputs.baseSalary,
      hraReceived: taxInputs.hraReceived,
      rentPaid: taxInputs.rentPaid,
      section80C: taxInputs.section80C,
      section80CCD1B: taxInputs.section80CCD1B,
      section80D: taxInputs.section80D,
      homeLoanInterest: taxInputs.homeLoanInterest,
    }));
  }, [taxInputs, setProfile]);

  useEffect(() => { syncToProfile(); }, [syncToProfile]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-12 h-12 text-coral-500" />
        <h3 className="text-xl font-semibold text-white">Income data required</h3>
        <p className="text-slate-400 text-center max-w-md">
          We need your salary details to calculate taxes. Please go back to Step 1 and enter your annual income.
        </p>
      </div>
    );
  }

  const salaryInLakhs = `₹${(data.oldRegime.grossSalary / 100000).toFixed(0)}L`;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Tax Wizard</h2>
          <p className="text-slate-400 mt-1">FY 2025-26 Regime Comparison & Optimisation.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent Mode Toggle */}
          <button
            onClick={() => {
              if (!useAgentMode) {
                setUseAgentMode(true);
                runPipeline();
              } else {
                setUseAgentMode(false);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
              useAgentMode 
                ? "border-teal-500 text-teal-500 bg-teal-500/10" 
                : "border-navy-700 text-slate-400 hover:text-slate-200 hover:border-navy-600"
            )}
            disabled={pipeline.isLoading}
          >
            {pipeline.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {pipeline.isLoading ? 'Running...' : useAgentMode ? 'AI Analysis Active' : 'Run AI Analysis'}
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium",
              editMode ? "border-gold-500 text-gold-500 bg-gold-500/10" : "border-navy-700 text-slate-400 hover:text-slate-200 hover:border-navy-600"
            )}
          >
            <Edit3 className="w-4 h-4" />
            {editMode ? 'Done Editing' : 'Edit Salary Details'}
          </button>
        </div>
      </header>

      {/* Agent Execution Log */}
      {useAgentMode && pipeline.events.length > 0 && (
        <AgentExecutionLog events={pipeline.events} isLoading={pipeline.isLoading} />
      )}

      {/* AI-Generated Insights */}
      {useAgentMode && aiNarrative?.narrative && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-teal-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">AI Tax Optimizer Insights</h3>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {aiNarrative.narrative}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Editable Inputs Panel */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-2xl bg-navy-900 border border-gold-500/30 space-y-1">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-gold-500" />
                Your Salary Breakup & Deductions
              </h3>
              <TaxInputRow label="Basic Salary (per annum)" value={taxInputs.baseSalary} onChange={(v) => setTaxInputs(p => ({ ...p, baseSalary: v }))} hint="Typically 40-50% of CTC" />
              <TaxInputRow label="HRA Received" value={taxInputs.hraReceived} onChange={(v) => setTaxInputs(p => ({ ...p, hraReceived: v }))} hint="As per salary slip" />
              <TaxInputRow label="Rent Paid (per annum)" value={taxInputs.rentPaid} onChange={(v) => setTaxInputs(p => ({ ...p, rentPaid: v }))} />
              <TaxInputRow label="Section 80C" value={taxInputs.section80C} onChange={(v) => setTaxInputs(p => ({ ...p, section80C: v }))} max={150000} hint="ELSS, PPF, EPF, LIC — max ₹1.5L" />
              <TaxInputRow label="Section 80CCD(1B) — NPS" value={taxInputs.section80CCD1B} onChange={(v) => setTaxInputs(p => ({ ...p, section80CCD1B: v }))} max={50000} hint="Additional NPS — max ₹50K" />
              <TaxInputRow label="Section 80D — Health Insurance" value={taxInputs.section80D} onChange={(v) => setTaxInputs(p => ({ ...p, section80D: v }))} max={100000} hint="Self ₹25K + Parents ₹25-50K" />
              <TaxInputRow label="Home Loan Interest (Section 24b)" value={taxInputs.homeLoanInterest} onChange={(v) => setTaxInputs(p => ({ ...p, homeLoanInterest: v }))} max={200000} hint="Self-occupied — max ₹2L" />
              <div className="flex items-center justify-between py-3 mt-2">
                <span className="text-sm text-slate-300">Metro City (Mumbai, Delhi, Bengaluru, etc.)</span>
                <button
                  onClick={() => setTaxInputs(p => ({ ...p, isMetro: !p.isMetro }))}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                    taxInputs.isMetro ? "border-teal-500 text-teal-500 bg-teal-500/10" : "border-navy-700 text-slate-400"
                  )}
                >
                  {taxInputs.isMetro ? 'Yes' : 'No'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-navy-800 to-navy-900 border border-gold-500/30 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/20 text-gold-500 text-sm font-semibold uppercase tracking-wider mb-4">
            <CheckCircle2 className="w-4 h-4" /> Recommended
          </div>
          <h3 className="text-4xl font-bold text-white mb-2">
            {data.winner === 'new' ? 'New' : 'Old'} Tax Regime saves you <span className="text-gold-500">{fmtCurrency(data.savings)}</span> this year
          </h3>
          <p className="text-slate-300 text-lg">
            Based on your declared salary of {salaryInLakhs} and current deductions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison Table */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-navy-900 border border-navy-800">
          <h3 className="text-xl font-semibold text-white mb-6">Side-by-Side Comparison</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="pb-4 font-medium text-slate-400">Line Item</th>
                  <th className="pb-4 font-medium text-coral-500/80 text-right pr-6">Old Regime</th>
                  <th className="pb-4 font-medium text-teal-500 text-right pl-6 border-l border-navy-800">New Regime</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { label: 'Gross Salary', old: data.oldRegime.grossSalary, new: data.newRegime.grossSalary, isDeduction: false },
                  { label: 'Standard Deduction', old: data.oldRegime.standardDeduction, new: data.newRegime.standardDeduction, isDeduction: true },
                  { label: 'HRA Exemption', old: data.oldRegime.hraExemption, new: 0, isDeduction: true },
                  { label: 'Section 80C', old: data.oldRegime.section80C, new: 0, isDeduction: true },
                  { label: 'Section 80CCD(1B) NPS', old: data.oldRegime.section80CCD1B, new: 0, isDeduction: true },
                  { label: 'Home Loan Interest (24b)', old: data.oldRegime.homeLoanInterest, new: 0, isDeduction: true },
                  { label: 'Section 80D (Health)', old: data.oldRegime.section80D, new: 0, isDeduction: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-navy-800/50">
                    <td className="py-4 text-slate-300">{row.label}</td>
                    <td className="py-4 text-right font-mono pr-6">
                      <span className={row.isDeduction && row.old > 0 ? "text-coral-400" : "text-slate-300"}>
                        {row.isDeduction && row.old > 0 ? '-' : ''}{fmtCurrency(row.old)}
                      </span>
                    </td>
                    <td className="py-4 text-right font-mono pl-6 border-l border-navy-800">
                      <span className={row.isDeduction && row.new > 0 ? "text-teal-400" : row.new === 0 && row.isDeduction ? "text-slate-500" : "text-slate-300"}>
                        {row.isDeduction && row.new > 0 ? '-' : ''}{row.new === 0 && row.isDeduction ? '₹0' : fmtCurrency(row.new)}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-navy-800/50 bg-navy-950/30">
                  <td className="py-4 font-medium text-white">Taxable Income</td>
                  <td className="py-4 text-right font-mono font-medium text-white pr-6">{fmtCurrency(data.oldRegime.taxableIncome)}</td>
                  <td className="py-4 text-right font-mono font-medium text-white pl-6 border-l border-navy-800">{fmtCurrency(data.newRegime.taxableIncome)}</td>
                </tr>
                <tr className="border-b border-navy-800/50">
                  <td className="py-4 text-slate-300">Tax on Slab</td>
                  <td className="py-4 text-right font-mono text-slate-300 pr-6">{fmtCurrency(data.oldRegime.taxOnSlab)}</td>
                  <td className="py-4 text-right font-mono text-slate-300 pl-6 border-l border-navy-800">{fmtCurrency(data.newRegime.taxOnSlab)}</td>
                </tr>
                {(data.oldRegime.rebate87A > 0 || data.newRegime.rebate87A > 0) && (
                  <tr className="border-b border-navy-800/50">
                    <td className="py-4 text-slate-300">Rebate u/s 87A</td>
                    <td className="py-4 text-right font-mono text-emerald-400 pr-6">{data.oldRegime.rebate87A > 0 ? `-${fmtCurrency(data.oldRegime.rebate87A)}` : '₹0'}</td>
                    <td className="py-4 text-right font-mono text-emerald-400 pl-6 border-l border-navy-800">{data.newRegime.rebate87A > 0 ? `-${fmtCurrency(data.newRegime.rebate87A)}` : '₹0'}</td>
                  </tr>
                )}
                <tr className="border-b border-navy-800/50">
                  <td className="py-4 text-slate-300">Health & Education Cess (4%)</td>
                  <td className="py-4 text-right font-mono text-slate-300 pr-6">{fmtCurrency(data.oldRegime.cess)}</td>
                  <td className="py-4 text-right font-mono text-slate-300 pl-6 border-l border-navy-800">{fmtCurrency(data.newRegime.cess)}</td>
                </tr>
                <tr>
                  <td className="py-6 font-bold text-lg text-white">Total Tax Liability</td>
                  <td className={cn("py-6 text-right font-mono font-bold text-lg pr-6", data.winner === 'old' ? "text-emerald-400 text-2xl bg-emerald-500/5 rounded-l-xl" : "text-slate-400")}>{fmtCurrency(data.oldRegime.totalTaxLiability)}</td>
                  <td className={cn("py-6 text-right font-mono font-bold text-lg pl-6 border-l border-navy-800", data.winner === 'new' ? "text-emerald-400 text-2xl bg-emerald-500/5 rounded-r-xl" : "text-slate-400")}>{fmtCurrency(data.newRegime.totalTaxLiability)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* HRA Accordion */}
          {data.oldRegime.hraExemption > 0 && (
            <div className="mt-8 border border-navy-700 rounded-xl overflow-hidden">
              <button 
                onClick={() => setHraOpen(!hraOpen)}
                className="w-full flex items-center justify-between p-4 bg-navy-800 hover:bg-navy-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calculator className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-white">View HRA Exemption Working</span>
                </div>
                {hraOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              <AnimatePresence>
                {hraOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-navy-900 border-t border-navy-700 p-6"
                  >
                    <p className="text-sm text-slate-400 mb-4">
                      HRA exemption is the minimum of the following three conditions (Section 10(13A)):
                    </p>
                    <div className="space-y-3 font-mono text-sm">
                      {[
                        { label: '1. Actual HRA received', value: data.hraBreakdown.hraReceived, isMin: data.oldRegime.hraExemption === data.hraBreakdown.hraReceived },
                        { label: `2. ${taxInputs.isMetro ? '50' : '40'}% of Basic Salary (${taxInputs.isMetro ? 'Metro' : 'Non-Metro'})`, value: data.hraBreakdown.metroLimit, isMin: data.oldRegime.hraExemption === data.hraBreakdown.metroLimit },
                        { label: '3. Rent paid minus 10% of Basic', value: data.hraBreakdown.rentMinus10Percent, isMin: data.oldRegime.hraExemption === data.hraBreakdown.rentMinus10Percent },
                      ].map((item, i) => (
                        <div key={i} className={cn(
                          "flex justify-between items-center p-3 rounded-lg border",
                          item.isMin ? "bg-teal-500/10 border-teal-500/30" : "bg-navy-950/50 border-navy-800"
                        )}>
                          <span className={item.isMin ? "text-teal-400 font-medium" : "text-slate-300"}>{item.label}</span>
                          <span className={item.isMin ? "text-teal-400 font-bold" : "text-white"}>{fmtCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-teal-400 mt-4 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Minimum value ({fmtCurrency(data.oldRegime.hraExemption)}) is the allowed exemption.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Slab Breakdown Accordion */}
          <div className="mt-4 border border-navy-700 rounded-xl overflow-hidden">
            <button 
              onClick={() => setSlabOpen(!slabOpen)}
              className="w-full flex items-center justify-between p-4 bg-navy-800 hover:bg-navy-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-white">View Slab-wise Tax Breakdown</span>
              </div>
              {slabOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            <AnimatePresence>
              {slabOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-navy-900 border-t border-navy-700 p-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-coral-400 mb-3 uppercase tracking-wider">Old Regime Slabs</h4>
                      <div className="space-y-2 font-mono text-sm">
                        {data.oldRegime.slabBreakdown.map((slab, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-navy-950/50 border border-navy-800">
                            <span className="text-slate-300 text-xs">{slab.slab} ({slab.rate})</span>
                            <span className="text-white">{fmtCurrency(slab.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-teal-400 mb-3 uppercase tracking-wider">New Regime Slabs</h4>
                      <div className="space-y-2 font-mono text-sm">
                        {data.newRegime.slabBreakdown.map((slab, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-navy-950/50 border border-navy-800">
                            <span className="text-slate-300 text-xs">{slab.slab} ({slab.rate})</span>
                            <span className="text-white">{fmtCurrency(slab.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Missed Deductions */}
          {(data.missedDeductions.section80D > 0 || data.missedDeductions.section80CCD1B > 0) && (
            <div className="p-6 rounded-2xl bg-navy-900 border border-gold-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <AlertCircle className="w-24 h-24 text-gold-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-semibold text-white mb-4">Missed Deductions</h3>
                <p className="text-sm text-slate-300 mb-6">
                  You are leaving money on the table in the Old Regime. Claiming these could change which regime is optimal.
                </p>
                
                <div className="space-y-4">
                  {data.missedDeductions.section80D > 0 && (
                    <div className="p-4 rounded-xl bg-navy-950/50 border border-navy-800">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-white">80D Health Insurance</span>
                        <span className="text-xs font-bold text-gold-500 bg-gold-500/10 px-2 py-1 rounded">
                          Saves {fmtCurrency(data.missedDeductions.potentialTaxSaving80D)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">₹{(data.missedDeductions.section80D / 1000).toFixed(0)}K deduction available — self & family health insurance premium.</p>
                    </div>
                  )}
                  
                  {data.missedDeductions.section80CCD1B > 0 && (
                    <div className="p-4 rounded-xl bg-navy-950/50 border border-navy-800">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-white">80CCD(1B) Additional NPS</span>
                        <span className="text-xs font-bold text-gold-500 bg-gold-500/10 px-2 py-1 rounded">
                          Saves {fmtCurrency(data.missedDeductions.potentialTaxSaving80CCD1B)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">₹{(data.missedDeductions.section80CCD1B / 1000).toFixed(0)}K extra deduction beyond 80C limit for NPS contributions.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recommended Instruments */}
          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
            <h3 className="text-lg font-semibold text-white mb-4">Top Tax-Saving Instruments</h3>
            <p className="text-xs text-slate-400 mb-4">Ranked by ease & liquidity. Tax savings at your marginal rate ({(data.marginalRate * 100).toFixed(1)}%).</p>
            <div className="space-y-3">
              {[
                { icon: TrendingUp, color: 'teal', name: 'ELSS Mutual Funds', desc: '3-yr lock-in • Equity returns • 80C eligible', savings: Math.round(150000 * data.marginalRate) },
                { icon: ShieldCheck, color: 'gold', name: 'Public Provident Fund (PPF)', desc: '15-yr lock-in • 7.1% guaranteed • 80C eligible', savings: Math.round(150000 * data.marginalRate) },
                { icon: PiggyBank, color: 'blue', name: 'NPS Tier 1', desc: 'Retirement lock-in • 80CCD(1B) • Extra ₹50K', savings: Math.round(50000 * data.marginalRate) },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-4 p-3 rounded-xl hover:bg-navy-800 transition-colors cursor-pointer group">
                  <div className={`w-10 h-10 rounded-full bg-${item.color}-500/10 flex items-center justify-center shrink-0 group-hover:bg-${item.color}-500/20 transition-colors`}>
                    <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white">{item.name}</h4>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded shrink-0">
                    Saves ~{fmtCurrency(item.savings)}/yr
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Effective Tax Rate */}
          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
            <h3 className="text-lg font-semibold text-white mb-4">Effective Tax Rate</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-navy-950/50 border border-navy-800 text-center">
                <p className="text-xs text-slate-400 mb-1">Old Regime</p>
                <p className="text-2xl font-bold font-mono text-coral-400">
                  {data.oldRegime.grossSalary > 0 ? ((data.oldRegime.totalTaxLiability / data.oldRegime.grossSalary) * 100).toFixed(1) : '0'}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-navy-950/50 border border-navy-800 text-center">
                <p className="text-xs text-slate-400 mb-1">New Regime</p>
                <p className="text-2xl font-bold font-mono text-teal-400">
                  {data.newRegime.grossSalary > 0 ? ((data.newRegime.totalTaxLiability / data.newRegime.grossSalary) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
