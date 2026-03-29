---
title: Frontend State Fix and FIRE Roadmap Loop Resolution Implementation Plan
date: 2026-03-29
task_complexity: medium
---

# Implementation Plan: Frontend State Fix and FIRE Roadmap Loop Resolution

## 1. Plan Overview
- **Total Phases**: 3
- **Agents Involved**: `coder`
- **Estimated Effort**: Low (React state refactoring)

## 2. Dependency Graph
Phase 1 (Context Creation) -> Phase 2 (Root Wrapping) -> Phase 3 (Component Consumption)

## 3. Execution Strategy Table

| Phase | Objective | Agent | Mode | Risk |
|---|---|---|---|---|
| 1 | Create `AnalysisContext.tsx` | `coder` | Sequential | LOW |
| 2 | Wrap root components in `App.tsx` | `coder` | Sequential | LOW |
| 3 | Refactor tab components to consume context | `coder` | Sequential | MEDIUM |

## 4. Phase Details

### Phase 1: Context Creation
- **Objective**: Create the global `AnalysisContext` that initializes the three SSE pipelines.
- **Agent**: `coder`
- **Files to Create**:
  - `src/contexts/AnalysisContext.tsx`:
    - Define `AnalysisContext` interface containing `firePipeline`, `portfolioPipeline`, and `taxPipeline`.
    - Export `AnalysisProvider` which calls the `useFirePipeline`, `usePortfolioPipeline`, and `useTaxPipeline` hooks and provides them.
    - Export `useAnalysis` custom hook for easy consumption.
- **Dependencies**: None.

### Phase 2: Root Wrapping
- **Objective**: Wrap the dashboard/app with the new provider.
- **Agent**: `coder`
- **Files to Modify**:
  - `src/App.tsx`:
    - Import `AnalysisProvider` from `src/contexts/AnalysisContext`.
    - Wrap the `Dashboard` component with `<AnalysisProvider>`.
- **Dependencies**: `blocked_by`: [1]

### Phase 3: Component Consumption
- **Objective**: Update the three main tabs to use the global context and fix the infinite loop in `FIRERoadmap`.
- **Agent**: `coder`
- **Files to Modify**:
  - `src/components/FIRERoadmap.tsx`:
    - Replace `useFirePipeline()` with `const { firePipeline } = useAnalysis()`.
    - Update `execute`, `events`, `result`, `error`, `isLoading`, `isComplete`, `isError`, `abort` to reference `firePipeline`.
    - Fix the `useEffect` bug: Ensure it only triggers if `!firePipeline.result` and `!firePipeline.isLoading`. Remove `pipeline` from dependencies.
  - `src/components/PortfolioXRay.tsx`:
    - Replace `usePortfolioPipeline()` with `const { portfolioPipeline } = useAnalysis()`.
    - Update properties to reference `portfolioPipeline`.
    - Ensure `useEffect` does not infinitely loop (check `!portfolioPipeline.result`).
  - `src/components/TaxWizard.tsx`:
    - Replace `useTaxPipeline()` with `const { taxPipeline } = useAnalysis()`.
    - Update properties to reference `taxPipeline`.
- **Dependencies**: `blocked_by`: [2]

## 5. File Inventory
| File | Action | Phase |
|---|---|---|
| `src/contexts/AnalysisContext.tsx` | Create | 1 |
| `src/App.tsx` | Modify | 2 |
| `src/components/FIRERoadmap.tsx` | Modify | 3 |
| `src/components/PortfolioXRay.tsx` | Modify | 3 |
| `src/components/TaxWizard.tsx` | Modify | 3 |

## 6. Execution Profile
- Total phases: 3
- Parallelizable phases: 0
- Sequential-only phases: 3

| Phase | Agent | Model | Est. Input | Est. Output | Est. Cost |
|-------|-------|-------|-----------|------------|----------|
| 1 | `coder` | Flash | 500 | 200 | $0.01 |
| 2 | `coder` | Flash | 500 | 50 | $0.01 |
| 3 | `coder` | Flash | 1500 | 200 | $0.02 |
| **Total** | | | **2500** | **450** | **$0.04** |
