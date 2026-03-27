import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldAlert, Info, Loader2, AlertCircle } from 'lucide-react';
import type { UserProfile } from '../App';

function fmtCurrency(val: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

// Client-side FIRE calculations for instant reactivity on slider changes
function calculateFireClientSide(
  age: number, retireAge: number, income: number,
  existingMfCorpus: number, existingPpfCorpus: number,
  targetMonthlyDraw: number, declaredLifeCover: number,
  monthlySipCurrent: number
) {
  const yearsToRetirement = Math.max(1, retireAge - age);
  const inflationRate = 0.06;
  const safeWithdrawalRate = 0.03;
  const equityReturn = 0.12;
  const ppfReturn = 0.071;

  const inflationAdjustedMonthlyDraw = targetMonthlyDraw * Math.pow(1 + inflationRate, yearsToRetirement);
  const requiredAnnualDraw = inflationAdjustedMonthlyDraw * 12;
  const requiredCorpus = requiredAnnualDraw / safeWithdrawalRate;

  const mfFutureValue = existingMfCorpus * Math.pow(1 + equityReturn, yearsToRetirement);
  const ppfFutureValue = existingPpfCorpus * Math.pow(1 + ppfReturn, yearsToRetirement);
  const existingCorpusFutureValue = mfFutureValue + ppfFutureValue;

  const gapToFill = Math.max(0, requiredCorpus - existingCorpusFutureValue);

  const months = yearsToRetirement * 12;
  const monthlyRate = equityReturn / 12;

  let requiredMonthlySip = 0;
  if (gapToFill > 0 && months > 0) {
    requiredMonthlySip = gapToFill / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate * (1 + monthlyRate));
  }

  const requiredLifeCover = income * 12;
  const insuranceGap = Math.max(0, requiredLifeCover - declaredLifeCover);

  const currentYear = new Date().getFullYear();
  const glidepath = [];
  const step = Math.max(1, Math.floor(yearsToRetirement / 6));
  for (let i = 0; i <= yearsToRetirement; i += step) {
    const year = currentYear + i;
    const remainingYears = yearsToRetirement - i;
    let equity = 75, debt = 25;
    if (remainingYears <= 5) { equity = 40; debt = 60; }
    else if (remainingYears <= 10) { equity = 60; debt = 40; }
    else if (remainingYears <= 15) { equity = 70; debt = 30; }
    glidepath.push({ year, equity, debt });
  }

  return {
    inflationAdjustedTarget: inflationAdjustedMonthlyDraw,
    requiredCorpus,
    existingCorpusFutureValue,
    gapToFill,
    requiredMonthlySip,
    insuranceGap,
    monthlySipCurrent,
    glidepath,
    sipAllocation: [
      { category: 'Large Cap', percentage: 60, amount: requiredMonthlySip * 0.6 },
      { category: 'Mid/Small Cap', percentage: 25, amount: requiredMonthlySip * 0.25 },
      { category: 'Debt', percentage: 15, amount: requiredMonthlySip * 0.15 },
    ],
  };
}

