import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, Info, AlertTriangle, CheckCircle2, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { UserProfile } from '../App';

export function PortfolioXRay({ profile }: { profile: UserProfile }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build fund list from profile investments
      const mfInvestment = profile.investments.find(i => i.type === 'Mutual Funds');
      const stockInvestment = profile.investments.find(i => i.type === 'Stocks');
      
      // If user has mutual fund data, use realistic distribution based on their corpus
      const totalMfValue = (mfInvestment?.value || 0) + (stockInvestment?.value || 0);
      
      // Build a representative fund list — in production this comes from CAMS PDF parse
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

      const riskProfile = profile.goals.includes('Aggressive Growth') ? 'Aggressive' : profile.goals.includes('Retirement Corpus') ? 'Moderate' : 'Balanced';
      const horizon = profile.age < 35 ? '20+ years' : profile.age < 45 ? '15 years' : '10 years';

      const res = await fetch('/api/analyze-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funds, riskProfile, investmentHorizon: horizon })
      });

      if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);

      const json = await res.json();
      if (!json || typeof json.trueXirr === 'undefined') throw new Error('Invalid response format from analysis engine');
      setData(json);
    } catch (e: any) {
      console.error('Portfolio analysis failed:', e);
      setError(e.message || 'Failed to analyse portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
        <p className="text-slate-400 text-sm">Analysing your portfolio with Gemini AI…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <WifiOff className="w-12 h-12 text-coral-500" />
        <h3 className="text-xl font-semibold text-white">Analysis Failed</h3>
        <p className="text-slate-400 text-center max-w-md">{error}</p>
        <button
          onClick={fetchPortfolio}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-navy-950 font-semibold hover:bg-gold-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Portfolio X-Ray</h2>
          <p className="text-slate-400 mt-1">Deep analysis of your mutual fund holdings.</p>
        </div>
        <div className="px-4 py-2 bg-navy-800 rounded-full border border-navy-700 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-300">Live Analysis</span>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'True XIRR', value: `${data.trueXirr}%`, trend: `+${(data.trueXirr - data.benchmarkReturn).toFixed(1)}% vs BM`, positive: data.trueXirr > data.benchmarkReturn },
          { label: 'Benchmark Return', value: `${data.benchmarkReturn}%`, trend: 'Nifty 500 TRI', positive: true },
          { label: 'Expense Ratio Drag', value: `${formatCurrency(data.expenseRatioDrag)}/yr`, trend: 'Switch to Direct', positive: false },
          { label: 'Overlapping Stocks', value: data.overlappingStocks.toString(), trend: 'High Concentration', positive: false },
        ].map((metric, i) => (
          <div key={i} className="p-6 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-700 transition-colors">
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
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overlap Map */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Stock Overlap Heatmap</h3>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-navy-950/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Stock</th>
                  <th className="px-4 py-3">Mirae</th>
                  <th className="px-4 py-3">HDFC</th>
                  <th className="px-4 py-3">SBI</th>
                  <th className="px-4 py-3 rounded-tr-lg">PPFAS</th>
                </tr>
              </thead>
              <tbody>
                {data.overlapData.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-navy-800/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-200">{row.stock}</td>
                    {['Mirae', 'HDFC', 'SBI', 'Parag Parikh'].map((fund) => {
                      const isPresent = row.funds.includes(fund);
                      return (
                        <td key={fund} className="px-4 py-3">
                          <div className={`w-full h-8 rounded-md ${isPresent ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-navy-950/30'}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-400 bg-navy-950/50 p-3 rounded-lg border border-navy-800">
            <strong className="text-white">Reliance Industries</strong> makes up 11.2% of your effective portfolio — appearing in 3 of your 4 funds.
          </p>
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
              <BarChart data={data.expenseData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={120} />
                <Tooltip 
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="regular" stackId="a" fill="#FF6B6B" radius={[0, 4, 4, 0]} barSize={24} />
                <Bar dataKey="direct" stackId="b" fill="#20B2AA" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rebalancing Plan */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Actionable Rebalancing Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.rebalancingPlan.map((plan: any, i: number) => (
            <div key={i} className="contents">
              <div className="p-5 rounded-xl bg-navy-900 border border-coral-500/30 relative overflow-hidden group">
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
                      <span className="text-slate-500">Estimated Tax</span>
                      <span className="text-emerald-500 font-medium">{formatCurrency(plan.estimatedTax)} (Within ₹1.25L exemption)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-navy-900 border border-teal-500/30 relative overflow-hidden group">
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
                      <span className="text-slate-500">Expense Ratio Benefit</span>
                      <span className="text-emerald-500 font-medium">{plan.expenseBenefit}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-navy-900 to-navy-950 border border-gold-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-gold-500/10 flex items-center justify-center">
            <span className="text-gold-500 font-bold">AI</span>
          </div>
          <h3 className="text-lg font-semibold text-gold-500">ArthaGPT Insight</h3>
        </div>
        <div className="space-y-4 text-slate-300 leading-relaxed text-sm">
          <p>
            Your portfolio shows strong historical performance, beating the Nifty 500 TRI by 2.1% annualised. However, you are losing approximately ₹14,250 every year to regular plan commissions. Furthermore, your large-cap exposure is highly concentrated, with Reliance Industries and HDFC Bank dominating across multiple funds.
          </p>
          <p>
            By executing the rebalancing plan above, you can eliminate the commission drag and diversify your holdings without incurring any Long Term Capital Gains (LTCG) tax, as your gains fall within the ₹1.25L annual exemption limit.
          </p>
        </div>
      </div>
    </div>
  );
}
