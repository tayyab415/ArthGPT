// ─── Types ───────────────────────────────────────────────────────────────────

export interface FundSearchResult {
  schemeCode: number;
  schemeName: string;
}

export interface FundNavEntry {
  date: string;  // DD-MM-YYYY (raw from API)
  nav: number;   // parsed to number
}

export interface FundNavHistory {
  meta: {
    fundHouse: string;
    schemeType: string;
    schemeCategory: string;
    schemeCode: number;
    schemeName: string;
    isin: string;
  };
  data: FundNavEntry[];
}

export interface ResolvedFund {
  schemeCode: number;
  schemeName: string;
  isin: string;
  latestNav: number;
  fundHouse: string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const SEARCH_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const NAV_TTL_MS = 60 * 60 * 1000;     // 1 hour

const searchCache = new Map<string, { data: FundSearchResult[]; expiry: number }>();
const navCache = new Map<number, { data: FundNavHistory; expiry: number }>();

function getCachedSearch(key: string): FundSearchResult[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSearch(key: string, data: FundSearchResult[]): void {
  searchCache.set(key, { data, expiry: Date.now() + SEARCH_TTL_MS });
}

function getCachedNav(schemeCode: number): FundNavHistory | null {
  const entry = navCache.get(schemeCode);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    navCache.delete(schemeCode);
    return null;
  }
  return entry.data;
}

function setCachedNav(schemeCode: number, data: FundNavHistory): void {
  navCache.set(schemeCode, { data, expiry: Date.now() + NAV_TTL_MS });
}

// ─── API Functions ───────────────────────────────────────────────────────────

const BASE_URL = 'https://api.mfapi.in/mf';

/** Search for mutual fund schemes by name. */
export async function searchFunds(query: string): Promise<FundSearchResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query.trim())}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[MFapi] Search request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) {
      console.error('[MFapi] Search response is not an array');
      return [];
    }

    const results: FundSearchResult[] = raw.map((item: { schemeCode: number; schemeName: string }) => ({
      schemeCode: Number(item.schemeCode),
      schemeName: String(item.schemeName),
    }));

    setCachedSearch(cacheKey, results);
    return results;
  } catch (error) {
    console.error('[MFapi] Search failed:', error);
    return [];
  }
}

/** Get NAV history for a specific scheme code. */
export async function getFundNav(schemeCode: number): Promise<FundNavHistory | null> {
  const cached = getCachedNav(schemeCode);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/${schemeCode}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[MFapi] NAV request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const raw = await response.json() as {
      meta: {
        fund_house: string;
        scheme_type: string;
        scheme_category: string;
        scheme_code: number;
        scheme_name: string;
        isin_growth: string;
        isin_div_reinvestment: string;
      };
      data: { date: string; nav: string }[];
      status: string;
    };

    if (raw.status === 'ERROR' || !raw.meta || !Array.isArray(raw.data)) {
      console.error('[MFapi] NAV response indicates error or invalid structure');
      return null;
    }

    const history: FundNavHistory = {
      meta: {
        fundHouse: raw.meta.fund_house,
        schemeType: raw.meta.scheme_type,
        schemeCategory: raw.meta.scheme_category,
        schemeCode: Number(raw.meta.scheme_code),
        schemeName: raw.meta.scheme_name,
        isin: raw.meta.isin_growth || raw.meta.isin_div_reinvestment || '',
      },
      data: raw.data.map((entry) => ({
        date: entry.date,
        nav: parseFloat(entry.nav),
      })),
    };

    setCachedNav(schemeCode, history);
    return history;
  } catch (error) {
    console.error('[MFapi] NAV fetch failed:', error);
    return null;
  }
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

const NOISE_WORDS = ['fund', 'growth', 'plan', 'option', 'regular', 'direct'];

