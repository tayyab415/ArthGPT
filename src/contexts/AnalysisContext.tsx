import React, { createContext, useContext, ReactNode } from 'react';
import { useFirePipeline, usePortfolioPipeline, useTaxPipeline } from '../hooks/useSSE';

type AnalysisContextType = {
  firePipeline: ReturnType<typeof useFirePipeline>;
  portfolioPipeline: ReturnType<typeof usePortfolioPipeline>;
  taxPipeline: ReturnType<typeof useTaxPipeline>;
};

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const firePipeline = useFirePipeline();
  const portfolioPipeline = usePortfolioPipeline();
  const taxPipeline = useTaxPipeline();

  return (
    <AnalysisContext.Provider value={{ firePipeline, portfolioPipeline, taxPipeline }}>
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
