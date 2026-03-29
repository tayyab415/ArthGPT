import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import type { SalaryStructure, TaxOptimization, MissedDeduction, TaxSavingSuggestion } from '../core/SessionState';
import type { TaxResult } from '../../taxEngine';

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model names
export const MODELS = {
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
} as const;

type ComplianceContext = 'tax' | 'fire' | 'generic';

/**
 * Extract structured salary data from raw user input using Gemini Flash.
 * Uses structured JSON output with responseJsonSchema.
 */
export async function extractSalaryStructure(rawInput: {
  baseSalary?: number;
  hraReceived?: number;
  rentPaid?: number;
  section80C?: number;
  section80CCD1B?: number;
  section80D?: number;
  homeLoanInterest?: number;
  isMetro?: boolean;
}): Promise<SalaryStructure> {
  const prompt = `You are a tax expert assistant. Extract and validate the salary structure from the following input.
If any field is missing or invalid, use 0 as the default. Validate that:
- baseSalary should be positive
- hraReceived should be <= baseSalary (typically 40-50% of CTC minus basic)
- section80C is capped at 150000
- section80CCD1B is capped at 50000
- section80D is capped at 100000
- homeLoanInterest is capped at 200000

Input data:
${JSON.stringify(rawInput, null, 2)}

Extract the validated salary structure.`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          baseSalary: { type: Type.NUMBER, description: 'Base salary per annum' },
          hraReceived: { type: Type.NUMBER, description: 'HRA component per annum' },
          rentPaid: { type: Type.NUMBER, description: 'Annual rent paid' },
          section80C: { type: Type.NUMBER, description: '80C deductions (max 150000)' },
          section80CCD1B: { type: Type.NUMBER, description: 'Additional NPS under 80CCD1B (max 50000)' },
          section80D: { type: Type.NUMBER, description: 'Health insurance premium (max 100000)' },
          homeLoanInterest: { type: Type.NUMBER, description: 'Home loan interest u/s 24b (max 200000)' },
          isMetro: { type: Type.BOOLEAN, description: 'Whether city is metro (affects HRA calc)' },
          extractionConfidence: {
            type: Type.STRING,
            description: 'Confidence in extraction accuracy',
          },
          extractionNotes: { type: Type.STRING, description: 'Any notes about the extraction' },
        },
        propertyOrdering: ['baseSalary', 'hraReceived', 'rentPaid', 'section80C', 'section80CCD1B', 'section80D', 'homeLoanInterest', 'isMetro', 'extractionConfidence', 'extractionNotes'],
        required: ['baseSalary', 'hraReceived', 'rentPaid', 'section80C', 'section80CCD1B', 'section80D', 'homeLoanInterest', 'isMetro', 'extractionConfidence'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  return {
    baseSalary: Math.max(0, result.baseSalary || 0),
    hraReceived: Math.max(0, result.hraReceived || 0),
    rentPaid: Math.max(0, result.rentPaid || 0),
    section80C: Math.min(150000, Math.max(0, result.section80C || 0)),
    section80CCD1B: Math.min(50000, Math.max(0, result.section80CCD1B || 0)),
    section80D: Math.min(100000, Math.max(0, result.section80D || 0)),
    homeLoanInterest: Math.min(200000, Math.max(0, result.homeLoanInterest || 0)),
    isMetro: Boolean(result.isMetro),
    extractionConfidence: result.extractionConfidence || 'high',
    extractionNotes: result.extractionNotes,
  };
}

/**
 * Generate tax optimization analysis using Gemini Pro.
 * Compares regimes, identifies missed deductions, and generates narrative.
 */
