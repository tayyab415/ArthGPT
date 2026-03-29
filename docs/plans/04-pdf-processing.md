# Plan: PDF Processing via Gemini Vision

## Approach
Use Gemini 2.0 Flash's vision capability to extract structured data from Indian financial documents.
Pure TypeScript — no Python casparser dependency.

## Supported Documents
1. **CAS (Consolidated Account Statement)** — mutual fund portfolio
2. **Form 16** — salary and tax details
3. **Payslip** — income details

## Tasks

### Task 10: Gemini Vision PDF Parsing Endpoint + Service

**Files:**
- `src/server/agents/utils/pdfParser.ts` (new)
- `server.ts` (modify — add endpoint)

**pdfParser.ts:**
```typescript
// Convert PDF buffer to base64 for Gemini Vision
export async function parsePdfWithGemini(
  pdfBuffer: Buffer,
  documentType: 'cas' | 'form16' | 'payslip'
): Promise<ParsedDocument>

interface ParsedDocument {
  type: 'cas' | 'form16' | 'payslip';
  confidence: number;
  data: CasParsed | Form16Parsed | PayslipParsed;
  rawExtraction: string; // Gemini's raw text for debugging
}

interface CasParsed {
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

interface Form16Parsed {
  employerName: string;
  pan: string;
  assessmentYear: string;
  grossSalary: number;
  deductions: { section: string; amount: number }[];
  taxDeducted: number;
}

interface PayslipParsed {
  employerName: string;
  month: string;
  basicSalary: number;
  hra: number;
  otherAllowances: number;
  grossSalary: number;
  deductions: { name: string; amount: number }[];
  netSalary: number;
}
```

**Gemini Vision call:**
1. Send PDF as base64 inline_data with mimeType "application/pdf"
2. Structured prompt per document type requesting JSON extraction
3. Parse Gemini response as JSON
4. Validate required fields present
5. Return with confidence score based on field completeness

**Endpoint:** `POST /api/v2/parse-document`
- Accepts multipart/form-data with `file` (PDF) and `type` (cas|form16|payslip)
- Returns ParsedDocument JSON
- Max file size: 10MB
- Error handling: invalid PDF, Gemini API failure, low confidence warning

**Acceptance Criteria:**
- Endpoint accepts PDF upload and returns structured JSON
- Works with Gemini 2.0 Flash vision
- Handles errors gracefully (corrupt PDF, API timeout)
- Confidence score reflects extraction quality
- No Python dependencies

### Task 11: Wire PDF Upload UI in Onboarding to Backend

**Files:**
- `src/components/Onboarding.tsx` (modify — Step 4 upload exists)
- `src/components/Dashboard.tsx` (modify — pass parsed data to pipelines)

**Changes to Onboarding:**
1. Step 4 already has file upload UI — wire it to `POST /api/v2/parse-document`
2. Show parsing progress (uploading → parsing → done)
3. Show extracted data preview (fund names, salary, etc.)
4. User confirms or corrects extracted data
5. Pass confirmed data to appropriate pipeline

**Changes to Dashboard:**
1. When parsed CAS data available, auto-populate Portfolio X-Ray input
2. When parsed Form16/payslip data available, auto-populate Tax Wizard input
3. Show "Data from uploaded document" badge

**Acceptance Criteria:**
- Upload PDF in Onboarding → see extracted data preview
- Confirmed data flows to correct pipeline
- Error states handled (upload fail, parse fail, low confidence)
- Works with CAS, Form16, and payslip PDFs
