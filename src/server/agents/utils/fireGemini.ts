import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  FireInputs,
  FireRoadmap,
  FireTimelineItem,
  FireRecommendedAction,
  InsuranceGaps,
  MacroParameters,
  MonteCarloResults,
  SipPlan,
} from '../core/SessionState';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const FIRE_MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-3.1-pro-preview',
  PRO_FALLBACK: 'gemini-2.5-pro',
} as const;

interface MacroMetricPayload {
  value?: number;
  asOf?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface FireScenarioComparison {
  label: string;
  description: string;
  successProbability: number;
}

export async function fetchMacroParametersLive(): Promise<MacroParameters> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await ai.models.generateContent({
    model: FIRE_MODELS.FLASH,
    contents: `You are fetching current Indian macro-financial parameters for a FIRE retirement simulation.

Use Google Search grounding to find realistic current India data as of ${today}.
Return decimal values, not percentages. For example 6.1% must be returned as 0.061.

Required fields:
- repoRate: current RBI repo rate
- inflationRate: latest India CPI inflation rate
- niftyMeanReturn: realistic long-run annual equity return assumption for Nifty 50 using recent trailing 5Y CAGR and current market context
- niftyStdDev: realistic annualized volatility assumption for Nifty 50
- bondYield: current India 10-year government bond yield
- fdRate: current SBI fixed deposit rate suitable as a conservative debt-return proxy

Requirements:
- Use only current India-focused sources.
- Each metric must include source label and URL.
- If a metric is estimated from multiple searched facts, explain that in notes.
- Keep notes short and factual.`,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          repoRate: macroMetricSchema('Current RBI repo rate'),
          inflationRate: macroMetricSchema('Latest India CPI inflation rate'),
          niftyMeanReturn: macroMetricSchema('Long-run annual return assumption for Nifty 50 as decimal'),
          niftyStdDev: macroMetricSchema('Annualized Nifty 50 volatility assumption as decimal'),
          bondYield: macroMetricSchema('Current India 10-year government bond yield'),
          fdRate: macroMetricSchema('Current SBI FD rate'),
          notes: { type: Type.STRING },
        },
        required: ['repoRate', 'inflationRate', 'niftyMeanReturn', 'niftyStdDev', 'bondYield', 'fdRate'],
      },
      temperature: 0.1,
      seed: 20260329,
      tools: [{ googleSearch: {} }],
    },
  });

  const parsed = JSON.parse(response.text || '{}') as Record<string, MacroMetricPayload>;
  return normalizeMacroParameters(parsed, today);
}

export function buildFallbackMacroParameters(reason?: string): MacroParameters {
  const asOf = new Date().toISOString().slice(0, 10);
  const sourceLabel = reason ? `Fallback snapshot: ${reason}` : 'Fallback snapshot';

  return {
    repoRate: { value: 0.0600, asOf, sourceLabel },
    inflationRate: { value: 0.0520, asOf, sourceLabel },
    niftyMeanReturn: { value: 0.1250, asOf, sourceLabel, notes: 'Fallback long-run equity assumption' },
    niftyStdDev: { value: 0.1850, asOf, sourceLabel, notes: 'Fallback annualized volatility assumption' },
    bondYield: { value: 0.0710, asOf, sourceLabel },
    fdRate: { value: 0.0680, asOf, sourceLabel },
    asOf,
    sourceMode: 'fallback',
    sources: [{ label: sourceLabel, retrievedAt: new Date().toISOString() }],
    notes: 'Used fallback macro snapshot because live search was unavailable.',
  };
}