export async function generateTaxOptimization(
  oldResult: TaxResult,
  newResult: TaxResult,
  salaryStructure: SalaryStructure
): Promise<TaxOptimization> {
  const winner = newResult.totalTaxLiability <= oldResult.totalTaxLiability ? 'new' : 'old';
  const savings = Math.abs(oldResult.totalTaxLiability - newResult.totalTaxLiability);

  // Calculate marginal rate for potential savings
  const marginalRate = oldResult.taxableIncome > 1000000 ? 0.312 
    : oldResult.taxableIncome > 500000 ? 0.208 
    : 0.052;

  // Identify missed deductions
  const missed80D = Math.max(0, 25000 - salaryStructure.section80D);
  const missed80CCD1B = Math.max(0, 50000 - salaryStructure.section80CCD1B);

  const prompt = `You are a tax optimization expert. Analyze the following tax computation and provide insights.

SALARY STRUCTURE:
- Gross Salary: ₹${oldResult.grossSalary.toLocaleString('en-IN')}
- Basic Salary: ₹${salaryStructure.baseSalary.toLocaleString('en-IN')}
- HRA Received: ₹${salaryStructure.hraReceived.toLocaleString('en-IN')}
- Rent Paid: ₹${salaryStructure.rentPaid.toLocaleString('en-IN')}
- 80C Claimed: ₹${salaryStructure.section80C.toLocaleString('en-IN')}
- 80CCD(1B) NPS: ₹${salaryStructure.section80CCD1B.toLocaleString('en-IN')}
- 80D Health Insurance: ₹${salaryStructure.section80D.toLocaleString('en-IN')}
- Home Loan Interest: ₹${salaryStructure.homeLoanInterest.toLocaleString('en-IN')}
- Metro City: ${salaryStructure.isMetro ? 'Yes' : 'No'}

OLD REGIME RESULT:
- Taxable Income: ₹${oldResult.taxableIncome.toLocaleString('en-IN')}
- Tax Liability: ₹${oldResult.totalTaxLiability.toLocaleString('en-IN')}
- HRA Exemption: ₹${oldResult.hraExemption.toLocaleString('en-IN')}

NEW REGIME RESULT:
- Taxable Income: ₹${newResult.taxableIncome.toLocaleString('en-IN')}
- Tax Liability: ₹${newResult.totalTaxLiability.toLocaleString('en-IN')}

WINNER: ${winner.toUpperCase()} REGIME (saves ₹${savings.toLocaleString('en-IN')})

MISSED DEDUCTIONS:
- 80D (Health Insurance): ₹${missed80D.toLocaleString('en-IN')} unclaimed (potential saving: ₹${Math.round(missed80D * marginalRate).toLocaleString('en-IN')})
- 80CCD(1B) (NPS): ₹${missed80CCD1B.toLocaleString('en-IN')} unclaimed (potential saving: ₹${Math.round(missed80CCD1B * marginalRate).toLocaleString('en-IN')})

Generate a comprehensive tax optimization analysis with:
1. A clear narrative explaining which regime is better and why
2. Specific missed deduction opportunities with actionable advice
3. Top 3 tax-saving instrument recommendations ranked by liquidity and risk`;

  const response = await ai.models.generateContent({
    model: MODELS.PRO,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          narrative: {
            type: Type.STRING,
            description: 'A clear 2-3 paragraph narrative explaining the tax situation, which regime is better, and key insights',
          },
          missedDeductions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING, description: 'Tax section (e.g., 80D, 80CCD1B)' },
                currentAmount: { type: Type.NUMBER, description: 'Currently claimed amount' },
                maxAmount: { type: Type.NUMBER, description: 'Maximum claimable amount' },
                missedAmount: { type: Type.NUMBER, description: 'Unclaimed amount' },
                potentialSaving: { type: Type.NUMBER, description: 'Potential tax saving in rupees' },
                description: { type: Type.STRING, description: 'Actionable advice' },
              },
              required: ['section', 'currentAmount', 'maxAmount', 'missedAmount', 'potentialSaving', 'description'],
            },
            description: 'List of missed deduction opportunities',
          },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                instrument: { type: Type.STRING, description: 'Name of the tax-saving instrument' },
                section: { type: Type.STRING, description: 'Tax section it falls under' },
                maxBenefit: { type: Type.NUMBER, description: 'Maximum tax benefit in rupees' },
                lockIn: { type: Type.STRING, description: 'Lock-in period' },
                riskLevel: { type: Type.STRING, description: 'Risk level: low, medium, or high' },
                description: { type: Type.STRING, description: 'Brief description and recommendation' },
              },
              required: ['instrument', 'section', 'maxBenefit', 'lockIn', 'riskLevel', 'description'],
            },
            description: 'Top 3 tax-saving instrument recommendations',
          },
        },
        required: ['narrative', 'missedDeductions', 'suggestions'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');

  return {
    winner,
    savings,
    narrative: result.narrative || 'Tax analysis complete.',
    missedDeductions: (result.missedDeductions || []).map((d: MissedDeduction) => ({
      section: d.section,
      currentAmount: d.currentAmount,
      maxAmount: d.maxAmount,
      missedAmount: d.missedAmount,
      potentialSaving: d.potentialSaving,
      description: d.description,
    })),
    suggestions: (result.suggestions || []).map((s: TaxSavingSuggestion) => ({
      instrument: s.instrument,
      section: s.section,
      maxBenefit: s.maxBenefit,
      lockIn: s.lockIn,
      riskLevel: s.riskLevel as 'low' | 'medium' | 'high',
      description: s.description,
    })),
    disclaimer: 'This is AI-generated guidance for educational purposes. Tax laws are subject to change. Consult a Chartered Accountant before filing.',
  };
}

