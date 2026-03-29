import { useState, useCallback, useRef, useEffect } from 'react';

import type { MonteCarloResults, FireMacroParameters } from './useSSE';

/** Server-side FIRE input shape (different property names from client FireInput). */
export interface FireInputsServer {
  currentAge: number;
  retirementAge: number;
  yearsToRetirement: number;
  lifeExpectancyAge: number;
  currentMonthlySip: number;
  existingMfCorpus: number;
  existingPpfCorpus: number;
  targetMonthlyDrawToday: number;
}

export interface WhatIfOverrides {
  monthlySipOverride?: number;
  retirementAgeOverride?: number;
  targetMonthlyDrawOverride?: number;
  equityAllocationOverride?: number;
}

interface WhatIfState {
  overrides: WhatIfOverrides;
  result: MonteCarloResults | null;
  isLoading: boolean;
  error: string | null;
}

export function useWhatIf(
  fireInputs: FireInputsServer | null,
  macroParameters: FireMacroParameters | null,
  baselineSuccessProbability: number
) {
  const [state, setState] = useState<WhatIfState>({
    overrides: {},
    result: null,
    isLoading: false,
    error: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Keep a ref to the latest overrides so the debounced fetch always uses current values
  const overridesRef = useRef<WhatIfOverrides>(state.overrides);

  const fetchWhatIf = useCallback(
    async (overrides: WhatIfOverrides) => {
      if (!fireInputs || !macroParameters) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/v2/what-if/fire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fireInputs,
            macroParameters,
            ...overrides,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as MonteCarloResults;
        setState((prev) => ({ ...prev, result: data, isLoading: false }));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
      }
    },
    [fireInputs, macroParameters]
  );

  const setOverride = useCallback(
    (key: keyof WhatIfOverrides, value: number | undefined) => {
      const nextOverrides = { ...overridesRef.current, [key]: value };
      overridesRef.current = nextOverrides;

      setState((prev) => ({
        ...prev,
        overrides: nextOverrides,
      }));

      // Debounce the fetch by 300ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchWhatIf(nextOverrides);
      }, 300);
    },
    [fetchWhatIf]
  );

  const resetOverrides = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    overridesRef.current = {};
    setState({
      overrides: {},
      result: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return {
    overrides: state.overrides,
    setOverride,
    result: state.result,
    isLoading: state.isLoading,
    error: state.error,
    baselineSuccessProbability,
    resetOverrides,
  };
}
