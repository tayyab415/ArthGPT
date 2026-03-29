# ArthGPT Architecture Gap Closure - Master Plan

## Objective
Close 5 architecture gaps to make ArthGPT top-1% competitive for ET AI Hackathon 2026 Track 9.

## Gaps (Priority Order)

| # | Gap | Current State | Target |
|---|-----|---------------|--------|
| 1 | What-If / Sensitivity Engine | 10% (overrides exist but no UI/endpoint) | Interactive sliders for FIRE + NPS toggle for Tax |
| 2 | MFapi.in Real Fund Data | 0% (hardcoded mock data) | Live NAV, scheme search, XIRR from real prices |
| 3 | Cross-Pipeline Intelligence | 0% (pipelines isolated) | Tax-aware portfolio badges, auto-populated FIRE inputs |
| 4 | PDF Processing via Gemini Vision | 20% (upload UI exists, backend missing) | Extract CAS/Form16/payslip data via Gemini Vision |
| 5 | Root Orchestrator | 0% (manual pipeline selection) | Intent classification auto-routes to correct pipeline |

## Task Breakdown (12 Tasks)

### Group 1: What-If Builder (Days 1-2) - HIGHEST PRIORITY
- **Task 1:** Add `equityAllocationOverride` to `runMonteCarlo()` in `fire.ts`
- **Task 2:** Create `POST /api/v2/what-if/fire` endpoint in `server.ts`
- **Task 3:** Create `useWhatIf` hook + `WhatIfPanel` component + integrate into `FIRERoadmap`
- **Task 4:** NPS what-if toggle in `TaxWizard` (`computeTax` modification)

### Group 2: MFapi.in Integration (Days 2-3)
- **Task 5:** MFapi.in fund resolver service (search + NAV history)
- **Task 6:** Wire MFapi data into `IngestionAgent` + `OverlapAgent`

### Group 3: Cross-Pipeline Intelligence (Days 3-4)
- **Task 7:** Extend `AnalysisContext` for cross-pipeline data sharing
- **Task 8:** Tax-aware badge in `PortfolioXRay` using TaxWizard data
- **Task 9:** FIRE Planner auto-populate from Portfolio/Tax data

### Group 4: PDF Processing (Days 4-5)
- **Task 10:** Gemini Vision PDF parsing endpoint + service
- **Task 11:** Wire PDF upload UI in Onboarding to backend

### Group 5: Root Orchestrator (Day 5)
- **Task 12:** Root Orchestrator with intent classification

### Days 6-7: Integration testing + polish

## Execution Method
Subagent-Driven Development: fresh subagent per task, two-stage review (spec compliance then code quality).

## Tech Constraints
- Pure TypeScript (no Python dependencies)
- PDF parsing: Gemini Vision only (no casparser)
- MFapi.in: no auth required, no rate limiting
- Existing range slider CSS in `src/index.css` (lines 31-71) ready for use
