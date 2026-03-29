---
title: Frontend State Fix and FIRE Roadmap Loop Resolution
date: 2026-03-29
design_depth: deep
task_complexity: medium
---

# Design Document: Frontend State Fix and FIRE Roadmap Loop Resolution

## 1. Problem Statement

The ArthaGPT application currently suffers from two critical frontend issues impacting the user experience:
1. The `FIRERoadmap` component is stuck in an infinite loading loop. This is caused by a React `useEffect` dependency bug where the `useFirePipeline` hook continuously recreates its return object, triggering repeated analysis executions. — *[Rationale: We must fix the infinite execution cycle to stop unnecessary API calls and unblock the feature]*
2. The analysis state for all pipeline tabs (Portfolio X-Ray, FIRE Roadmap, Tax Wizard) is lost when a user switches between tabs. This occurs because the components unmount and destroy their local state initialized by the `useSSE` hooks. — *[Rationale: Users need to reference calculations across different tabs without waiting for 8-second re-runs]*

## 2. Requirements

### Functional Requirements
- **REQ-1:** Analysis state (events, results, loading status) must persist across tab changes during an active user session.
- **REQ-2:** The `FIRERoadmap` component must execute the analysis automatically on the user's first visit to the tab, but only once per session or until explicitly refreshed.

### Non-Functional Requirements
- **REQ-3:** The state management solution should rely on built-in React features (e.g., Context API) rather than introducing a third-party global state library like Zustand or Redux.

### Constraints
- **REQ-4:** The solution must be fully compatible with the existing `useSSE.ts` streaming functionality.

## 3. Approach

### Selected Approach: Global Analysis Context Provider
We will create a new context (`AnalysisContext.tsx`) that instantiates all three SSE pipeline hooks (`usePortfolioPipeline`, `useFirePipeline`, `useTaxPipeline`) and exposes their returned state and execution functions. We will wrap the root `App.tsx` or `Dashboard.tsx` with this provider. Components will consume the state via `useContext(AnalysisContext)`. The `useEffect` inside `FIRERoadmap` will be refactored to trigger analysis solely based on the stability of the `execute` function and the absence of a cached `result`.
— *[Rationale: State lives high enough to outlive component unmounting, allowing components to easily consume it without re-fetching data]*
Traces To: REQ-1, REQ-2, REQ-3, REQ-4

### Alternatives Considered
- **Parent State Lifting (Props):** Moving the hooks into `Dashboard.tsx` and passing them down as props. *(Rejected because it introduces prop drilling and deep memoization complexities)*

### Decision Matrix

| Criterion | Weight | Context Provider | Prop Drilling |
|-----------|--------|------------------|---------------|
| State Persistence | 40% | 5: Global, robust | 5: Local to dashboard |
| Infinite Loop Fix | 40% | 5: Clean separation | 3: Complex memoization |
| Scalability | 20% | 5: Easy access | 2: Hard to scale |
| **Weighted Total**| | **5.0** | **3.8** |

## 4. Architecture

- **Context Provider:** Create `src/contexts/AnalysisContext.tsx` which will export an `AnalysisProvider` component and a `useAnalysis` hook. Inside the provider, we will instantiate the existing `useFirePipeline`, `usePortfolioPipeline`, and `useTaxPipeline` hooks.
- **Root Wrapping:** In `src/App.tsx`, we will wrap the `Dashboard` component with `AnalysisProvider` so all child tabs have access to the cached pipeline state and execution functions.
- **Component Consumption:** `FIRERoadmap.tsx`, `PortfolioXRay.tsx`, and `TaxWizard.tsx` will consume the pipeline objects using `const { firePipeline } = useAnalysis()`. The `useEffect` inside `FIRERoadmap` will check if `firePipeline.result` is null before calling `firePipeline.execute()`.

## 5. Risk Assessment

- **Risk:** Storing SSE event logs and massive analysis results for multiple pipelines in Context could cause stale data or memory bloat over a long user session.
- **Mitigation:** Provide an explicit reset mechanism, or allow users to trigger "Retry Analysis" which internally clears the state.
- **Risk:** Context updates triggering unnecessary re-renders in unmounted components or across the whole `Dashboard`.
- **Mitigation:** Since `Dashboard` only mounts the active tab at any given time, only the visible component consumes the updating context, minimizing performance impact. — *[Rationale: The impact of context re-renders is negligible due to the tab-based routing model.]*