export async function generateFireRoadmap(params: {
  fireInputs: FireInputs;
  macroParameters: MacroParameters;
  monteCarloResults: MonteCarloResults;
  sipPlan: SipPlan;
  insuranceGaps: InsuranceGaps;
  scenarioComparisons: FireScenarioComparison[];
}): Promise<FireRoadmap> {
  const prompt = `You are ArthaGPT's FIRE roadmap strategist. Write a user-facing retirement roadmap based on probabilistic planning, not guarantees.

USER PROFILE
- Age: ${params.fireInputs.currentAge}
- Retirement age target: ${params.fireInputs.retirementAge}
- Annual income: ${formatInr(params.fireInputs.annualIncome)}
- Existing corpus: ${formatInr(params.fireInputs.existingCorpus)}
- Current SIP: ${formatInr(params.fireInputs.currentMonthlySip)} per month
- Desired monthly draw in today's rupees: ${formatInr(params.fireInputs.targetMonthlyDrawToday)}

MACRO SNAPSHOT
- As of: ${params.macroParameters.asOf}
- Inflation: ${(params.macroParameters.inflationRate.value * 100).toFixed(2)}%
- Nifty mean return: ${(params.macroParameters.niftyMeanReturn.value * 100).toFixed(2)}%
- Nifty volatility: ${(params.macroParameters.niftyStdDev.value * 100).toFixed(2)}%
- Bond yield: ${(params.macroParameters.bondYield.value * 100).toFixed(2)}%

MONTE CARLO OUTPUT
- Success probability: ${params.monteCarloResults.successProbability.toFixed(1)}%
- P10 retirement corpus: ${formatInr(params.monteCarloResults.retirementCorpusPercentiles.p10)}
- P50 retirement corpus: ${formatInr(params.monteCarloResults.retirementCorpusPercentiles.p50)}
- P90 retirement corpus: ${formatInr(params.monteCarloResults.retirementCorpusPercentiles.p90)}
- Average shortfall in failing paths: ${formatInr(params.monteCarloResults.shortfallAnalysis.averageShortfall)}
- Average depletion age in failing paths: ${params.monteCarloResults.shortfallAnalysis.averageDepletionAge?.toFixed(1) ?? 'N/A'}

SIP PLAN
- Median SIP required: ${formatInr(params.sipPlan.medianSipRequired)} per month
- Safety SIP required: ${formatInr(params.sipPlan.safetySipRequired)} per month

INSURANCE
- Life cover gap: ${formatInr(params.insuranceGaps.lifeCoverGap)}
- Recommended health cover: ${formatInr(params.insuranceGaps.recommendedHealthCover)}

SCENARIO ANALYSIS
${params.scenarioComparisons.map((scenario) => `- ${scenario.label}: ${scenario.successProbability.toFixed(1)}% success. ${scenario.description}`).join('\n')}

Requirements:
- The roadmap must explicitly frame outcomes as probabilities, scenarios, or ranges. Never use guarantee language.
- If success probability is below 50%, strongly recommend increasing SIP and/or delaying retirement.
- Include exact rupee amounts where available.
- Keep the tone direct, educational, and compliance-safe.
- Produce 3-4 recommended actions and 3-4 timeline items.`;

  const response = await runRoadmapModel(prompt);
  const result = JSON.parse(response.text || '{}') as {
    headline?: string;
    narrative?: string;
    probabilityInterpretation?: string;
    recommendedActions?: FireRecommendedAction[];
    timeline?: FireTimelineItem[];
  };

  return {
    headline: result.headline || 'Probabilistic FIRE roadmap generated',
    narrative: result.narrative || '',
    probabilityInterpretation: result.probabilityInterpretation || '',
    recommendedActions: result.recommendedActions || [],
    timeline: result.timeline || [],
  };
}

export function generateDeterministicFireRoadmap(params: {
  fireInputs: FireInputs;
  monteCarloResults: MonteCarloResults;
  sipPlan: SipPlan;
  insuranceGaps: InsuranceGaps;
  scenarioComparisons: FireScenarioComparison[];
}): FireRoadmap {
  const successRate = params.monteCarloResults.successProbability;
  const strongestScenario = [...params.scenarioComparisons].sort((a, b) => b.successProbability - a.successProbability)[0];
  const baseNarrative = successRate < 50
    ? `Your current plan is fragile. The simulation shows only a ${successRate.toFixed(1)}% chance of funding retirement through age ${params.fireInputs.lifeExpectancyAge}.`
    : `Your current plan is viable but still uncertain. The simulation shows a ${successRate.toFixed(1)}% chance of funding retirement through age ${params.fireInputs.lifeExpectancyAge}.`;

  return {
    headline: `Current plan success probability: ${successRate.toFixed(1)}%`,
    narrative: [
      baseNarrative,
      `The median retirement corpus is ${formatInr(params.monteCarloResults.retirementCorpusPercentiles.p50)}, while the worst 10% of outcomes fall to ${formatInr(params.monteCarloResults.retirementCorpusPercentiles.p10)}.`,
      `The most effective immediate change is ${strongestScenario.label.toLowerCase()}, which moves success probability to ${strongestScenario.successProbability.toFixed(1)}%.`,
    ].join(' '),
    probabilityInterpretation: `Treat this as a probability range, not a promise. A stronger SIP or later retirement narrows the downside tail more than a static calculator would show.`,
    recommendedActions: [
      {
        title: 'Align monthly investing with the required SIP',
        amount: params.sipPlan.medianSipRequired,
        impact: `Median target plan requires about ${formatInr(params.sipPlan.medianSipRequired)}/month.`,
        timeframe: 'Month 1',
      },
      {
        title: 'Use the safety SIP if you want a higher-confidence plan',
        amount: params.sipPlan.safetySipRequired,
        impact: `Higher-confidence plan requires about ${formatInr(params.sipPlan.safetySipRequired)}/month.`,
        timeframe: 'Month 1-3',
      },
      {
        title: 'Close the insurance gap',
        amount: params.insuranceGaps.lifeCoverGap,
        impact: params.insuranceGaps.summary,
        timeframe: 'Month 1-2',
      },
    ],
    timeline: [
      {
        title: 'Start or increase SIPs',
        timeframe: 'Month 1',
        detail: `Move current SIPs toward ${formatInr(params.sipPlan.medianSipRequired)}/month and automate the contributions.`,
      },
      {
        title: 'Apply the annual 10% SIP step-up',
        timeframe: 'Year 1 onward',
        detail: 'Tie the SIP step-up to salary revisions so the savings rate rises before lifestyle creep sets in.',
      },
      {
        title: 'Review the plan against actual returns',
        timeframe: 'Every 12 months',
        detail: 'Re-run the Monte Carlo projection annually instead of trusting the original path.',
      },
    ],
  };
}

