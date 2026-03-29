# Plan: Cross-Pipeline Intelligence

## Tasks

### Task 7: Extend AnalysisContext for Cross-Pipeline Data Sharing

**Files:**
- `src/contexts/AnalysisContext.tsx` (modify — currently 30 lines)

**Current state:** AnalysisContext holds all 3 pipeline hooks but doesn't expose cross-pipeline accessors.

**Changes:**
1. Add typed accessor functions:
```typescript
interface CrossPipelineData {
  // From Tax pipeline
  taxRegime?: 'old' | 'new';
  taxBracket?: number; // marginal rate
  totalDeductions?: number;
  taxableIncome?: number;
  
  // From Portfolio pipeline
  portfolioXirr?: number;
  totalCorpus?: number;
  fundCount?: number;
  equityAllocation?: number;
  
  // From FIRE pipeline
  fireSuccessProbability?: number;
  requiredSip?: number;
  retirementAge?: number;
}

// Accessor that extracts cross-pipeline data from existing hook results
function getCrossPipelineData(): CrossPipelineData
```

2. Expose `getCrossPipelineData()` from context
3. Each pipeline populates its section when results arrive
4. Consumers can read any pipeline's data without direct dependency

**Acceptance Criteria:**
- `getCrossPipelineData()` returns available data from completed pipelines
- Returns undefined for pipelines that haven't run yet
- No circular dependencies
- Existing pipeline hooks unchanged

### Task 8: Tax-Aware Badge in PortfolioXRay

**Files:** `src/components/PortfolioXRay.tsx` (modify)

**Changes:**
1. Read `taxBracket` from `getCrossPipelineData()`
2. For each fund, compute post-tax return: `xirr * (1 - taxBracket * ltcgRate)`
3. Show small badge: "Post-tax: X.X%" next to each fund's XIRR
4. If tax data unavailable, show "Run Tax Wizard for post-tax view" hint
5. LTCG rate: 12.5% for equity funds held >1yr, 20% with indexation for debt

**Acceptance Criteria:**
- Badge appears when both Portfolio and Tax pipelines have completed
- Correct tax rate applied based on fund type
- Graceful fallback when tax data missing
- No visual disruption to existing layout

### Task 9: FIRE Planner Auto-Populate from Portfolio/Tax Data

**Files:**
- `src/components/FIRERoadmap.tsx` (modify)
- `src/hooks/useSSE.ts` (modify — FireInput defaults)

**Changes:**
1. When FIRE form loads, check `getCrossPipelineData()` for:
   - `totalCorpus` → pre-fill `existingMfCorpus`
   - `taxableIncome` → derive `currentMonthlySip` estimate (10% of post-tax monthly income)
2. Show "Auto-filled from Portfolio X-Ray" label on pre-filled fields
3. User can override any pre-filled value
4. If Portfolio/Tax haven't run, form works normally (empty/default values)

**Acceptance Criteria:**
- FIRE form pre-fills when Portfolio data available
- "Auto-filled" labels appear on pre-filled fields
- User can edit pre-filled values
- Works correctly when no cross-pipeline data exists
