/**
 * Mock Fund Data Layer
 * 
 * Simulates the three-layer data confidence architecture:
 * - Layer 1 (HIGH): RAG store with AMFI factsheets (pre-indexed top 100 funds)
 * - Layer 2 (MEDIUM): Exa MCP fallback for less common funds
 * - Layer 3 (LOW): Google Search as last resort
 * 
 * In production, these would be real API calls to ChromaDB, Exa, and Google.
 * For Phase 2, we simulate with realistic mock data and small delays.
 */

import type { ConfidenceLevel } from '../core/SessionState';

// Simulated network latency ranges (ms)
const LATENCY = {
  RAG_STORE: { min: 50, max: 150 },      // Fast local DB lookup
  EXA_SEARCH: { min: 200, max: 400 },    // Network call to Exa
  GOOGLE_SEARCH: { min: 300, max: 600 }, // Slower, less reliable
};

/**
 * Simulate network latency with a random delay in the given range
 */
function simulateLatency(range: { min: number; max: number }): Promise<void> {
  const delay = Math.random() * (range.max - range.min) + range.min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock Fund Holdings Data (Layer 1: RAG Store)
// ═══════════════════════════════════════════════════════════════════════════

interface FundHolding {
  stock: string;
  weight: number;  // percentage
  sector: string;
}

interface FundHoldingsResult {
  holdings: FundHolding[];
  confidence: ConfidenceLevel;
  source: string;
}

// Top 100 funds with pre-indexed holdings (simulating AMFI factsheets in RAG)
const RAG_HOLDINGS: Record<string, FundHolding[]> = {
  'HDFC Top 100': [
    { stock: 'HDFC Bank', weight: 9.8, sector: 'Banking' },
    { stock: 'Reliance Industries', weight: 8.5, sector: 'Energy' },
    { stock: 'ICICI Bank', weight: 7.2, sector: 'Banking' },
    { stock: 'Infosys', weight: 6.4, sector: 'IT' },
    { stock: 'TCS', weight: 5.8, sector: 'IT' },
    { stock: 'Bharti Airtel', weight: 4.2, sector: 'Telecom' },
    { stock: 'ITC', weight: 3.9, sector: 'FMCG' },
    { stock: 'Axis Bank', weight: 3.5, sector: 'Banking' },
    { stock: 'Kotak Mahindra Bank', weight: 3.2, sector: 'Banking' },
    { stock: 'Larsen & Toubro', weight: 2.8, sector: 'Infrastructure' },
  ],
  'Mirae Asset Large Cap': [
    { stock: 'HDFC Bank', weight: 10.2, sector: 'Banking' },
    { stock: 'Reliance Industries', weight: 9.1, sector: 'Energy' },
    { stock: 'ICICI Bank', weight: 7.8, sector: 'Banking' },
    { stock: 'Infosys', weight: 6.9, sector: 'IT' },
    { stock: 'TCS', weight: 6.2, sector: 'IT' },
    { stock: 'Bharti Airtel', weight: 4.5, sector: 'Telecom' },
    { stock: 'SBI', weight: 4.0, sector: 'Banking' },
    { stock: 'HUL', weight: 3.6, sector: 'FMCG' },
    { stock: 'Axis Bank', weight: 3.2, sector: 'Banking' },
    { stock: 'Maruti Suzuki', weight: 2.9, sector: 'Auto' },
  ],
  'HDFC Flexi Cap': [
    { stock: 'HDFC Bank', weight: 8.4, sector: 'Banking' },
    { stock: 'Reliance Industries', weight: 7.6, sector: 'Energy' },
    { stock: 'ICICI Bank', weight: 6.8, sector: 'Banking' },
    { stock: 'Infosys', weight: 5.9, sector: 'IT' },
    { stock: 'Bajaj Finance', weight: 4.8, sector: 'Finance' },
    { stock: 'TCS', weight: 4.5, sector: 'IT' },
    { stock: 'Bharti Airtel', weight: 3.8, sector: 'Telecom' },
    { stock: 'Sun Pharma', weight: 3.2, sector: 'Pharma' },
    { stock: 'Titan Company', weight: 2.9, sector: 'Consumer' },
    { stock: 'Asian Paints', weight: 2.6, sector: 'Consumer' },
  ],
  'Parag Parikh Flexi Cap': [
    { stock: 'Alphabet (Google)', weight: 7.2, sector: 'IT (US)' },
    { stock: 'Microsoft', weight: 5.8, sector: 'IT (US)' },
    { stock: 'Amazon', weight: 4.5, sector: 'E-commerce (US)' },
    { stock: 'ICICI Bank', weight: 5.2, sector: 'Banking' },
    { stock: 'Bajaj Holdings', weight: 4.8, sector: 'Finance' },
    { stock: 'ITC', weight: 4.2, sector: 'FMCG' },
    { stock: 'Coal India', weight: 3.8, sector: 'Mining' },
    { stock: 'HDFC Bank', weight: 3.5, sector: 'Banking' },
    { stock: 'Power Grid Corp', weight: 3.2, sector: 'Utilities' },
    { stock: 'HCL Technologies', weight: 2.9, sector: 'IT' },
  ],
  'SBI Small Cap': [
    { stock: 'Finolex Industries', weight: 3.2, sector: 'Manufacturing' },
    { stock: 'Blue Star', weight: 2.8, sector: 'Consumer Durables' },
    { stock: 'KPIT Technologies', weight: 2.6, sector: 'IT' },
    { stock: 'Carborundum Universal', weight: 2.4, sector: 'Manufacturing' },
    { stock: 'Kalpataru Projects', weight: 2.2, sector: 'Infrastructure' },
    { stock: 'JK Cement', weight: 2.1, sector: 'Cement' },
    { stock: 'Kaynes Technology', weight: 2.0, sector: 'Electronics' },
    { stock: 'Praj Industries', weight: 1.9, sector: 'Engineering' },
    { stock: 'Sonata Software', weight: 1.8, sector: 'IT' },
    { stock: 'Brigade Enterprises', weight: 1.7, sector: 'Real Estate' },
  ],
  'Axis Midcap': [
    { stock: 'Persistent Systems', weight: 4.8, sector: 'IT' },
    { stock: 'Cholamandalam Investment', weight: 4.2, sector: 'Finance' },
    { stock: 'Max Healthcare', weight: 3.9, sector: 'Healthcare' },
    { stock: 'Indian Hotels', weight: 3.5, sector: 'Hospitality' },
    { stock: 'Fortis Healthcare', weight: 3.2, sector: 'Healthcare' },
    { stock: 'Tube Investments', weight: 3.0, sector: 'Manufacturing' },
    { stock: 'Supreme Industries', weight: 2.8, sector: 'Plastics' },
    { stock: 'Astral Ltd', weight: 2.6, sector: 'Plastics' },
    { stock: 'PI Industries', weight: 2.4, sector: 'Chemicals' },
    { stock: 'Voltas', weight: 2.2, sector: 'Consumer Durables' },
  ],
};

// Normalize fund name for lookup
function normalizeFundName(name: string): string {
  // Remove common suffixes and normalize
  return name
    .replace(/\s*(Fund|Plan|Growth|Dividend|Regular|Direct|-)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find best match in RAG store
function findInRagStore(fundName: string): FundHolding[] | null {
  const normalized = normalizeFundName(fundName).toLowerCase();
  
  for (const [ragFund, holdings] of Object.entries(RAG_HOLDINGS)) {
    const normalizedRag = normalizeFundName(ragFund).toLowerCase();
    if (normalized.includes(normalizedRag) || normalizedRag.includes(normalized)) {
      return holdings;
    }
  }
  return null;
}

/**
 * Retrieve fund holdings with three-layer fallback
 */
export async function mockRetrieveFundHoldings(fundName: string): Promise<FundHoldingsResult> {
  // Layer 1: Check RAG store (fastest, highest confidence)
  const ragHoldings = findInRagStore(fundName);
  if (ragHoldings) {
    await simulateLatency(LATENCY.RAG_STORE);
    return {
      holdings: ragHoldings,
      confidence: 'HIGH',
      source: 'RAG Store (AMFI Factsheet)',
    };
  }

  // Layer 2: Simulate Exa MCP search (medium confidence)
  // In production: call Exa MCP with category: "financial report"
  const isCommonFund = fundName.toLowerCase().includes('hdfc') || 
                       fundName.toLowerCase().includes('sbi') ||
                       fundName.toLowerCase().includes('icici');
  
  if (isCommonFund) {
    await simulateLatency(LATENCY.EXA_SEARCH);
    // Generate reasonable mock holdings for common AMCs
    return {
      holdings: [
        { stock: 'HDFC Bank', weight: 7.5, sector: 'Banking' },
        { stock: 'Reliance Industries', weight: 6.8, sector: 'Energy' },
        { stock: 'Infosys', weight: 5.2, sector: 'IT' },
        { stock: 'TCS', weight: 4.8, sector: 'IT' },
        { stock: 'ICICI Bank', weight: 4.5, sector: 'Banking' },
      ],
      confidence: 'MEDIUM',
      source: 'Exa MCP (Financial Report)',
    };
  }

  // Layer 3: Google Search fallback (low confidence)
  await simulateLatency(LATENCY.GOOGLE_SEARCH);
  return {
    holdings: [
      { stock: 'Diversified Holdings', weight: 15.0, sector: 'Various' },
      { stock: 'Top 10 Holdings', weight: 35.0, sector: 'Various' },
    ],
    confidence: 'LOW',
    source: 'Google Search (Estimated)',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock Expense Ratio Data
// ═══════════════════════════════════════════════════════════════════════════

interface ExpenseRatioResult {
  regularER: number;
  directER: number;
  confidence: ConfidenceLevel;
  source: string;
}

const EXPENSE_RATIOS: Record<string, { regular: number; direct: number }> = {
  'HDFC Top 100': { regular: 1.82, direct: 0.89 },
  'Mirae Asset Large Cap': { regular: 1.62, direct: 0.54 },
  'HDFC Flexi Cap': { regular: 1.58, direct: 0.82 },
  'Parag Parikh Flexi Cap': { regular: 1.36, direct: 0.63 },
  'SBI Small Cap': { regular: 1.78, direct: 0.72 },
  'Axis Midcap': { regular: 1.68, direct: 0.58 },
  'Axis Bluechip': { regular: 1.72, direct: 0.62 },
  'Kotak Emerging Equity': { regular: 1.85, direct: 0.76 },
  'ICICI Pru Bluechip': { regular: 1.76, direct: 0.94 },
  'Nippon India Large Cap': { regular: 1.88, direct: 1.02 },
};

/**
 * Retrieve expense ratios for a fund
 */
export async function mockRetrieveExpenseRatios(fundName: string): Promise<ExpenseRatioResult> {
  // Check known funds first
  for (const [knownFund, ratios] of Object.entries(EXPENSE_RATIOS)) {
    const normalizedKnown = normalizeFundName(knownFund).toLowerCase();
    const normalizedInput = normalizeFundName(fundName).toLowerCase();
    
    if (normalizedInput.includes(normalizedKnown) || normalizedKnown.includes(normalizedInput)) {
      await simulateLatency(LATENCY.RAG_STORE);
      return {
        regularER: ratios.regular,
        directER: ratios.direct,
        confidence: 'HIGH',
        source: 'AMFI Database',
      };
    }
  }

  // Fallback: estimate based on fund type
  await simulateLatency(LATENCY.EXA_SEARCH);
  
  const isLargeCap = fundName.toLowerCase().includes('large') || 
                     fundName.toLowerCase().includes('bluechip');
  const isSmallCap = fundName.toLowerCase().includes('small');
  
  if (isLargeCap) {
    return {
      regularER: 1.75,
      directER: 0.85,
      confidence: 'MEDIUM',
      source: 'Category Average (Estimated)',
    };
  } else if (isSmallCap) {
    return {
      regularER: 1.95,
      directER: 0.95,
      confidence: 'MEDIUM',
      source: 'Category Average (Estimated)',
    };
  }
  
  return {
    regularER: 1.80,
    directER: 0.80,
    confidence: 'LOW',
    source: 'Default Estimate',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Mock Benchmark Data
// ═══════════════════════════════════════════════════════════════════════════

interface BenchmarkResult {
  benchmark: string;
  benchmark1Y: number;
  benchmark3Y: number;
  benchmark5Y: number;
  confidence: ConfidenceLevel;
  source: string;
}

const BENCHMARK_DATA: Record<string, { name: string; y1: number; y3: number; y5: number }> = {
  'Large Cap': { name: 'Nifty 50 TRI', y1: 14.2, y3: 12.8, y5: 13.5 },
  'Mid Cap': { name: 'Nifty Midcap 150 TRI', y1: 22.5, y3: 18.2, y5: 16.8 },
  'Small Cap': { name: 'Nifty Smallcap 250 TRI', y1: 28.4, y3: 20.6, y5: 15.2 },
  'Flexi Cap': { name: 'Nifty 500 TRI', y1: 16.8, y3: 14.2, y5: 14.0 },
  'Multi Cap': { name: 'Nifty 500 TRI', y1: 16.8, y3: 14.2, y5: 14.0 },
  'Index': { name: 'Nifty 50 TRI', y1: 14.2, y3: 12.8, y5: 13.5 },
};

/**
 * Determine fund category from name
 */
export function inferFundCategory(fundName: string): string {
  const name = fundName.toLowerCase();
  
  if (name.includes('small cap') || name.includes('smallcap')) return 'Small Cap';
  if (name.includes('mid cap') || name.includes('midcap')) return 'Mid Cap';
  if (name.includes('large cap') || name.includes('largecap') || 
      name.includes('bluechip') || name.includes('top 100')) return 'Large Cap';
  if (name.includes('flexi cap') || name.includes('flexicap')) return 'Flexi Cap';
  if (name.includes('multi cap') || name.includes('multicap')) return 'Multi Cap';
  if (name.includes('index') || name.includes('nifty')) return 'Index';
  
  return 'Flexi Cap'; // Default
}

/**
 * Retrieve benchmark data for a fund category
 */
export async function mockRetrieveBenchmarkData(fundName: string): Promise<BenchmarkResult> {
  const category = inferFundCategory(fundName);
  const benchmark = BENCHMARK_DATA[category] || BENCHMARK_DATA['Flexi Cap'];
  
  await simulateLatency(LATENCY.RAG_STORE);
  
  return {
    benchmark: benchmark.name,
    benchmark1Y: benchmark.y1,
    benchmark3Y: benchmark.y3,
    benchmark5Y: benchmark.y5,
    confidence: 'HIGH',
    source: 'NSE Index Data',
  };
}

/**
 * Generate mock fund returns (since we don't have real performance data)
 */
export function mockGenerateFundReturns(fundName: string): { y1: number; y3: number; y5: number } {
  const category = inferFundCategory(fundName);
  const benchmark = BENCHMARK_DATA[category] || BENCHMARK_DATA['Flexi Cap'];
  
  // Generate returns with some variance around benchmark
  // Good funds beat benchmark by 1-3%, average funds are +/- 1%, weak funds trail by 2-4%
  const performanceBias = Math.random(); // 0-1
  let alpha: number;
  
  if (performanceBias > 0.7) {
    alpha = 1.5 + Math.random() * 1.5; // Strong performer: +1.5% to +3%
  } else if (performanceBias > 0.3) {
    alpha = -1 + Math.random() * 2; // Average: -1% to +1%
  } else {
    alpha = -4 + Math.random() * 2; // Weak: -4% to -2%
  }
  
  return {
    y1: Math.round((benchmark.y1 + alpha + (Math.random() * 2 - 1)) * 10) / 10,
    y3: Math.round((benchmark.y3 + alpha * 0.8 + (Math.random() * 1.5 - 0.75)) * 10) / 10,
    y5: Math.round((benchmark.y5 + alpha * 0.6 + (Math.random() * 1 - 0.5)) * 10) / 10,
  };
}
