# Plan: What-If Builder (Sensitivity Engine)

## Tasks

### Task 1: Add equityAllocationOverride to fire.ts

**Files:** `src/server/agents/utils/fire.ts`

**Changes:**
1. Add `equityAllocationOverride?: number` (0-100) to `SimulationInputs` interface
2. Pass it through `runMonteCarlo()` and `estimateSuccessProbability()` options
3. In `runSimulationSummary()`, when `equityAllocationOverride` is set, override the equity% from `getAllocationForAge()` — use the override as the starting equity% and still glide down, OR use it as a flat override for all years
4. Recommended: flat override (simpler, more intuitive for user) — if `equityAllocationOverride` is provided, use it instead of `getAllocationForAge()` result for pre-retirement years

**Acceptance Criteria:**
- `runMonteCarlo({ ..., equityAllocationOverride: 80 })` uses 80/20 equity/debt split for all accumulation years
- Post-retirement allocation unchanged (60/40)
- Existing tests (if any) still pass
- `estimateSuccessProbability()` also respects the override
- No changes to function signatures that would break existing callers (override is optional)

### Task 2: Create POST /api/v2/what-if/fire endpoint

**Files:** `server.ts`

**Endpoint:** `POST /api/v2/what-if/fire`

**Request body:**
```typescript
{
  fireInputs: FireInputs;
  macroParameters: MacroParameters;
  monthlySipOverride?: number;
  retirementAgeOverride?: number;
  targetMonthlyDrawOverride?: number;
  equityAllocationOverride?: number;
}
```

**Response:** `MonteCarloResults` (same shape as SSE pipeline returns)

**Implementation:**
1. Import `runMonteCarlo` from fire.ts
2. Parse request body, validate inputs (basic type checks)
3. Call `runMonteCarlo()` with overrides
4. Return JSON response
5. This is a synchronous computation (~50ms for 300 iterations), no SSE needed

**Acceptance Criteria:**
- POST to `/api/v2/what-if/fire` with valid body returns MonteCarloResults JSON
- Invalid body returns 400 with error message
- Uses 300 iterations (fast feedback) not 1000
- Response includes successProbability, percentiles, fanChartData

### Task 3: useWhatIf hook + WhatIfPanel component

**Files:**
- `src/hooks/useWhatIf.ts` (new)
- `src/components/WhatIfPanel.tsx` (new)
- `src/components/FIRERoadmap.tsx` (modify — insert WhatIfPanel)

**useWhatIf hook:**
- State: `{ sip, retirementAge, monthlyDraw, equityAllocation }` initialized from pipeline results
- Debounced fetch (300ms) to `/api/v2/what-if/fire`
- Returns `{ overrides, setOverride, result, isLoading }`
- Only activates after FIRE pipeline completes

**WhatIfPanel component:**
- 4 range sliders: SIP (1k-5L), Retirement Age (40-70), Monthly Draw (10k-5L), Equity % (30-100)
- Each slider shows current value + delta from baseline
- Mini fan chart or just P10/P50/P90 bars updating live
- Success probability meter (big number, color-coded: red <50%, yellow 50-75%, green >75%)
- Gold accent styling matching existing theme
- Uses range slider CSS already in `src/index.css`

**Integration into FIRERoadmap:**
- Insert between hero banner and metric cards (around line 350-400 in FIRERoadmap.tsx)
- Only visible after pipeline completes
- Collapsible (default expanded)

**Acceptance Criteria:**
- Sliders move, debounced API call fires, results update
- Baseline values match pipeline output
- No layout shift on load
- Works on mobile (responsive)

### Task 4: NPS What-If Toggle in TaxWizard

**Files:** `src/components/TaxWizard.tsx`

**Changes:**
1. Add toggle: "Invest 50,000 in NPS under 80CCD(1B)?"
2. When toggled ON: add 50000 to `section80CCD1B` in deductions, re-run `computeTax()`
3. Show delta: "You save X in tax" (difference between old and new tax)
4. Toggle placed near existing deductions display (around line 590)

**Acceptance Criteria:**
- Toggle shows/hides NPS deduction
- Tax savings amount updates immediately (client-side, no API call)
- Both Old and New regime results update
- Styled consistently with existing TaxWizard UI