/**
 * Check for compliance violations in the tax optimization narrative.
 */
export async function checkCompliance(
  narrative: string,
  options?: { context?: ComplianceContext },
): Promise<'CLEAN' | { type: string; description: string }[]> {
  const context = options?.context || 'tax';
  const prompt = `You are a compliance checker for financial content in India.
Review the following ${context === 'tax' ? 'tax-related' : context === 'fire' ? 'retirement-planning' : 'financial'} narrative and check for any compliance violations:

NARRATIVE:
${narrative}

Check for:
1. Any promises of specific returns or guaranteed outcomes
2. Language that could be construed as licensed financial advice (vs educational guidance)
3. Missing disclaimers relevant to the content
4. ${context === 'tax' ? 'Incorrect tax rates or slab structures for FY 2025-26' : 'Return or corpus claims stated as certainty instead of probability, scenarios, or ranges'}
5. Any language suggesting the system will execute trades, file returns, or procure products
6. ${context === 'fire' ? 'Insurance recommendations made without an educational framing or probability disclaimer' : 'Any other material compliance risk'}

If the narrative is compliant, respond with status "CLEAN".
If there are violations, list each one with its type and description.`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: 'CLEAN if no violations, VIOLATIONS if issues found' },
          violations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'Type of violation' },
                description: { type: Type.STRING, description: 'Description of the issue' },
              },
              required: ['type', 'description'],
            },
            description: 'List of violations (empty if CLEAN)',
          },
        },
        required: ['status'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  
  if (result.status === 'CLEAN' || !result.violations || result.violations.length === 0) {
    return 'CLEAN';
  }

  return result.violations.map((v: { type: string; description: string }) => ({
    type: v.type,
    description: v.description,
  }));
}

/**
 * Rewrite narrative to fix compliance violations and add disclaimer.
 */
export async function injectDisclaimer(
  narrative: string,
  violations: { type: string; description: string }[],
  options?: { context?: ComplianceContext; disclaimer?: string },
): Promise<string> {
  const context = options?.context || 'tax';
  const standardDisclaimer = options?.disclaimer || (
    context === 'fire'
      ? 'This is AI-generated guidance for educational purposes only. Monte Carlo simulations express probability, not certainty. Actual market conditions may differ materially. It does not constitute licensed financial advice under SEBI (Investment Advisers) Regulations, 2013.'
      : 'This is AI-generated guidance for educational purposes only. It does not constitute licensed financial advice under SEBI (Investment Advisers) Regulations, 2013. Tax laws are subject to change. Please consult a Chartered Accountant or SEBI-registered investment advisor before making financial decisions.'
  );
  const violationList = violations.map(v => `- ${v.type}: ${v.description}`).join('\n');

  const prompt = `You are a compliance editor. Rewrite the following ${context === 'tax' ? 'tax' : context === 'fire' ? 'retirement-planning' : 'financial'} narrative to fix compliance violations and add appropriate disclaimers.

ORIGINAL NARRATIVE:
${narrative}

VIOLATIONS TO FIX:
${violationList}

REQUIREMENTS:
1. Remove any language promising specific outcomes or returns
2. Ensure all advice is framed as educational guidance, not licensed financial advice
3. Add the standard disclaimer at the end
4. Keep the helpful, informative tone while being compliant
5. Maintain all the factual financial information
6. ${context === 'fire' ? 'Retirement outcomes must be phrased as probabilities, scenarios, or ranges, not guarantees.' : 'Do not weaken factual accuracy.'}

Standard disclaimer to include:
"${standardDisclaimer}"`;

  const response = await ai.models.generateContent({
    model: MODELS.FLASH,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          compliantNarrative: { type: Type.STRING, description: 'The rewritten compliant narrative with disclaimer' },
        },
        required: ['compliantNarrative'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  return result.compliantNarrative || narrative + '\n\n⚠️ Disclaimer: This is AI-generated guidance for educational purposes only.';
}
