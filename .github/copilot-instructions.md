# Copilot instructions for ArthaGPT

## Build, lint, and test commands
- Use Node `22` (`.nvmrc`), then install deps with `npm install`.
- Run the full local app (Express API + Vite middleware) with `npm run dev` and open `http://localhost:3000`.
- Lint/type-check with `npm run lint` (this repo uses `tsc --noEmit` as lint).
- Build production assets with `npm run build`.
- Preview static build with `npm run preview`.
- There is currently no test runner configured (`package.json` has no `test` script, and no `*.test`/`*.spec` files exist), so there is no single-test command yet.

## High-level architecture
- `server.ts` is the backend entry point and API layer:
  - `POST /api/analyze-portfolio` calls Gemini (`@google/genai`) and returns a strict JSON shape used by the UI.
  - `POST /api/fire-plan` and `POST /api/tax-compare` use deterministic engines in `src/server/fireEngine.ts` and `src/server/taxEngine.ts`.
  - In development, Express mounts Vite middleware; in production, it serves `dist/`.
- Frontend is a single React app (`src/App.tsx`) with step-based flow:
  - `Onboarding` (steps 0–4) -> `Loading` (step 5) -> `Dashboard` (step 6).
  - `Dashboard` hosts 3 modules: `PortfolioXRay`, `FIRERoadmap`, `TaxWizard`.
- Current runtime behavior differs from the README “multi-agent” target:
  - Portfolio analysis is currently a single Gemini call in `server.ts`.
  - `conductor/tracks/migrate-to-multi-agent/*` documents the planned migration to orchestrator/sub-agent flow.
- Important data-flow detail: the upload step in `Onboarding` is currently UI-only (file state), and `PortfolioXRay` sends a synthesized fund list from profile data to `/api/analyze-portfolio`.

## Key repository conventions
- Treat tax and FIRE logic as deterministic/guardrailed calculations:
  - Financial inputs are aggressively sanitized/clamped with `Math.max`/`Math.min`.
  - If you change formulas/slabs/limits, keep server engines and client mirrors aligned (`src/server/*.ts` and `src/components/TaxWizard.tsx` / `src/components/FIRERoadmap.tsx`).
- Preserve the Portfolio API contract expected by `PortfolioXRay` (`trueXirr`, `benchmarkReturn`, `expenseRatioDrag`, `overlapData`, `expenseData`, `rebalancingPlan`, etc.).
- Maintain Indian financial formatting conventions:
  - Currency/number display uses `Intl.NumberFormat('en-IN', ...)`.
  - Inputs/labels are INR-centric and domain wording is India-specific (FY 2025-26 slabs, HRA, 80C/80D/80CCD(1B)).
- Keep compliance messaging intact:
  - The full SEBI educational disclaimer in `Dashboard.tsx` is mandatory and should remain visible in analysis experience.
  - Avoid changing copy to imperative investment advice.
- Preserve styling/theme patterns:
  - Tailwind v4 custom theme tokens are defined in `src/index.css` (`navy`, `gold`, `teal`, `coral` palette; `Inter` + `JetBrains Mono`).
  - Reuse existing utility `cn()` from `src/lib/utils.ts` for class composition.
- Env/config conventions:
  - Gemini key is `GEMINI_API_KEY` (used server-side and injected in `vite.config.ts`).
  - Vite HMR can be disabled with `DISABLE_HMR=true`.