export function FIRERoadmap({ profile }: { profile: UserProfile }) {
  // Dynamic slider bounds based on user's age
  const sliderMin = Math.max(profile.age + 1, 35);
  const sliderMax = Math.max(sliderMin + 5, 70);
  const initialRetireAge = Math.min(Math.max(profile.retireAge || 50, sliderMin), sliderMax);
  const [retireAge, setRetireAge] = useState(initialRetireAge);

  // Pull real investment values from profile
  const mfCorpus = profile.investments
    .filter(i => i.type === 'Mutual Funds' || i.type === 'Stocks')
    .reduce((sum, i) => sum + i.value, 0);
  const ppfCorpus = profile.investments
    .filter(i => i.type === 'PPF' || i.type === 'EPF')
    .reduce((sum, i) => sum + i.value, 0);

  // Use profile FIRE fields with sensible defaults
  const targetMonthlyDraw = profile.targetMonthlyExpense > 0
    ? profile.targetMonthlyExpense
    : Math.max(50000, Math.round(profile.income / 24)); // Default: ~50% of monthly income
  const declaredLifeCover = profile.declaredLifeCover || 0;
  const monthlySipCurrent = profile.monthlySipCurrent || 0;

  // All calculations happen client-side for instant reactivity
  const data = useMemo(() => calculateFireClientSide(
    profile.age, retireAge, profile.income, mfCorpus, ppfCorpus,
    targetMonthlyDraw, declaredLifeCover, monthlySipCurrent
  ), [profile.age, retireAge, profile.income, mfCorpus, ppfCorpus, targetMonthlyDraw, declaredLifeCover, monthlySipCurrent]);

  // Edge case: no income
  if (profile.income <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-12 h-12 text-coral-500" />
        <h3 className="text-xl font-semibold text-white">Income data required</h3>
        <p className="text-slate-400 text-center max-w-md">
          We need your income details to model your FIRE journey. Please go back to Step 1 and enter your annual income.
        </p>
      </div>
    );
  }

  const requiredSip = data.requiredMonthlySip >= 100000
    ? `₹${(data.requiredMonthlySip / 100000).toFixed(2)}L`
    : `₹${new Intl.NumberFormat('en-IN').format(Math.round(data.requiredMonthlySip))}`;
  const targetCorpusCr = (data.requiredCorpus / 10000000).toFixed(2);

  // Generate corpus data for chart
  const corpusData = [];
  const startingCorpusCr = (mfCorpus + ppfCorpus) / 10000000;
  let current = startingCorpusCr;
  let recommended = startingCorpusCr;
  const currentSipCrYr = monthlySipCurrent * 12 / 10000000;
  const recommendedSipCrYr = data.requiredMonthlySip * 12 / 10000000;

  const chartEnd = Math.max(retireAge + 5, profile.age + 10);
  for (let age = profile.age; age <= chartEnd; age++) {
    corpusData.push({
      age,
      current: Number(current.toFixed(2)),
      recommended: Number(recommended.toFixed(2)),
    });
    current = current * 1.12 + currentSipCrYr;
    recommended = recommended * 1.12 + recommendedSipCrYr;
  }

  const sipAllocationData = data.sipAllocation.map((item: any) => ({
    name: item.category,
    value: item.percentage,
    color: item.category === 'Large Cap' ? '#20B2AA' : item.category === 'Debt' ? '#FF6B6B' : '#D4AF37'
  }));

  const retireYear = new Date().getFullYear() + (retireAge - profile.age);
  const retireMonthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][new Date().getMonth()];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">FIRE Roadmap</h2>
          <p className="text-slate-400 mt-1">Your path to Financial Independence, Retire Early.</p>
        </div>
      </header>

      {/* Hero Metric */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold-500 via-teal-500 to-coral-500" />
        <h3 className="text-5xl font-bold text-white mb-4">
          You can retire in <span className="text-gold-500">{retireMonthName} {retireYear}</span>
        </h3>
        <p className="text-lg text-slate-300">
          Assuming <strong className="text-white">{requiredSip}/month</strong> SIP starting now, 12% equity returns, 6% inflation.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Target monthly expense (today): {fmtCurrency(targetMonthlyDraw)} → Inflation-adjusted at retirement: {fmtCurrency(data.inflationAdjustedTarget)}
        </p>
        <p className="text-sm text-slate-500">
          Target corpus: ₹{targetCorpusCr} Cr (3% safe withdrawal rate)
        </p>
      </div>

      {/* Interactive Slider */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Target Retirement Age</h3>
          <span className="text-2xl font-bold text-gold-500">{retireAge}</span>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          value={retireAge}
          onChange={(e) => setRetireAge(Number(e.target.value))}
          className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer accent-gold-500"
        />
        <div className="flex justify-between text-sm text-slate-500 mt-2 font-mono">
          <span>{sliderMin}</span>
          <span>{Math.round((sliderMin + sliderMax) / 2)}</span>
          <span>{sliderMax}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Corpus Growth Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Corpus Growth (₹ Crores)</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-500" /> Current SIP ({monthlySipCurrent > 0 ? fmtCurrency(monthlySipCurrent) + '/mo' : 'None'})</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gold-500" /> Recommended Plan</div>
            </div>
          </div>

          <div className="flex-1 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={corpusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="age" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => [`₹${value} Cr`, '']}
                  labelFormatter={(label) => `Age ${label}`}
                />
                <Line type="monotone" dataKey="current" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="recommended" stroke="#D4AF37" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SIP Allocation */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Monthly SIP Split</h3>
          <div className="flex-1 h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sipAllocationData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sipAllocationData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => [`${value}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-2xl font-bold text-white">{requiredSip}</span>
              <span className="text-xs text-slate-400">Total SIP</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {sipAllocationData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300">{item.name}</span>
                </div>
                <span className="font-medium text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Glidepath */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Asset Glidepath</h3>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex-1 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.glidepath} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="equity" stackId="1" stroke="#20B2AA" fill="#20B2AA" fillOpacity={0.6} />
                <Area type="monotone" dataKey="debt" stackId="1" stroke="#FF6B6B" fill="#FF6B6B" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insurance Gap */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-coral-500/50 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldAlert className="w-32 h-32 text-coral-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-6 h-6 text-coral-500" />
              <h3 className="text-xl font-bold text-white">
                {data.insuranceGap > 0 ? 'Critical Insurance Gap' : 'Insurance Status'}
              </h3>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              {data.insuranceGap > 0
                ? 'Your declared life cover is below the recommended threshold for your income level and dependents.'
                : 'Your life cover meets the recommended threshold. Review annually as income grows.'}
            </p>

            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-navy-800 pb-2">
                <span className="text-slate-400">Declared Life Cover</span>
                <span className="text-xl font-mono text-white">
                  {declaredLifeCover > 0 ? fmtCurrency(declaredLifeCover) : 'Not declared'}
                </span>
              </div>
              <div className="flex justify-between items-end border-b border-navy-800 pb-2">
                <span className="text-slate-400">Recommended (12× Income)</span>
                <span className="text-xl font-mono text-white">{fmtCurrency(profile.income * 12)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-navy-800 pb-2">
                <span className="text-slate-400">Minimum Health Cover (2026)</span>
                <span className="text-xl font-mono text-white">₹20L</span>
              </div>
              {data.insuranceGap > 0 && (
                <div className="flex justify-between items-end pt-2">
                  <span className="text-coral-500 font-medium">Life Cover Gap</span>
                  <span className="text-2xl font-mono font-bold text-coral-500">{fmtCurrency(data.insuranceGap)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