function normalizeFundName(name: string): string {
  let normalized = name.toLowerCase();
  for (const word of NOISE_WORDS) {
    normalized = normalized.replaceAll(word, '');
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = a.split(' ').filter(Boolean);
  const wordsB = b.split(' ').filter(Boolean);
  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setB = new Set(wordsB);
  let matchCount = 0;
  for (const word of wordsA) {
    if (setB.has(word)) matchCount += 1;
  }

  return matchCount / Math.max(wordsA.length, wordsB.length);
}

/**
 * Resolve a fund name (from user input / CAS statement) to a scheme code.
 * Uses fuzzy matching: normalizes strings, searches via API, picks best match.
 */
export async function resolveFund(fundName: string): Promise<ResolvedFund | null> {
  try {
    const normalizedInput = normalizeFundName(fundName);
    if (!normalizedInput) return null;

    const results = await searchFunds(normalizedInput);
    if (results.length === 0) return null;

    let bestResult: FundSearchResult | null = null;
    let bestScore = 0;

    for (const result of results) {
      const normalizedResult = normalizeFundName(result.schemeName);
      const score = jaccardSimilarity(normalizedInput, normalizedResult);
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }

    if (!bestResult || bestScore <= 0.4) return null;

    const navHistory = await getFundNav(bestResult.schemeCode);
    if (!navHistory || navHistory.data.length === 0) return null;

    return {
      schemeCode: bestResult.schemeCode,
      schemeName: bestResult.schemeName,
      isin: navHistory.meta.isin,
      latestNav: navHistory.data[0].nav,
      fundHouse: navHistory.meta.fundHouse,
    };
  } catch (error) {
    console.error('[MFapi] resolveFund failed:', error);
    return null;
  }
}

// ─── XIRR Calculation ────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  // Accepts YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(d1: Date, d2: Date): number {
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Calculate XIRR from a list of transactions and current NAV.
 * Uses Newton-Raphson method — pure math, no npm dependency.
 *
 * @param transactions - Array of { date: YYYY-MM-DD, amount: number } where negative = buy, positive = sell
 * @param currentValue - Current portfolio value (positive)
 * @param currentDate  - Defaults to today (YYYY-MM-DD)
 * @returns Annual XIRR rate (e.g. 0.12 for 12%). Returns 0 if doesn't converge.
 */
export function calculateRealXirr(
  transactions: { date: string; amount: number }[],
  currentValue: number,
  currentDate?: string,
): number {
  const today = currentDate
    ? currentDate
    : new Date().toISOString().slice(0, 10);

  const cashFlows: { date: Date; amount: number }[] = transactions.map((t) => ({
    date: parseDate(t.date),
    amount: t.amount,
  }));

  // Add current portfolio value as final positive cash flow
  cashFlows.push({ date: parseDate(today), amount: currentValue });

  if (cashFlows.length < 2) return 0;

  const d0 = cashFlows[0].date;

  // f(rate) = sum of CF_i / (1 + rate) ^ (days_i / 365)
  function f(rate: number): number {
    let sum = 0;
    for (const cf of cashFlows) {
      const years = daysBetween(d0, cf.date) / 365;
      sum += cf.amount / Math.pow(1 + rate, years);
    }
    return sum;
  }

  // f'(rate) = sum of -years_i * CF_i / (1 + rate) ^ (years_i + 1)
  function fPrime(rate: number): number {
    let sum = 0;
    for (const cf of cashFlows) {
      const years = daysBetween(d0, cf.date) / 365;
      sum += -years * cf.amount / Math.pow(1 + rate, years + 1);
    }
    return sum;
  }

  let rate = 0.1; // initial guess
  const MAX_ITERATIONS = 100;
  const TOLERANCE = 1e-7;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const fVal = f(rate);
    const fPrimeVal = fPrime(rate);

    if (Math.abs(fPrimeVal) < 1e-12) break; // avoid division by near-zero

    const newRate = rate - fVal / fPrimeVal;

    if (Math.abs(newRate - rate) < TOLERANCE) {
      return newRate;
    }

    rate = newRate;

    // Guard against divergence
    if (!Number.isFinite(rate) || rate < -0.99) {
      return 0;
    }
  }

  return 0; // did not converge
}
