import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useFirePipeline, usePortfolioPipeline, useTaxPipeline } from '../hooks/useSSE';

// ═══════════════════════════════════════════════════════════════════════════
// Cross-Pipeline Data Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CrossPipelineData {
  // From Tax pipeline
  taxRegime?: 'old' | 'new';
  taxBracket?: number; // marginal rate (percentage)
  totalDeductions?: number;
  taxableIncome?: number;

  // From Portfolio pipeline
  portfolioXirr?: number;
  totalCorpus?: number;
  fundCount?: number;
  equityAllocation?: number; // not yet available — requires holdings-level data

  // From FIRE pipeline
  fireSuccessProbability?: number;
  requiredSip?: number;
  retirementAge?: number; // not in FIRE result; available via input only
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal shapes for safe casting of untyped pipeline results
// ═══════════════════════════════════════════════════════════════════════════

/** Shape of the tax pipeline_complete data (TaxSessionState snapshot) */
interface TaxResultShape {
  tax_optimization?: {
    winner?: 'old' | 'new';
  };
  old_tax_result?: {
    taxableIncome?: number;
    standardDeduction?: number;
    hraExemption?: number;
    section80C?: number;
    section80CCD1B?: number;
    section80D?: number;
    homeLoanInterest?: number;
  };
  new_tax_result?: {
    taxableIncome?: number;
  };
}

/** Shape of the portfolio pipeline_complete data (PortfolioSessionState snapshot) */
interface PortfolioResultShape {
  portfolio_data?: {
    totalValue?: number;
    funds?: unknown[];
  };
  xirr_results?: {
    portfolioXirr?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Approximate marginal tax bracket (old regime) based on taxable income.
 * Returns the top marginal rate as a percentage (e.g. 30).
 */
function getMarginalTaxBracket(taxableIncome: number): number {
  if (taxableIncome <= 250_000) return 0;
  if (taxableIncome <= 500_000) return 5;
  if (taxableIncome <= 1_000_000) return 20;
  return 30;
}

// ═══════════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════════

type AnalysisContextType = {
  firePipeline: ReturnType<typeof useFirePipeline>;
  portfolioPipeline: ReturnType<typeof usePortfolioPipeline>;
  taxPipeline: ReturnType<typeof useTaxPipeline>;
  getCrossPipelineData: () => CrossPipelineData;
};

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const firePipeline = useFirePipeline();
  const portfolioPipeline = usePortfolioPipeline();
  const taxPipeline = useTaxPipeline();

  // Memoize cross-pipeline data extraction — recomputes only when a pipeline result changes
  const crossPipelineData = useMemo<CrossPipelineData>(() => {
    const data: CrossPipelineData = {};

    // ── Tax pipeline ──────────────────────────────────────────────────
    if (taxPipeline.result) {
      const tax = taxPipeline.result as TaxResultShape;

      data.taxRegime = tax.tax_optimization?.winner;

      // Use the winner's taxable income; fall back to old regime
      const winner = data.taxRegime ?? 'old';
      const regimeResult = winner === 'new' ? tax.new_tax_result : tax.old_tax_result;
      const taxableIncome = regimeResult?.taxableIncome;

      if (taxableIncome !== undefined) {
        data.taxableIncome = taxableIncome;
        data.taxBracket = getMarginalTaxBracket(taxableIncome);
      }

      // Sum deductions from old regime result (old regime has explicit deduction fields)
      const old = tax.old_tax_result;
      if (old) {
        data.totalDeductions =
          (old.standardDeduction ?? 0) +
          (old.hraExemption ?? 0) +
          (old.section80C ?? 0) +
          (old.section80CCD1B ?? 0) +
          (old.section80D ?? 0) +
          (old.homeLoanInterest ?? 0);
      }
    }

    // ── Portfolio pipeline ────────────────────────────────────────────
    if (portfolioPipeline.result) {
      const portfolio = portfolioPipeline.result as PortfolioResultShape;

      data.portfolioXirr = portfolio.xirr_results?.portfolioXirr;
      data.totalCorpus = portfolio.portfolio_data?.totalValue;
      data.fundCount = portfolio.portfolio_data?.funds?.length;
      // equityAllocation: undefined — requires holdings-level category data we don't aggregate yet
    }

    // ── FIRE pipeline ─────────────────────────────────────────────────
    if (firePipeline.result) {
      const fire = firePipeline.result;

      data.fireSuccessProbability =
        fire.fire_summary?.successProbability ??
        fire.monte_carlo_results?.successProbability;

      data.requiredSip =
        fire.sip_plan?.medianSipRequired ??
        fire.fire_summary?.medianSipRequired;

      // retirementAge: not available in result — it's an input param.
      // Consumers needing this should read it from their own input state.
    }

    return data;
  }, [taxPipeline.result, portfolioPipeline.result, firePipeline.result]);

  const getCrossPipelineData = useMemo(
    () => () => crossPipelineData,
    [crossPipelineData],
  );

  return (
    <AnalysisContext.Provider value={{ firePipeline, portfolioPipeline, taxPipeline, getCrossPipelineData }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
