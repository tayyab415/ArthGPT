import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, Info, AlertTriangle, CheckCircle2, Loader2, WifiOff, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { UserProfile } from '../App';
import { useAnalysis } from '../contexts/AnalysisContext';
import { ConfidenceBadge, ConfidenceDot, type ConfidenceLevel } from './ConfidenceBadge';
import { AgentExecutionLog } from './AgentExecutionLog';

// Types for the pipeline result
interface PortfolioResult {
  portfolio_data?: {
    totalValue: number;
    funds: Array<{ name: string; currentValue: number; category: string }>;
  };
  xirr_results?: {
    portfolioXirr: number;
    fundXirrs: Array<{ fund: string; xirr: number }>;
  };
  overlap_data?: {
    totalOverlappingStocks: number;
    overlapMatrix: Array<{
      stock: string;
      funds: string[];
      combinedWeight: number;
      confidence: ConfidenceLevel;
    }>;
    confidence: ConfidenceLevel;
    concentrationRisk: string;
  };
  expense_analysis?: {
    totalExpenseDrag: number;
    fundExpenses: Array<{
      fund: string;
      regularER: number;
      directER: number;
      annualDrag: number;
      switchRecommended: boolean;
      confidence: ConfidenceLevel;
    }>;
  };
  benchmark_comparison?: {
    funds: Array<{
      fund: string;
      fund3Y: number;
      benchmark3Y: number;
      benchmark: string;
      underperformer: boolean;
    }>;
  };
  rebalancing_plan?: {
    recommendations: Array<{
      fundToRedeem: string;
      units: number;
      currentValue: number;
      holdingPeriod: string;
      taxImplication: string;
      estimatedTax: number;
      fundToInvest: string;
      reason: string;
      expenseBenefit: string;
    }>;
    narrative: string;
    totalExpectedSavings: number;
    disclaimer: string;
  };
  execution_log?: Array<{
    agent: string;
    stage: number;
    latencyMs?: number;
  }>;
}

