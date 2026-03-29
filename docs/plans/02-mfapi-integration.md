# Plan: MFapi.in Real Fund Data Integration

## API Reference
- Search: `GET https://api.mfapi.in/mf/search?q=<query>` → `[{ schemeCode, schemeName }]`
- NAV History: `GET https://api.mfapi.in/mf/<schemeCode>` → `{ meta: { scheme_name, isin_growth }, data: [{ date, nav }] }`
- No auth, no rate limiting, CORS enabled

## Tasks

### Task 5: MFapi.in Fund Resolver Service

**Files:** `src/server/agents/utils/mfapi.ts` (new)

**Functions:**
```typescript
// Search for funds by name, return top matches
export async function searchFunds(query: string): Promise<FundSearchResult[]>

// Get full NAV history for a scheme
export async function getFundNav(schemeCode: number): Promise<FundNavHistory>

// Resolve a fund name (from user input / CAS) to a scheme code
// Uses fuzzy matching against search results
export async function resolveFund(fundName: string): Promise<ResolvedFund | null>

// Calculate XIRR from transaction history + current NAV
export async function calculateRealXirr(
  transactions: { date: string; amount: number }[],
  schemeCode: number
): Promise<number>
```

**Types:**
```typescript
interface FundSearchResult { schemeCode: number; schemeName: string }
interface FundNavHistory { meta: { schemeName: string; isin: string }; data: { date: string; nav: number }[] }
interface ResolvedFund { schemeCode: number; schemeName: string; isin: string; latestNav: number }
```

**Implementation notes:**
- Cache search results in-memory (Map<string, result>) with 5-min TTL
- Cache NAV data with 1-hour TTL (NAV updates daily)
- Graceful fallback: if API fails, return null (don't crash pipeline)
- XIRR calculation: Newton-Raphson method, pure math (no npm dependency)

**Acceptance Criteria:**
- `searchFunds("hdfc flexi cap")` returns results with scheme codes
- `getFundNav(118955)` returns NAV history
- `resolveFund("HDFC Flexi Cap Fund Direct Growth")` returns resolved fund with latest NAV
- Cache prevents duplicate API calls within TTL
- Errors return null, not throw

### Task 6: Wire MFapi Data into IngestionAgent + OverlapAgent

**Files:**
- `src/server/agents/portfolio/IngestionAgent.ts` (modify)
- `src/server/agents/portfolio/mockFundData.ts` (modify — add fallback flag)
- `src/server/agents/portfolio/OverlapAgent.ts` (modify)

**Changes to IngestionAgent:**
1. After parsing user's fund list, call `resolveFund()` for each fund name
2. Enrich fund data with real NAV + ISIN from MFapi
3. If `resolveFund()` returns null, fall back to mock data (with `dataSource: "mock"` flag)
4. Calculate real XIRR using `calculateRealXirr()` if transaction dates are available

**Changes to OverlapAgent:**
1. MFapi doesn't provide holdings data (only NAV)
2. Keep existing overlap detection logic (Gemini-based or mock)
3. Add ISIN-based overlap detection: if two funds share same ISIN prefix (AMC match), flag as same-AMC overlap
4. Add `dataSource` tag to overlap results

**Acceptance Criteria:**
- Pipeline runs with real fund names → gets real NAV data
- Mock fallback works when API fails
- XIRR uses real NAV when available
- No breaking changes to existing pipeline flow
