import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini client (same singleton pattern as gemini.ts)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-2.5-flash';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType = 'cas' | 'form16' | 'payslip';

export interface ParsedDocument {
  type: DocumentType;
  confidence: number; // 0-1
  data: CasParsed | Form16Parsed | PayslipParsed;
  rawExtraction: string; // Gemini's raw text for debugging
}

export interface CasParsed {
  investorName: string;
  pan: string;
  funds: {
    fundName: string;
    folioNumber: string;
    units: number;
    nav: number;
    currentValue: number;
    transactions: { date: string; type: string; amount: number; units: number }[];
  }[];
}

export interface Form16Parsed {
  employerName: string;
  pan: string;
  assessmentYear: string;
  grossSalary: number;
  deductions: { section: string; amount: number }[];
  taxDeducted: number;
}

export interface PayslipParsed {
  employerName: string;
  month: string;
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  grossSalary: number;
  deductions: { name: string; amount: number }[];
  netSalary: number;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const PROMPTS: Record<DocumentType, string> = {
  cas: `Extract all mutual fund holdings from this CAMS/KFintech Consolidated Account Statement. For each fund, extract the fund name, folio number, units, NAV, current value, and all transactions with date, type (Purchase/Redemption/SIP/Switch), amount, and units.`,
  form16: `Extract salary and tax details from this Form 16. Get employer name, PAN, assessment year, gross salary, each deduction section and amount (80C, 80CCD, 80D, HRA, etc.), and total tax deducted (TDS).`,
  payslip: `Extract income details from this payslip. Get employer name, month/period, basic salary, HRA, other allowances, gross salary, all deductions with name and amount, and net salary.`,
};

// ─── JSON Schemas ────────────────────────────────────────────────────────────

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: 'Transaction date' },
    type: { type: Type.STRING, description: 'Transaction type (Purchase/Redemption/SIP/Switch)' },
    amount: { type: Type.NUMBER, description: 'Transaction amount in INR' },
    units: { type: Type.NUMBER, description: 'Number of units transacted' },
  },
  required: ['date', 'type', 'amount', 'units'] as const,
};

const fundSchema = {
  type: Type.OBJECT,
  properties: {
    fundName: { type: Type.STRING, description: 'Mutual fund scheme name' },
    folioNumber: { type: Type.STRING, description: 'Folio number' },
    units: { type: Type.NUMBER, description: 'Total units held' },
    nav: { type: Type.NUMBER, description: 'Latest NAV' },
    currentValue: { type: Type.NUMBER, description: 'Current market value in INR' },
    transactions: { type: Type.ARRAY, items: transactionSchema, description: 'List of transactions' },
  },
  required: ['fundName', 'folioNumber', 'units', 'nav', 'currentValue', 'transactions'] as const,
};

