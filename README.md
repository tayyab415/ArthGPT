<div align="center">

<img src="https://img.shields.io/badge/ArthaGPT-India's%20AI%20Money%20Mentor-D4AF37?style=for-the-badge&labelColor=040A18" alt="ArthaGPT" />

# ArthaGPT

**Your money. Finally understood.**

*India's first multi-agent AI financial advisor — free, instant, and built for every Indian.*

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-Multi--Model-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Nano Banana 2](https://img.shields.io/badge/Nano%20Banana%202-Image%20Gen-D4AF37?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/gemini-api/docs/image-generation)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-D4AF37?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

<br/>

> **ET AI Hackathon 2026 — Track 9**

</div>

---

## The Problem

**95% of Indians have no financial plan.**

A qualified human advisor charges ₹25,000+/year and serves only HNIs. India has 14 crore demat account holders — roughly 9 crore have *never* consulted a financial advisor. The result: missed tax deductions, wrong mutual fund choices, no retirement plan, and chronic underinsurance.

## The Solution

ArthaGPT does what a ₹25,000/year human financial advisor does — **for every Indian with a phone, in under 2 minutes, for free.**

Upload your CAMS statement, Form 16, and bank statement → enter your salary structure → tell us your goals → get:
- A personalised retirement roadmap with Monte Carlo probability and required SIP
- An exact FY 2025-26 tax regime comparison with full step-by-step working
- A fund-level mutual fund rebalancing plan with compliance-checked narratives
- **AI-generated visual summary infographics** powered by Nano Banana 2

---

## Demo

\`\`\`
Onboarding (5 steps, ~2 min) → Multi-Agent Pipeline (~30-60 sec) → Dashboard (3 modules + AI Infographics)
\`\`\`

| Module | What you get | Agents involved |
|--------|-------------|-----------------|
| **Portfolio X-Ray** | XIRR per fund, stock overlap heatmap, expense drag, rebalancing plan, AI infographic | Ingestion → XIRR + Overlap + Expense + Benchmark (parallel) → Rebalancing → Compliance Loop |
| **FIRE Roadmap** | Monte Carlo fan chart, required SIP with glidepath, insurance gap, macro snapshot, AI infographic | GoalProfiler + Macro (parallel) → MonteCarlo + SIP + Insurance (parallel) → Adjusted MC → Roadmap → Compliance Loop |
| **Tax Wizard** | Old vs New regime comparison, HRA working, missed deductions, visual chart, AI infographic | InputCollector → Old + New (parallel) → TaxOptimizer → Compliance Loop |

---

## Multi-Agent Architecture

ArthaGPT uses a custom multi-agent framework with **3 independent pipelines**, each orchestrated via nested agent graphs:

\`\`\`
┌──────────────────────────────────────────────────────────────────────────────┐
│                     ArthaGPT Multi-Agent Orchestrator                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent Framework (src/server/agents/core/)                                   │
│  ┌──────────────┬───────────────────┬──────────────┬────────────────┐       │
│  │ Agent (base) │ DeterministicAgent│ LlmAgent     │ LoopAgent      │       │
│  │              │ (no LLM calls)    │ (Gemini API) │ (compliance    │       │
│  │              │                   │              │  exit-check)   │       │
│  ├──────────────┼───────────────────┴──────────────┴────────────────┤       │
│  │ ParallelAgent│ Promise.allSettled — fan-out concurrent agents     │       │
│  │ SequentialAgent│ Run agents one-by-one in order                   │       │
│  └──────────────┴───────────────────────────────────────────────────┘       │
│                                                                              │
├────────────────────┬────────────────────┬────────────────────────────────────┤
│ Portfolio Pipeline │ FIRE Pipeline      │ Tax Pipeline                       │
│ (7 agents, 4 stgs) │ (9 agents, 5 stgs) │ (6 agents, 4 stages)              │
│                    │                    │                                    │
│ Stage 1: Ingestion │ Stage 1: Parallel  │ Stage 1: InputCollector            │
│                    │  GoalProfiler      │                                    │
│ Stage 2: Parallel  │  + MacroAgent      │ Stage 2: Parallel                  │
│  XIRR + Overlap   │  (Gemini Search)   │  OldRegime + NewRegime             │
│  + Expense         │                    │                                    │
│  + Benchmark       │ Stage 2: Parallel  │ Stage 3: TaxOptimizer             │
│                    │  MonteCarlo + SIP  │  (Gemini Pro)                      │
│ Stage 3: Rebalance │  + Insurance       │                                    │
│  (Gemini Pro)      │                    │ Stage 4: ComplianceLoop            │
│                    │ Stage 2b: Adjusted │  (LoopAgent: max 2 iter)           │
│ Stage 4: Compliance│  MonteCarlo        │  ComplianceChecker                 │
│  Loop (max 2 iter) │                    │  + DisclaimerInjector              │
│                    │ Stage 3: Roadmap   │                                    │
│                    │  (Gemini Pro)      │                                    │
│                    │                    │                                    │
│                    │ Stage 4: Compliance│                                    │
│                    │  Loop (max 2 iter) │                                    │
└────────────────────┴────────────────────┴────────────────────────────────────┘

SSE Streaming (Server-Sent Events)
──────────────────────────────────
Each pipeline streams agent_start, agent_complete, pipeline_complete
events in real-time to the frontend via /api/v2/*-pipeline endpoints.
The useSSE hook consumes these and renders live progress in Loading components.
\`\`\`

### Agent Types

| Type | Description | Example |
|------|-------------|---------|
| **DeterministicAgent** | Pure computation — no LLM calls, predictable output | MonteCarloEngine, XirrEngine, OldRegimeCalc |
| **LlmAgent** | Calls Gemini API for analysis/generation | MacroAgent, RoadmapBuilder, TaxOptimizer |
| **ParallelAgent** | Fan-out: runs child agents concurrently | Stage2_ParallelCompute (MC + SIP + Insurance) |
| **SequentialAgent** | Runs child agents in order | Each pipeline's top-level orchestrator |
| **LoopAgent** | Iterates until exit condition is met | ComplianceLoop (check → fix → re-check) |

### Model Strategy

| Model | Role | Used by |
|-------|------|---------|
| **Gemini 3.1 Pro Preview** | Master reasoning — portfolio rebalancing, roadmap narratives | RebalancingStrategist, RoadmapBuilder |
| **Gemini 2.5 Pro** | Fallback reasoning | Compliance rewriting |
| **Gemini 2.5 Flash** | Fast tasks — macro search, compliance checking, input parsing | MacroAgent, ComplianceChecker, InputCollector |
| **Nano Banana 2** (\`gemini-3.1-flash-image-preview\`) | AI image generation — financial infographic cards | InfographicCard (FIRE, Portfolio, Tax summaries) |
| **Deterministic Engine** | Tax slabs, Monte Carlo, XIRR, SIP solver — never LLM-estimated | All \`*Engine\` agents |

---

## Features

### 📊 MF Portfolio X-Ray
- Multi-fund ingestion with Gemini-powered contextual analysis
- True XIRR per fund (Newton-Raphson approximation)
- Stock overlap heatmap across all holdings with confidence scores
- Expense ratio drag: regular vs direct plan bar chart comparison
- Actionable rebalancing plan with compliance-checked AI narrative
- **Nano Banana 2 visual summary**: one-click AI-generated infographic of portfolio metrics
- Live agent execution trace with latency tracking

### 🔥 FIRE Path Planner
- **Monte Carlo fan chart** — 1,000 simulations with P10/P50/P90 corpus bands
- **Asset glidepath chart** — equity/debt allocation shifts to retirement
- Live macro parameters via Gemini Flash + Google Search grounding (fallback to hardcoded)
- Binary-search SIP solver with annual 10% step-up
- Adjusted Monte Carlo: re-simulates with the *required SIP* when current SIP yields 0%
- Insurance gap detection: 12x income rule vs declared cover
- Scenario comparisons (higher SIP, delayed retirement, reduced draw)
- **Nano Banana 2 visual summary**: AI-generated FIRE roadmap infographic with key metrics
- Compliance loop: auto-rewrites any non-probabilistic language

### 🧾 Tax Wizard — FY 2025-26
- **Deterministic engine** — never estimated by an LLM
- **Visual bar chart** comparing Old vs New regime tax liability
- Complete step-by-step working shown for both regimes
- HRA exemption: three-way minimum calculation with all values visible
- Slab-by-slab tax breakdown (expandable accordion)
- Missed deduction panel with exact rupee savings at your marginal rate
- Ranked instrument recommendations (ELSS, PPF, NPS) with savings calculation
- Fully editable salary inputs — adjust any figure and results update instantly
- **Nano Banana 2 visual summary**: AI-generated tax comparison infographic
- Optional AI analysis: runs full TaxPipeline for narrative insights

### 🎨 Nano Banana 2 — AI Infographics
ArthaGPT integrates Google's **Nano Banana 2** (\`gemini-3.1-flash-image-preview\`) image generation model for on-demand visual summaries:

| Feature | Details |
|---------|---------|
| **Model** | \`gemini-3.1-flash-image-preview\` (Nano Banana 2) |
| **Resolution** | 1K (1024px), 3:2 aspect ratio |
| **Types** | FIRE roadmap summary, Portfolio X-Ray summary, Tax comparison summary |
| **Theme** | Matches app design — dark navy background with gold accents |
| **Data** | Uses real calculated metrics from your analysis, not generic templates |
| **Actions** | Generate, download as PNG, regenerate, expand/collapse |

Each module has a "Generate Visual Summary" button that sends your real financial data to Nano Banana 2 and renders a custom infographic card with download capability.

### 📁 Multi-Document Upload
- Upload multiple documents per session (CAMS, Form 16, bank statement, demat, insurance)
- Auto-detect document type from filename with manual override
- Built-in document guide explaining exactly which file each module needs
- Drag-and-drop with multi-file support, password field for encrypted PDFs

---

## Compliance & Guardrails

| Layer | What it does |
|-------|-------------|
| **Input validation** | Age 18-80, income >= ₹1L, no negative corpus values — with field-level error messages |
| **Calculation guardrails** | \`Math.max(0, ...)\` on all financial inputs; NaN-proof throughout |
| **Compliance Loop** | \`LoopAgent\` runs ComplianceChecker + DisclaimerInjector up to 2 iterations until zero violations |
| **ComplianceChecker** | Gemini Flash scans narrative for: unlicensed advice, certainty claims, missing disclaimers |
| **DisclaimerInjector** | Rewrites violating narrative into probabilistic, educational language |
| **SEBI Disclaimer** | Full mandatory disclaimer on every analysis screen |
| **Execution Trace** | Every agent call, model, latency visible in the UI via AgentExecutionLog |

---

## API Endpoints

### V2 — Multi-Agent Pipelines (SSE Streaming)

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`POST /api/v2/portfolio-pipeline\` | POST | Run 7-agent portfolio analysis with SSE events |
| \`POST /api/v2/fire-pipeline\` | POST | Run 9-agent FIRE roadmap with Monte Carlo + compliance |
| \`POST /api/v2/tax-pipeline\` | POST | Run 6-agent tax comparison with AI optimization |
| \`GET /api/v2/*/status\` | GET | Health check for each pipeline |

### V2 — Nano Banana 2 Image Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`POST /api/v2/generate-infographic\` | POST | Generate AI infographic (body: \`{ type: 'fire'\|'portfolio'\|'tax', data }\`) |
| \`GET /api/v2/generate-infographic/status\` | GET | Health check — returns model name, alias, capabilities |

### V1 — Legacy Direct Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`POST /api/analyze-portfolio\` | POST | Direct Gemini call for portfolio (fallback-capable) |
| \`POST /api/fire-plan\` | POST | Deterministic FIRE engine |
| \`POST /api/tax-compare\` | POST | Deterministic tax engine |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5, Tailwind CSS v4, Framer Motion, Recharts |
| **Backend** | Node.js 22, Express, Vite 6 (dev middleware), SSE streaming |
| **AI — Reasoning** | \`@google/genai\` SDK — Gemini 3.1 Pro Preview, Gemini 2.5 Flash + Google Search |
| **AI — Image Gen** | Nano Banana 2 (\`gemini-3.1-flash-image-preview\`) — financial infographic generation |
| **Agent Framework** | Custom Agent/ParallelAgent/SequentialAgent/LoopAgent orchestration |
| **State Management** | SessionState<T> with typed state + event emission per pipeline |
| **Design** | Navy \`#040A18\` + Gold \`#D4AF37\` palette, JetBrains Mono for financial figures |
| **Build** | \`tsc --noEmit\` -> 0 errors, \`vite build\` |

---

## Getting Started

**Prerequisites:** Node.js 22+ (Tailwind CSS v4 requires Node 20+), a Gemini API key

\`\`\`bash
# 1. Clone
git clone https://github.com/coldboxer007/ArthGPT.git
cd ArthGPT

# 2. Use correct Node version (if you have nvm)
nvm use   # reads .nvmrc -> Node 22

# 3. Install dependencies
npm install

# 4. Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 5. Start the dev server
#    Uses Node's built-in --env-file flag (Node 22+) — no dotenv shell export needed
npm run dev

# -> http://localhost:3000
\`\`\`

> `npm run dev` resolves to `node --env-file=.env.local --import tsx server.ts`.
> The `--env-file` flag loads `.env.local` natively into `process.env` before any module
> is imported, so `GEMINI_API_KEY` is always available to all agent pipelines.

> The app works without a Gemini API key — Portfolio X-Ray uses mock data, Tax Wizard is fully client-side, and FIRE engines run deterministic Monte Carlo. AI narratives, live macro search, and Nano Banana 2 infographics require the key.

---

## Project Structure

\`\`\`
ArthGPT/
├── server.ts                          # Express + Vite dev + V1/V2/Infographic endpoints
├── src/
│   ├── App.tsx                        # Root — UserProfile state, step routing
│   ├── main.tsx                       # Vite entry
│   ├── index.css                      # Tailwind v4 theme (navy/gold/teal/coral)
│   │
│   ├── components/
│   │   ├── Onboarding.tsx             # 5-step onboarding, multi-doc upload
│   │   ├── Loading.tsx                # Real SSE agent events + fallback animation
│   │   ├── Dashboard.tsx              # Sidebar + tab layout + SEBI disclaimer
│   │   ├── PortfolioXRay.tsx          # MF analysis + expense charts + infographic
│   │   ├── FIRERoadmap.tsx            # Monte Carlo fan chart + glidepath + infographic
│   │   ├── TaxWizard.tsx              # Tax engine + visual comparison + infographic
│   │   ├── ErrorBoundary.tsx          # Class-based error boundary — catches render crashes per tab
│   │   ├── InfographicCard.tsx        # Reusable Nano Banana 2 image display component
│   │   ├── AgentExecutionLog.tsx      # Real-time agent trace display
│   │   └── ConfidenceBadge.tsx        # HIGH/MEDIUM/LOW confidence UI
│   │
│   ├── hooks/
│   │   ├── useSSE.ts                  # SSE consumer: useTaxPipeline, usePortfolioPipeline, useFirePipeline
│   │   └── useInfographic.ts          # Nano Banana 2 image generation hook
│   │
│   ├── contexts/
│   │   └── AnalysisContext.tsx         # React context wrapping pipeline hooks
│   │
│   ├── lib/
│   │   └── utils.ts                   # cn() class utility
│   │
│   └── server/
│       ├── taxEngine.ts               # FY 2025-26 slab engine (deterministic)
│       ├── fireEngine.ts              # FIRE corpus + SIP calculator
│       │
│       └── agents/
│           ├── core/
│           │   ├── Agent.ts           # Base Agent, DeterministicAgent, LlmAgent
│           │   ├── SessionState.ts    # Typed state container + event emission
│           │   ├── ParallelAgent.ts   # Promise.allSettled fan-out
│           │   ├── SequentialAgent.ts # Sequential runner
│           │   └── LoopAgent.ts       # Loop with exit condition (compliance)
│           │
│           ├── portfolio/
│           │   ├── PortfolioPipeline.ts
│           │   ├── IngestionAgent.ts, XirrAgent.ts, OverlapAgent.ts
│           │   ├── ExpenseAgent.ts, BenchmarkAgent.ts
│           │   ├── RebalancingStrategistAgent.ts
│           │   └── mockFundData.ts
│           │
│           ├── fire/
│           │   ├── FirePipeline.ts
│           │   ├── GoalProfilerAgent.ts, MacroAgent.ts
│           │   ├── MonteCarloAgent.ts, AdjustedMonteCarloAgent.ts
│           │   ├── SipGlidepathAgent.ts, InsuranceGapAgent.ts
│           │   └── RoadmapBuilderAgent.ts
│           │
│           ├── tax/
│           │   ├── TaxPipeline.ts
│           │   ├── InputCollectorAgent.ts
│           │   ├── OldRegimeAgent.ts, NewRegimeAgent.ts
│           │   ├── TaxOptimizerAgent.ts
│           │   ├── ComplianceCheckerAgent.ts
│           │   └── DisclaimerInjectorAgent.ts
│           │
│           ├── utils/
│           │   ├── fire.ts            # Monte Carlo engine (1000 sims, Mulberry32 PRNG)
│           │   ├── fireGemini.ts      # Live macro via Google Search + roadmap generation
│           │   ├── gemini.ts          # Shared Gemini utilities
│           │   ├── imageGen.ts        # Nano Banana 2 infographic generators (FIRE/Portfolio/Tax)
│           │   └── portfolioGemini.ts # Portfolio-specific Gemini calls
│           │
│           └── index.ts               # Re-exports all agents
│
├── .nvmrc                             # Node 22
├── .env.local                         # GEMINI_API_KEY (not in git)
└── package.json
\`\`\`

---

## Nano Banana 2 — How It Works

ArthaGPT uses Google's **Nano Banana 2** (\`gemini-3.1-flash-image-preview\`) to generate on-demand financial infographic cards from your real analysis data.

### Architecture

\`\`\`
User clicks "Generate Visual Summary"
      │
      ▼
useInfographic hook → POST /api/v2/generate-infographic
      │
      ▼
imageGen.ts → Constructs data-rich prompt with actual financial metrics
      │
      ▼
Gemini API (gemini-3.1-flash-image-preview)
  config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2', imageSize: '1K' } }
      │
      ▼
Returns base64 PNG → InfographicCard renders inline with download option
\`\`\`

### Infographic Types

| Type | Data Used | Key Metrics Shown |
|------|-----------|-------------------|
| **FIRE Roadmap** | Age, retire age, income, success probability, P50 corpus, required SIP, insurance gap | Success %, corpus target, SIP requirement, insurance status |
| **Portfolio X-Ray** | XIRR, benchmark return, expense drag, overlap count, total value, fund count | XIRR vs benchmark, annual drag, portfolio value |
| **Tax Comparison** | Old/New regime tax, savings, winner, gross salary, missed deductions | Side-by-side comparison, savings amount, regime recommendation |

### Design Language
- All infographics follow the app's dark navy (\`#040A18\`) + gold (\`#D4AF37\`) theme
- Clean sans-serif typography, professional financial dashboard aesthetic
- Every infographic includes "Not financial advice" compliance text
- Generated in <5 seconds using Nano Banana 2's speed-optimised architecture

---

## Impact

| Metric | Estimate | Basis |
|--------|----------|-------|
| Addressable users | 4 crore | Literate smartphone users in ET's user base |
| Advisory cost displaced | ₹60,000 Cr/yr | 4Cr users x ₹15K/yr RIA fee |
| ET revenue potential | ₹800 Cr/yr | 2Cr MAU x ₹400/user (ads + affiliate) |
| Aggregate tax savings enabled | ₹9,000 Cr | 50L users x ₹30K avg missed deductions |
| Infrastructure cost | < $70 total | Well within $5,000 GCP credits |

---

## Changelog

### v1.1.0 — March 2026 (post-hackathon stability fixes)

#### 🐛 Bug Fixes

**Blank screen after pipeline completes (critical)**
- **Root cause:** React Rules of Hooks violation in `PortfolioXRay` and `FIRERoadmap`.
  Both components had `useCallback(handleGenerateInfographic)` declared *after* early
  `return` statements (`isLoading`, `isError`, `!isComplete`). On the first render React
  counted N hooks; after the pipeline completed it counted N+1 hooks — crashing with
  *"Rendered more hooks than during the previous render"*.
- **Fix:** Moved all data extraction (`const data = ...`) and `useCallback` declarations
  **above** every early return. Both are now null-safe via optional chaining (`?.`) and
  `?? {}` defaults so they run unconditionally on every render.

**SSE buffer not flushing on stream close**
- `useSSE.ts` `consumeStream()` was not processing the remaining buffer when the readable
  stream ended, causing the last `pipeline_complete` event to be dropped.
- **Fix:** Added explicit buffer flush on stream close and `.replace(/\r$/, '')` CRLF
  stripping so SSE lines parse correctly on all platforms.

**API key not available to agent pipelines**
- `server.ts` imports `'dotenv/config'` but the shell `export $(cat .env.local | xargs)`
  workaround was fragile and failed in VS Code integrated terminals.
- **Fix:** `npm run dev` now runs `node --env-file=.env.local --import tsx server.ts`.
  Node 22's native `--env-file` flag loads `.env.local` before any module executes, making
  `GEMINI_API_KEY` reliably available to all agent pipelines.

**Stale Vite transform cache**
- A stale `node_modules/.vite` cache was serving old JS bundles, masking fixes.
- **Fix:** Cache cleared (`rm -rf node_modules/.vite`); Vite now rebuilds fresh on startup.

#### ✨ New

**ErrorBoundary component** (`src/components/ErrorBoundary.tsx`)
- Class-based React error boundary that catches synchronous render errors.
- Displays the error message, first 6 lines of stack trace, and a "Try Again" button
  that resets the boundary without a full page reload.
- Wired at two levels: `App.tsx` wraps the entire `Dashboard`, and `Dashboard.tsx` wraps
  each tab (`Portfolio X-Ray`, `FIRE Roadmap`, `Tax Wizard`) individually so a crash in
  one tab never blanks the others.
- Uses `(this as unknown as { state: State })` cast pattern to work with
  `"useDefineForClassFields": false` in `tsconfig.json`.

**Global JS error overlay** (`index.html`)
- `window.addEventListener('error', ...)` + `window.addEventListener('unhandledrejection', ...)`
  overlay renders unhandled JS errors visibly in the browser during development, replacing
  the silent blank-screen failure mode.

---

## License

MIT — Built for **ET AI Hackathon 2026, Track 9**