export function PortfolioXRay({ profile }: { profile: UserProfile }) {
  const [showExecutionLog, setShowExecutionLog] = useState(false);
  const { portfolioPipeline } = useAnalysis();
  const { execute, events, result, error, isLoading, isComplete, isError, abort } = portfolioPipeline;

  const buildFundInput = useCallback(() => {
    const mfInvestment = profile.investments.find(i => i.type === 'Mutual Funds');
    const stockInvestment = profile.investments.find(i => i.type === 'Stocks');
    const totalMfValue = (mfInvestment?.value || 0) + (stockInvestment?.value || 0);
    
    const funds = totalMfValue > 0 ? [
      { name: 'Mirae Asset Large Cap Fund - Regular Plan', units: Math.round(totalMfValue * 0.35 / 85.2), nav: 85.2, investedAmount: Math.round(totalMfValue * 0.35) },
      { name: 'HDFC Flexi Cap Fund - Regular Plan', units: Math.round(totalMfValue * 0.25 / 145.6), nav: 145.6, investedAmount: Math.round(totalMfValue * 0.25) },
      { name: 'SBI Small Cap Fund - Direct Plan', units: Math.round(totalMfValue * 0.15 / 180.5), nav: 180.5, investedAmount: Math.round(totalMfValue * 0.15) },
      { name: 'Parag Parikh Flexi Cap Fund - Direct Plan', units: Math.round(totalMfValue * 0.25 / 65.4), nav: 65.4, investedAmount: Math.round(totalMfValue * 0.25) }
    ] : [
      { name: 'Mirae Asset Large Cap Fund - Regular Plan', units: 3500, nav: 85.2, investedAmount: 250000 },
      { name: 'HDFC Flexi Cap Fund - Regular Plan', units: 1200, nav: 145.6, investedAmount: 150000 },
      { name: 'SBI Small Cap Fund - Direct Plan', units: 450, nav: 180.5, investedAmount: 60000 },
      { name: 'Parag Parikh Flexi Cap Fund - Direct Plan', units: 2100, nav: 65.4, investedAmount: 120000 }
    ];

    const riskProfile = profile.goals.includes('Aggressive Growth') ? 'Aggressive' 
      : profile.goals.includes('Retirement Corpus') ? 'Moderate' 
      : 'Moderate';
    const horizon = profile.age < 35 ? '20+ years' : profile.age < 45 ? '15 years' : '10 years';

    return { funds, riskProfile: riskProfile as 'Aggressive' | 'Moderate' | 'Conservative', investmentHorizon: horizon };
  }, [profile]);

  useEffect(() => {
    const input = buildFundInput();
    execute(input);
    
    return () => abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  // Show loading state with real agent events
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        <p className="text-slate-400 text-sm">Executing Portfolio X-Ray pipeline...</p>
        
        {/* Live agent status */}
        <div className="w-full max-w-md space-y-2">
          {['IngestionAgent', 'XirrEngine', 'OverlapAgent', 'ExpenseAgent', 'BenchmarkAgent', 'RebalancingStrategist'].map(agent => {
            const startEvent = events.find(e => e.agent === agent && e.type === 'agent_start');
            const completeEvent = events.find(e => e.agent === agent && e.type === 'agent_complete');
            
            return (
              <div key={agent} className="flex items-center justify-between px-4 py-2 bg-navy-900 rounded-lg border border-navy-800">
                <span className="text-sm text-slate-300">{agent}</span>
                {completeEvent ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-slate-500">{completeEvent.latencyMs}ms</span>
                  </div>
                ) : startEvent ? (
                  <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-navy-700" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <WifiOff className="w-12 h-12 text-coral-500" />
        <h3 className="text-xl font-semibold text-white">Analysis Failed</h3>
        <p className="text-slate-400 text-center max-w-md">{error || 'An error occurred during portfolio analysis.'}</p>
        <button
          onClick={() => execute(buildFundInput())}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-navy-950 font-semibold hover:bg-gold-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!isComplete || !result) return null;

  const data = result as PortfolioResult;
  const xirr = data.xirr_results?.portfolioXirr || 0;
  const benchmarkReturn = data.benchmark_comparison?.funds?.[0]?.benchmark3Y || 12;
  const expenseDrag = data.expense_analysis?.totalExpenseDrag || 0;
  const overlappingStocks = data.overlap_data?.totalOverlappingStocks || 0;
  const overlapConfidence = data.overlap_data?.confidence || 'HIGH';

  // Build expense chart data
  const expenseChartData = data.expense_analysis?.fundExpenses?.map(f => ({
    name: f.fund.split(' ').slice(0, 2).join(' '),
    regular: f.regularER,
    direct: f.directER,
  })) || [];

  // Build overlap display data
  const overlapDisplayData = data.overlap_data?.overlapMatrix?.slice(0, 5).map(o => ({
    stock: o.stock,
    funds: o.funds.map(f => f.split(' ')[0]),
    percentage: o.combinedWeight,
    confidence: o.confidence,
  })) || [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Portfolio X-Ray</h2>
          <p className="text-slate-400 mt-1">Multi-agent analysis of your mutual fund holdings.</p>
        </div>
        <div className="flex items-center gap-3">
          <ConfidenceBadge level={overlapConfidence} />
          <div className="px-4 py-2 bg-navy-800 rounded-full border border-navy-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">V2 Pipeline</span>
          </div>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'True XIRR', value: `${xirr.toFixed(1)}%`, trend: `+${(xirr - benchmarkReturn).toFixed(1)}% vs BM`, positive: xirr > benchmarkReturn },
          { label: 'Benchmark Return', value: `${benchmarkReturn.toFixed(1)}%`, trend: 'Nifty 500 TRI', positive: true },
          { label: 'Expense Ratio Drag', value: `${formatCurrency(expenseDrag)}/yr`, trend: 'Switch to Direct', positive: false },
          { label: 'Overlapping Stocks', value: overlappingStocks.toString(), trend: data.overlap_data?.concentrationRisk?.split(':')[0] || 'Check Overlap', positive: overlappingStocks < 10 },
        ].map((metric, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-700 transition-colors"
          >
            <p className="text-sm font-medium text-slate-400 mb-2">{metric.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white font-mono">{metric.value}</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              {metric.positive ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-coral-500" />
              )}
              <span className={`text-sm font-medium ${metric.positive ? 'text-emerald-500' : 'text-coral-500'}`}>
                {metric.trend}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overlap Map with Confidence */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">Stock Overlap Heatmap</h3>
              <ConfidenceBadge level={overlapConfidence} size="sm" />
            </div>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-navy-950/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Stock</th>
                  <th className="px-4 py-3">Funds</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3 rounded-tr-lg">Conf</th>
                </tr>
              </thead>
              <tbody>
                {overlapDisplayData.map((row, i) => (
                  <tr key={i} className="border-b border-navy-800/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-200">{row.stock}</td>
                    <td className="px-4 py-3 text-slate-400">{row.funds.join(', ')}</td>
                    <td className="px-4 py-3 text-teal-400 font-mono">{row.percentage.toFixed(1)}%</td>
                    <td className="px-4 py-3"><ConfidenceDot level={row.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overlapDisplayData[0] && (
            <p className="mt-4 text-sm text-slate-400 bg-navy-950/50 p-3 rounded-lg border border-navy-800">
              <strong className="text-white">{overlapDisplayData[0].stock}</strong> makes up {overlapDisplayData[0].percentage.toFixed(1)}% of your effective portfolio — appearing in {overlapDisplayData[0].funds.length} of your funds.
            </p>
          )}
        </div>

        {/* Expense Ratio Comparison */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Expense Ratio Drag</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-coral-500" /> Regular Plan</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-teal-500" /> Direct Plan</div>
            </div>
          </div>
          
          <div className="flex-1 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseChartData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                <Tooltip 
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                />
                <Bar dataKey="regular" fill="#FF6B6B" radius={[0, 4, 4, 0]} barSize={24} name="Regular" />
                <Bar dataKey="direct" fill="#20B2AA" radius={[0, 4, 4, 0]} barSize={24} name="Direct" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rebalancing Plan */}
      {data.rebalancing_plan?.recommendations && data.rebalancing_plan.recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Actionable Rebalancing Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.rebalancing_plan.recommendations.map((plan, i) => (
              <div key={i} className="contents">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-5 rounded-xl bg-navy-900 border border-coral-500/30 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertTriangle className="w-24 h-24 text-coral-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-coral-500/10 text-coral-500 text-xs font-bold uppercase tracking-wider mb-3">
                      Redeem
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1">{plan.fundToRedeem}</h4>
                    <p className="text-sm text-slate-400 mb-4">{plan.units} units • Current Value: {formatCurrency(plan.currentValue)}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b border-navy-800 pb-2">
                        <span className="text-slate-500">Holding Period</span>
                        <span className="text-slate-300 font-medium">{plan.holdingPeriod}</span>
                      </div>
                      <div className="flex justify-between border-b border-navy-800 pb-2">
                        <span className="text-slate-500">Tax Implication</span>
                        <span className={`font-medium ${plan.taxImplication === 'No Tax' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {plan.taxImplication} ({formatCurrency(plan.estimatedTax)})
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.05 }}
                  className="p-5 rounded-xl bg-navy-900 border border-teal-500/30 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-24 h-24 text-teal-500" />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-500 text-xs font-bold uppercase tracking-wider mb-3">
                      Invest
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1">{plan.fundToInvest}</h4>
                    <p className="text-sm text-slate-400 mb-4">Invest proceeds: {formatCurrency(plan.currentValue)}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b border-navy-800 pb-2">
                        <span className="text-slate-500">Why this fund?</span>
                        <span className="text-slate-300 font-medium text-right max-w-[200px]">{plan.reason}</span>
                      </div>
                      <div className="flex justify-between border-b border-navy-800 pb-2">
                        <span className="text-slate-500">Expense Benefit</span>
                        <span className="text-emerald-500 font-medium">{plan.expenseBenefit}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insight */}
      {data.rebalancing_plan?.narrative && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-950 border border-gold-500/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gold-500/10 flex items-center justify-center">
              <span className="text-gold-500 font-bold">AI</span>
            </div>
            <h3 className="text-lg font-semibold text-gold-500">ArthaGPT Insight</h3>
          </div>
          <div className="space-y-4 text-slate-300 leading-relaxed text-sm">
            <p>{data.rebalancing_plan.narrative}</p>
          </div>
          {data.rebalancing_plan.disclaimer && (
            <p className="mt-4 text-xs text-slate-500 italic">{data.rebalancing_plan.disclaimer}</p>
          )}
        </div>
      )}

      {/* Execution Log Accordion */}
      <div className="border border-navy-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowExecutionLog(!showExecutionLog)}
          className="w-full px-6 py-4 flex items-center justify-between bg-navy-900 hover:bg-navy-800 transition-colors"
        >
          <span className="text-sm font-medium text-slate-300">Show Your Math — Execution Trace</span>
          {showExecutionLog ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {showExecutionLog && (
          <div className="p-4 bg-navy-950/50">
            <AgentExecutionLog events={events} />
          </div>
        )}
      </div>
    </div>
  );
}