async function runRoadmapModel(prompt: string) {
  try {
    return await ai.models.generateContent({
      model: FIRE_MODELS.PRO,
      contents: prompt,
      config: roadmapConfig(),
    });
  } catch {
    return ai.models.generateContent({
      model: FIRE_MODELS.PRO_FALLBACK,
      contents: prompt,
      config: roadmapConfig(),
    });
  }
}

function roadmapConfig() {
  return {
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        narrative: { type: Type.STRING },
        probabilityInterpretation: { type: Type.STRING },
        recommendedActions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              impact: { type: Type.STRING },
              timeframe: { type: Type.STRING },
            },
            required: ['title', 'impact', 'timeframe'],
          },
        },
        timeline: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              timeframe: { type: Type.STRING },
              detail: { type: Type.STRING },
            },
            required: ['title', 'timeframe', 'detail'],
          },
        },
      },
      required: ['headline', 'narrative', 'probabilityInterpretation', 'recommendedActions', 'timeline'],
    },
    temperature: 0.2,
    seed: 20260329,
  } as const;
}

function normalizeMacroParameters(
  parsed: Record<string, MacroMetricPayload>,
  asOf: string,
): MacroParameters {
  const normalized = {
    repoRate: normalizeMetric(parsed.repoRate, 0.0600, asOf, 'RBI search result'),
    inflationRate: normalizeMetric(parsed.inflationRate, 0.0520, asOf, 'India CPI search result'),
    niftyMeanReturn: normalizeMetric(parsed.niftyMeanReturn, 0.1250, asOf, 'Nifty return search result'),
    niftyStdDev: normalizeMetric(parsed.niftyStdDev, 0.1850, asOf, 'Nifty volatility search result'),
    bondYield: normalizeMetric(parsed.bondYield, 0.0710, asOf, 'India bond yield search result'),
    fdRate: normalizeMetric(parsed.fdRate, 0.0680, asOf, 'SBI FD search result'),
  };

  const uniqueSources = new Map<string, { label: string; url?: string; retrievedAt: string }>();
  Object.values(normalized).forEach((metric) => {
    const key = `${metric.sourceLabel}|${metric.sourceUrl || ''}`;
    uniqueSources.set(key, {
      label: metric.sourceLabel,
      url: metric.sourceUrl,
      retrievedAt: new Date().toISOString(),
    });
  });

  const liveCount = Object.values(normalized).filter((metric) => metric.sourceUrl).length;

  return {
    ...normalized,
    asOf,
    sourceMode: liveCount === 6 ? 'live' : liveCount > 0 ? 'mixed' : 'fallback',
    sources: Array.from(uniqueSources.values()),
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
  };
}

function normalizeMetric(
  payload: MacroMetricPayload | undefined,
  fallbackValue: number,
  asOf: string,
  defaultSourceLabel: string,
) {
  return {
    value: sanitizeRate(payload?.value, fallbackValue),
    asOf: payload?.asOf || asOf,
    sourceLabel: payload?.sourceLabel || defaultSourceLabel,
    sourceUrl: payload?.sourceUrl,
    notes: payload?.notes,
  };
}

function sanitizeRate(value: number | undefined, fallbackValue: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackValue;
  }

  if (value > 1) {
    return value / 100;
  }

  return value;
}

function macroMetricSchema(description: string) {
  return {
    type: Type.OBJECT,
    properties: {
      value: { type: Type.NUMBER, description },
      asOf: { type: Type.STRING },
      sourceLabel: { type: Type.STRING },
      sourceUrl: { type: Type.STRING },
      notes: { type: Type.STRING },
    },
    required: ['value', 'asOf', 'sourceLabel'],
  };
}

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