const SCHEMAS: Record<DocumentType, object> = {
  cas: {
    type: Type.OBJECT,
    properties: {
      investorName: { type: Type.STRING, description: 'Investor full name' },
      pan: { type: Type.STRING, description: 'PAN number' },
      funds: { type: Type.ARRAY, items: fundSchema, description: 'List of mutual fund holdings' },
    },
    required: ['investorName', 'pan', 'funds'],
  },
  form16: {
    type: Type.OBJECT,
    properties: {
      employerName: { type: Type.STRING, description: 'Employer name' },
      pan: { type: Type.STRING, description: 'Employee PAN number' },
      assessmentYear: { type: Type.STRING, description: 'Assessment year (e.g. 2025-26)' },
      grossSalary: { type: Type.NUMBER, description: 'Gross salary in INR' },
      deductions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            section: { type: Type.STRING, description: 'Deduction section (e.g. 80C, 80D)' },
            amount: { type: Type.NUMBER, description: 'Deduction amount in INR' },
          },
          required: ['section', 'amount'] as const,
        },
        description: 'List of deductions claimed',
      },
      taxDeducted: { type: Type.NUMBER, description: 'Total TDS deducted in INR' },
    },
    required: ['employerName', 'pan', 'assessmentYear', 'grossSalary', 'deductions', 'taxDeducted'],
  },
  payslip: {
    type: Type.OBJECT,
    properties: {
      employerName: { type: Type.STRING, description: 'Employer name' },
      month: { type: Type.STRING, description: 'Payslip month/period' },
      basicSalary: { type: Type.NUMBER, description: 'Basic salary in INR' },
      hra: { type: Type.NUMBER, description: 'HRA component in INR' },
      otherAllowances: { type: Type.NUMBER, description: 'Other allowances in INR' },
      grossSalary: { type: Type.NUMBER, description: 'Gross salary in INR' },
      deductions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Deduction name (e.g. PF, Professional Tax)' },
            amount: { type: Type.NUMBER, description: 'Deduction amount in INR' },
          },
          required: ['name', 'amount'] as const,
        },
        description: 'List of deductions',
      },
      netSalary: { type: Type.NUMBER, description: 'Net salary (take-home) in INR' },
    },
    required: ['employerName', 'month', 'basicSalary', 'hra', 'otherAllowances', 'grossSalary', 'deductions', 'netSalary'],
  },
};

// ─── Required fields per type (for confidence calculation) ───────────────────

const REQUIRED_FIELDS: Record<DocumentType, string[]> = {
  cas: ['investorName', 'pan', 'funds'],
  form16: ['employerName', 'pan', 'assessmentYear', 'grossSalary', 'deductions', 'taxDeducted'],
  payslip: ['employerName', 'month', 'basicSalary', 'hra', 'otherAllowances', 'grossSalary', 'deductions', 'netSalary'],
};

// ─── Empty defaults for error fallback ───────────────────────────────────────

const EMPTY_DATA: Record<DocumentType, CasParsed | Form16Parsed | PayslipParsed> = {
  cas: { investorName: '', pan: '', funds: [] },
  form16: { employerName: '', pan: '', assessmentYear: '', grossSalary: 0, deductions: [], taxDeducted: 0 },
  payslip: { employerName: '', month: '', basicSalary: 0, hra: 0, otherAllowances: 0, grossSalary: 0, deductions: [], netSalary: 0 },
};

// ─── Confidence calculation ──────────────────────────────────────────────────

function calculateConfidence(data: Record<string, unknown>, documentType: DocumentType): number {
  const requiredFields = REQUIRED_FIELDS[documentType];
  if (requiredFields.length === 0) return 0;

  let present = 0;
  for (const field of requiredFields) {
    const value = data[field];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (typeof value === 'number' && value === 0 && field !== 'taxDeducted') continue;
    if (Array.isArray(value) && value.length === 0 && field === 'funds') continue;
    present++;
  }

  return Math.round((present / requiredFields.length) * 100) / 100;
}

// ─── Main parser function ────────────────────────────────────────────────────

export async function parsePdfWithGemini(
  pdfBuffer: Buffer,
  documentType: DocumentType,
): Promise<ParsedDocument> {
  const base64Data = pdfBuffer.toString('base64');
  const prompt = PROMPTS[documentType];
  const schemaForType = SCHEMAS[documentType];

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: schemaForType,
      },
    });

    const rawText = response.text || '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // JSON parse failure — return raw text with confidence 0
      return {
        type: documentType,
        confidence: 0,
        data: EMPTY_DATA[documentType],
        rawExtraction: rawText,
      };
    }

    const confidence = calculateConfidence(parsed, documentType);

    return {
      type: documentType,
      confidence,
      data: parsed as unknown as CasParsed | Form16Parsed | PayslipParsed,
      rawExtraction: rawText,
    };
  } catch (error) {
    // API failure — return empty data with the error message
    return {
      type: documentType,
      confidence: 0,
      data: EMPTY_DATA[documentType],
      rawExtraction: error instanceof Error ? error.message : String(error),
    };
  }
}
