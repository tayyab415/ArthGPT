# AI Money Mentor — Architecture, Strategy & Differentiation Blueprint

## Track 9 | ET AI Hackathon 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Multi-Agent Orchestration — Stage-by-Stage Breakdown](#2-multi-agent-orchestration)
3. [Knowledge Layer — Gemini Embeddings, Document Processing & Exa MCP](#3-knowledge-layer)
4. [Critique Resolution — How We Fix the Three Bottlenecks](#4-critique-resolution)
5. [Differentiating Features — What Sets Us Apart](#5-differentiating-features)
6. [Rubric Alignment — How Every Decision Maps to Scoring](#6-rubric-alignment)

---

## 1. System Overview

### Core Philosophy

This is NOT a chatbot with a financial calculator behind it. This is a multi-agent system where specialised agents collaborate through Google ADK's workflow primitives — SequentialAgent, ParallelAgent, LoopAgent, and CustomAgent — to complete complex financial planning workflows autonomously.

### The Three Pipelines

The system is built around three SequentialAgent pipelines, each handling a distinct financial domain:

| Pipeline | Purpose | Scenario Pack Coverage |
|----------|---------|----------------------|
| **Portfolio X-Ray** | Parse CAMS/KFintech statements → full portfolio analysis → tax-aware rebalancing | MF overlap & rebalancing scenario |
| **Tax Wizard** | Salary structure extraction → dual-regime comparison → missed deduction discovery | Tax regime edge case scenario |
| **FIRE Planner** | Goal profiling → Monte Carlo probabilistic forecasting → AI-interpreted roadmap with fan chart | Mid-career FIRE plan scenario |

### Model Routing Strategy (Cost Efficiency)

| Model | Role | Why |
|-------|------|-----|
| Gemini 3 Flash | Parsing, extraction, formatting, narration | Cheap, fast, good enough for structured tasks |
| Gemini 3.1 Pro | Reasoning, strategy synthesis, probabilistic interpretation | Only where deep reasoning justifies cost |
| Gemini Embedding 2 | Fund factsheet RAG index | Multimodal PDF embedding for holdings lookup |
| BuiltInCodeExecutor | XIRR, tax slabs, Monte Carlo simulations | Deterministic math and stochastic simulations — never let an LLM do arithmetic |

### AI vs Deterministic: Where Each Belongs

A critical architectural principle: **AI interprets, math computes.** Not everything should be AI-driven, and not everything should be a static calculator. The system uses a deliberate split:

| Module | Approach | Why |
|--------|----------|-----|
| Tax Wizard | 100% deterministic (CodeExecutor) | Tax is law. Slabs are published in the Finance Act. Any probabilistic "prediction" of a tax slab is a compliance failure. |
| Portfolio X-Ray (XIRR/Overlap) | 100% deterministic (CodeExecutor + RAG) | XIRR is a mathematical fact about past cashflows. Overlap is a factual percentage from published holdings. No prediction needed. |
| FIRE Planner (Corpus/SIP) | Probabilistic (Monte Carlo via CodeExecutor) + AI interpretation (Gemini Pro) | Future market returns are uncertain. A single-path "you'll have ₹9.27 crore" projection is useless — the Monte Carlo engine runs 1,000 simulations to produce a probability distribution, and Gemini Pro interprets what that distribution means for the user's life decisions. |
| Rebalancing Strategist | AI reasoning (Gemini Pro) over deterministic inputs | The four Stage 2 analyses produce hard numbers. The Strategist's job is synthesis and judgment — which combination of moves optimises across all dimensions. This is where AI reasoning shines. |
| Real-Time Macro Parameters | AI-driven search (Flash + Exa/Search) | Current inflation, Nifty returns, bond yields change daily. The AI agent fetches live data to feed into Monte Carlo, replacing stale hardcoded assumptions. |

---

## 2. Multi-Agent Orchestration

### Layer 0: Root Orchestrator

**Agent:** Orchestrator (LlmAgent, Gemini 3.1 Pro)

**What it does:**
- Receives user input (text message, uploaded PDF, or both)
- Classifies intent: Is this a portfolio analysis? Tax question? Retirement planning? A combination?
- Writes `user_profile` to session state (risk tolerance, investment horizon, extracted from conversation)
- Transfers control to the appropriate pipeline via ADK's sub_agent transfer mechanism

**Critical behaviour for combined queries:** When a user uploads a CAMS statement AND asks "what are the tax implications of rebalancing?", the Orchestrator wraps the Portfolio Pipeline and Tax Pipeline inside a ParallelAgent, runs both concurrently, then passes combined results to the Narrative Output agent. This is the hybrid sequential+parallel pattern that demonstrates architectural sophistication.

**Session state written:** `user_profile`, `intent_classification`

---

### Pipeline A: Portfolio X-Ray

**Pipeline type:** SequentialAgent (5 stages, with nested ParallelAgent at Stage 2 and LoopAgent at Stage 4)

#### Stage 1 — Ingestion

**Execution:** Sequential (single agent)
**Agent:** Ingestion Agent (LlmAgent, Gemini 3 Flash)

**What it does:**
- Receives the CAMS/KFintech PDF uploaded by user
- Uses Gemini's native PDF document processing (native vision) — NO external PDF parsing library
- The model visually reads the table layout of the CAMS statement: fund names, folio numbers, transaction dates, NAVs, units, transaction types (SIP/Lumpsum/Redemption/SWP/STP)
- Handles edge cases: multiple AMC formats, STP entries creating circular transactions, partial CAMS statements, different folio structures
- Outputs clean structured JSON of the full portfolio

**Session state written:** `portfolio_data` (structured JSON of all holdings and transactions)
**Session state read:** None (first stage)

#### Stage 2 — Parallel Analysis (Fan-Out)

**Execution:** ParallelAgent (4 agents running concurrently)
**Why parallel:** These four analyses are completely independent — XIRR calculation doesn't need overlap data, expense comparison doesn't need benchmark data. Running them concurrently cuts total latency by ~75%.

**Agent 2A — XIRR Engine (LlmAgent, Gemini 3 Flash + BuiltInCodeExecutor)**

What it does:
- Reads `portfolio_data` from session state
- Constructs the cashflow series for each fund: purchase dates + amounts, redemption dates + amounts, current value as final cashflow
- Writes Python code implementing Newton-Raphson XIRR algorithm
- Executes code in Gemini's sandboxed Python environment
- Calculates per-fund XIRR and overall portfolio XIRR
- Shows the complete cashflow series and calculation steps (traceable logic — judges penalise black-box numbers)

Session state written: `xirr_results`

**Agent 2B — Overlap Agent (LlmAgent, Gemini 3 Flash)**

What it does:
- Reads `portfolio_data` to identify which funds the user holds
- Queries the fund holdings RAG store (Gemini Embedding 2 vector DB) as primary source
- Falls back to Exa MCP with `category: "financial report"` if fund not in RAG store
- Falls back to Google Search as last resort, flagging confidence as LOW
- Cross-references holdings across all funds to calculate stock-level overlap percentages
- Produces an overlap matrix: Fund A vs Fund B vs Fund C, with exact percentage weights for overlapping stocks
- Tags data confidence level for each fund's holdings source

Session state written: `overlap_data`

**Agent 2C — Expense Agent (LlmAgent, Gemini 3 Flash)**

What it does:
- Reads `portfolio_data` to identify fund names and plan types (Regular vs Direct)
- Searches for current expense ratios for each fund (regular plan) and its direct plan equivalent
- Calculates annual expense ratio drag in rupees: (regular_ER - direct_ER) × current_portfolio_value
- Identifies specific funds where switching to direct plan yields the highest savings

Session state written: `expense_analysis`

**Agent 2D — Benchmark Agent (LlmAgent, Gemini 3 Flash)**

What it does:
- Reads `portfolio_data` to identify fund categories (large-cap, mid-cap, flexi-cap, etc.)
- Looks up category benchmark returns (Nifty 50 for large-cap, Nifty Midcap 150 for mid-cap, etc.)
- Compares each fund's trailing 1Y, 3Y, 5Y returns against its category benchmark
- Flags underperformers: funds consistently trailing their benchmark by >2% over 3 years

Session state written: `benchmark_comparison`

#### Stage 3 — Rebalancing Strategist (Gather + Synthesise)

**Execution:** Sequential (single agent, heavy reasoning)
**Agent:** Rebalancing Strategist (LlmAgent, Gemini 3.1 Pro)

**What it does:**
- Reads ALL four output keys from Stage 2: `xirr_results`, `overlap_data`, `expense_analysis`, `benchmark_comparison`
- Also reads `tax_result` from Tax Pipeline (if it ran concurrently) for STCG/LTCG awareness
- Also reads `user_profile` for risk tolerance context
- Synthesises everything into SPECIFIC, fund-level rebalancing recommendations
- Each recommendation includes: exact fund name, exact amount, whether to switch to direct plan, tax implication of the move (STCG if held <1yr, LTCG if >1yr, estimated tax amount), expected improvement in overlap/expense/returns
- Does NOT output vague suggestions like "reduce large-cap exposure" — outputs "Redeem ₹2.3L from HDFC Top 100 Regular (held >1yr, LTCG applies, estimated tax ₹2,875), move to Parag Parikh Flexi Cap Direct (reduces large-cap overlap from 68% to 41%, saves ₹4,200/yr in expense ratio)"

**Session state written:** `rebalancing_plan`
**Session state read:** `xirr_results`, `overlap_data`, `expense_analysis`, `benchmark_comparison`, `tax_result` (cross-pipeline), `user_profile`

#### Stage 4 — Compliance Review Loop

**Execution:** LoopAgent (max 2 iterations), containing 2 sequential sub-agents
**Why a loop:** First pass catches violations. If violations found, second pass verifies the fix. Bounded at 2 iterations for predictability.

**Agent 4A — Compliance Checker (LlmAgent, Gemini 3 Flash)**

What it does:
- Reads `rebalancing_plan`
- Scans for SEBI regulation violations: promising specific returns, acting as licensed investment advisor, recommending specific stocks (as opposed to mutual fund categories)
- Checks for missing disclaimers
- Checks that no language implies the system will execute trades
- Outputs `CLEAN` or a list of specific violations with line references

Session state written: `compliance_status`

**Agent 4B — Disclaimer Injector (LlmAgent, Gemini 3 Flash)**

What it does:
- If `compliance_status` is `CLEAN`, passes `rebalancing_plan` through unchanged, triggers LoopAgent exit via `escalate=True`
- If violations found, rewrites the flagged sections to be compliant
- Adds SEBI disclaimer: "This is AI-generated guidance, not licensed financial advice under SEBI (Investment Advisers) Regulations, 2013. Consult a SEBI-registered investment advisor before making investment decisions."
- Writes corrected plan back; loop re-runs compliance check to verify fix

Session state written: `compliant_plan`

#### Stage 5 — Sensitivity Engine

**Execution:** CustomAgent (extends BaseAgent for conditional re-execution logic)

**What it does:**
- Detects when the user changes an input (risk profile, adds a fund, changes investment horizon)
- Maintains a dependency map: which input changes invalidate which Stage 2 agents
- Re-runs ONLY the affected agents (NOT the entire ParallelAgent)
- Shows the delta: "Switching from moderate to aggressive risk profile changes equity allocation from 60% to 80%, increasing projected returns by ~2.1% but increasing portfolio volatility by 35%"

**Dependency map:**

| Input Changed | Agents That Re-Run | Agents That Stay Cached |
|--------------|-------------------|----------------------|
| Risk profile | Stage 3 (Rebalancer) only | All of Stage 2 |
| New fund added | ALL of Stage 2 + Stage 3 | None (new fund affects everything) |
| Direct plan toggle | Expense Agent + Stage 3 | XIRR, Overlap, Benchmark |
| Investment horizon | Benchmark Agent + Stage 3 | XIRR, Overlap, Expense |

Session state written: `portfolio_result` (final output of this pipeline)

---

### Pipeline B: Tax Wizard

**Pipeline type:** SequentialAgent (5 stages, with nested ParallelAgent at Stage 2 and LoopAgent at Stage 4)

#### Stage 1 — Input Collector

**Execution:** Sequential (single agent)
**Agent:** Input Collector (LlmAgent, Gemini 3 Flash)

**What it does:**
- Receives either a Form 16 PDF (processed via Gemini native PDF vision) or manual salary inputs from chat
- Extracts: basic salary, HRA component, special allowances, 80C investments (ELSS, PPF, LIC), 80D medical insurance, 80CCD(1B) NPS contribution, 24(b) home loan interest, standard deduction eligibility
- If Portfolio Pipeline ran, reads `portfolio_data` to identify potential capital gains implications (STCG/LTCG on any pending rebalancing moves)
- Validates: flags if total 80C exceeds ₹1.5L cap, checks if HRA inputs are internally consistent (rent paid > 10% of basic)

**Session state written:** `salary_structure`
**Session state read:** `portfolio_data` (cross-pipeline, optional)

#### Stage 2 — Parallel Regime Computation

**Execution:** ParallelAgent (2 agents running concurrently)
**Why parallel:** Old and new regime calculations are completely independent. Running them at the same time halves the computation latency.

**Agent 2A — Old Regime Calculator (LlmAgent, Gemini 3 Flash + BuiltInCodeExecutor)**

What it does:
- Reads `salary_structure`
- Writes Python code that computes tax step by step:
  - Gross salary
  - Minus HRA exemption (minimum of: actual HRA received, rent paid minus 10% of basic, 50%/40% of basic)
  - Minus standard deduction (₹50,000)
  - Minus 80C deductions (capped at ₹1,50,000)
  - Minus 80CCD(1B) NPS (additional ₹50,000)
  - Minus 80D medical insurance
  - Minus 24(b) home loan interest (capped at ₹2,00,000)
  - Taxable income → apply old regime slabs
  - Add 4% health & education cess
  - Add surcharge if applicable (>₹50L income)
- Executes in sandboxed Python — every intermediate value is logged
- Shows complete calculation trace (judges penalise "only final answer" outputs)

Session state written: `old_tax_result`

**Agent 2B — New Regime Calculator (LlmAgent, Gemini 3 Flash + BuiltInCodeExecutor)**

What it does:
- Reads `salary_structure`
- Writes Python code for new regime:
  - Gross salary
  - Minus standard deduction (₹75,000 in new regime)
  - No 80C, no HRA, no 80D, no NPS deductions
  - Taxable income → apply new regime slabs (different slab structure)
  - Add 4% cess
  - Add surcharge if applicable
- Shows complete step-by-step trace

Session state written: `new_tax_result`

#### Stage 3 — Tax Optimizer

**Execution:** Sequential (single agent, heavy reasoning)
**Agent:** Tax Optimizer (LlmAgent, Gemini 3.1 Pro)

**What it does:**
- Reads `old_tax_result` and `new_tax_result`
- Determines which regime saves more and by exactly how much (in rupees)
- Identifies MISSED deductions: "You didn't claim NPS under 80CCD(1B), which could save ₹15,600 under old regime"
- Suggests 2-3 additional tax-saving instruments, ranked by: liquidity (ELSS: 3yr lock-in, PPF: 15yr, NPS: retirement), risk level (ELSS: equity exposure, PPF: guaranteed, NPS: mixed), and tax benefit (amount saved per rupee invested)
- Personalises suggestions based on `user_profile` risk tolerance
- If `portfolio_data` exists: calculates STCG/LTCG implications of any proposed rebalancing from Portfolio Pipeline

**Session state written:** `tax_optimization`
**Session state read:** `old_tax_result`, `new_tax_result`, `user_profile`, `portfolio_data` (cross-pipeline, optional)

#### Stage 4 — Compliance Review Loop

**Execution:** LoopAgent (max 2 iterations)

**Agent 4A — IT Act Compliance Checker:** Verifies that tax slab rates used are current (FY 2025-26), cess is 4%, surcharge thresholds are correct for the income level, HRA exemption calculation follows all three rules correctly.

**Agent 4B — Disclaimer Injector:** Adds: "This is illustrative tax computation. Consult a Chartered Accountant for filing. Tax laws are subject to change."

#### Stage 5 — Tax Sensitivity Engine

**Execution:** CustomAgent (conditional re-execution)

**What it does:**
- User asks "what if I invest ₹50K more in NPS?"
- Determines: NPS only affects old regime → re-runs ONLY Old Regime Calculator
- New Regime result stays cached (NPS deduction doesn't apply in new regime)
- Shows delta: "Additional NPS of ₹50K → old regime tax drops by ₹15,600, making old regime now ₹8,200 cheaper than new"

**Dependency map:**

| Input Changed | Agents That Re-Run | Agents That Stay Cached |
|--------------|-------------------|----------------------|
| NPS contribution | Old Regime Calculator + Optimizer | New Regime Calculator |
| HRA / rent change | Old Regime Calculator + Optimizer | New Regime Calculator |
| Salary change | BOTH regime calculators + Optimizer | None |
| 80C investment change | Old Regime Calculator + Optimizer | New Regime Calculator |

**Session state written:** `tax_result` (final — shared to other pipelines)

---

### Pipeline C: FIRE Planner

**Pipeline type:** SequentialAgent (5 stages, with nested ParallelAgent at Stage 1 AND Stage 2, and LoopAgent at Stage 4)

#### Stage 1 — Data Gathering (User Inputs + Live Market Data)

**Execution:** ParallelAgent (2 agents running concurrently)
**Why parallel at Stage 1:** The Goal Profiler collects user inputs (conversational, no network dependency) while the Macro Agent fetches live market data (network-dependent). These are independent — running them concurrently saves time. Both must complete before Stage 2 starts. The SequentialAgent wrapper guarantees this: Stage 2 does not begin until every Stage 1 sub-agent has written its output to session state. **This eliminates any race condition between macro data and the Monte Carlo engine.**

**Agent 1A — Goal Profiler (LlmAgent, Gemini 3 Flash)**

What it does:
- Conversational agent: extracts current age, annual income, monthly expenses, existing investments (MFs, PPF, EPF, FDs), target retirement age, desired monthly draw in today's rupees
- If Portfolio Pipeline already ran, reads `portfolio_data` to auto-populate existing MF values (no need to ask user again)
- Validates: flags if desired monthly draw exceeds current income (possible but worth flagging), checks if retirement age is realistic given current savings rate

Session state written: `fire_inputs`
Session state read: `portfolio_data` (cross-pipeline, optional)

**Agent 1B — Real-Time Macro Agent (LlmAgent, Gemini 3 Flash + Exa/Google Search)**

What it does:
- Searches for CURRENT macroeconomic data using Exa MCP (`category: "financial report"`) and Google Search:
  - Latest RBI repo rate and monetary policy stance
  - Current CPI inflation (last published month)
  - Nifty 50 trailing 1-year return and 5-year CAGR
  - Nifty 50 historical annualised volatility (standard deviation of annual returns)
  - Current 10-year government bond yield (risk-free rate proxy)
  - Current SBI FD rate (debt return proxy)
- Packages these as structured parameters that the Monte Carlo engine uses instead of hardcoded assumptions
- Tags each parameter with its source and date, so the user knows the data is current

Session state written: `macro_parameters`

**Stage 1 completion guarantee:** The SequentialAgent wrapper ensures Stage 2 only begins after BOTH `fire_inputs` AND `macro_parameters` are written to session state. No race conditions. No fallback defaults. The Monte Carlo engine always has live data.

#### Stage 2 — Parallel Financial Computation

**Execution:** ParallelAgent (3 agents running concurrently)
**Why this works without race conditions:** By the time Stage 2 starts, `fire_inputs` and `macro_parameters` are guaranteed to be in session state (Stage 1 completed). All three Stage 2 agents can safely read these values.

**Agent 2A — Monte Carlo Corpus Engine (LlmAgent, Gemini 3 Flash + BuiltInCodeExecutor)**

What it does:
- Reads `fire_inputs` (user's financial profile) and `macro_parameters` (live market data from Stage 1) — both guaranteed to exist
- Writes Python code that runs a **1,000-iteration Monte Carlo simulation** in the sandboxed executor:
  - For each simulation: randomly samples annual equity returns from a distribution calibrated to LIVE Nifty 50 data (mean and std dev from `macro_parameters`), randomly samples annual inflation from LIVE CPI data, randomly samples debt returns from LIVE bond yield data
  - Applies the user's specific asset allocation, SIP amounts, and withdrawal plan across each simulated year
  - Tracks whether the corpus survives through the user's life expectancy (age 85)
- After 1,000 runs, produces a **probability distribution** of outcomes:
  - **Success rate:** percentage of simulations where money didn't run out (e.g., 78%)
  - **Percentile corpus values at retirement:** P10 (worst 10%), P25, P50 (median), P75, P90 (best 10%)
  - **Fan chart data:** year-by-year percentile bands for visualisation
  - **Shortfall analysis:** in failing scenarios, average shortfall amount and average age of depletion
- All 1,000 simulation paths are stored for fan chart rendering
- Shows complete code and methodology (traceable logic)

Session state written: `monte_carlo_results` (contains success_rate, percentile_corpus_values, fan_chart_data, shortfall_analysis)

**Agent 2B — SIP Glidepath Engine (LlmAgent, Gemini 3 Flash + BuiltInCodeExecutor)**

What it does:
- Reads `fire_inputs` and `macro_parameters`
- Calculates monthly SIP needed to reach the **median corpus target** (from Monte Carlo P50), broken down by goal
- Applies asset allocation glidepath: 90/10 equity-debt at age 34, shifting to 60/40 by retirement
- Models SIP step-up: assumes 10% annual SIP increase with salary growth
- Also calculates the **"safety SIP"** — the SIP amount needed to achieve 90% success probability (P10 target), giving the user a range: "₹39K/month for a 50% chance, ₹52K/month for a 90% chance"
- Outputs month-by-month plan for first 12 months and year-by-year plan for remaining period

Session state written: `sip_plan`

**Agent 2C — Insurance Gap Agent (LlmAgent, Gemini 3 Flash + Google Search / Exa)**

What it does:
- Reads `fire_inputs` for income and dependents
- Checks term insurance rule: cover should be 10-15x annual income
- Checks health insurance: minimum ₹10L cover for family
- Searches for current premium rates to estimate cost
- Identifies gaps: "You need ₹1.5 crore term cover. Current premium estimate: ₹12,000/year for a 34-year-old non-smoker."

Session state written: `insurance_gaps`

**Note on SIP Glidepath dependency on Monte Carlo:** Agent 2B reads `macro_parameters` for its own return assumptions and calculates SIP independently. It also references Monte Carlo percentiles for the "safety SIP" range. Since both 2A and 2B are in the same ParallelAgent sharing session state, the SIP Glidepath uses `macro_parameters` directly for its baseline calculation. The "safety SIP" referencing Monte Carlo P10 is computed as a secondary output — if 2A finishes first, 2B uses it; if not, 2B calculates the safety SIP from its own conservative assumptions and flags it for reconciliation by the Roadmap Builder in Stage 3.

#### Stage 3 — Probabilistic Roadmap Builder (AI Interpretation Layer)

**Execution:** Sequential (single agent, heavy reasoning)
**Agent:** Roadmap Builder (LlmAgent, Gemini 3.1 Pro)

**This is where AI interpretation transforms raw Monte Carlo output into actionable life decisions.**

**What it does:**
- Reads `monte_carlo_results`, `sip_plan`, `insurance_gaps`, `macro_parameters`
- Also reads `tax_result` from Tax Pipeline (cross-pipeline) to integrate tax-saving instruments into the plan
- **Interprets the probability distribution** — this is the AI's core value-add:
  - "Your plan has a 78% success probability. In the worst 10% of market scenarios, your corpus falls short by ₹1.2 crore by age 72."
  - "Your high equity allocation (90%) gives you a higher median outcome but a wider uncertainty cone. Increasing debt to 25% narrows the cone and raises success probability to 89%, at the cost of a 6% lower median corpus."
  - "The biggest risk factor in your plan is sequence-of-returns risk in the first 5 years of retirement. A market crash right after you stop earning has an outsized impact."
- **Generates risk-adjusted recommendations** — not just "save more" but:
  - "To move from 78% to 90% success probability, you need ONE of: increase SIP by ₹13K/month, OR delay retirement by 2 years, OR reduce monthly draw from ₹1.5L to ₹1.25L. Here's the trade-off for each option."
- Builds a comprehensive month-by-month financial roadmap:
  - Month 1-3: Emergency fund build-up (6 months expenses)
  - Month 4: Start SIPs — allocates across fund categories, including ELSS for 80C tax benefit
  - Month 6: Term insurance purchase
  - Month 12: First annual review checkpoint — re-run Monte Carlo with actual returns
  - Year 2-5: SIP step-up schedule
  - Year 5, 10, 15: Asset allocation rebalancing milestones (glidepath shifts)
- Each item includes: exact amount, which instrument, why this timing, tax benefit if applicable, and **impact on success probability**

**Session state written:** `fire_roadmap`
**Session state read:** `monte_carlo_results`, `sip_plan`, `insurance_gaps`, `macro_parameters`, `tax_result` (cross-pipeline)

#### Stage 4 — Compliance Review Loop

**Execution:** LoopAgent (max 2 iterations)

**Agent 4A — SEBI/IRDA Compliance Checker:** Flags any return guarantees ("you WILL have ₹9 crore" — must be phrased as probability, e.g. "78% chance"), any language that constitutes unlicensed investment advisory, any insurance recommendations without IRDA disclaimer. Also verifies that Monte Carlo outputs are framed as probabilities not predictions — "78% success probability" is compliant; "your plan will succeed" is not.

**Agent 4B — Disclaimer Injector:** Adds: "Monte Carlo simulations are based on historical return distributions and assumed parameters. They model probability, not certainty. Actual market conditions may differ materially from any simulated scenario. Past performance does not guarantee future results. This is AI-generated guidance, not licensed financial advice."

#### Stage 5 — FIRE Sensitivity Engine

**Execution:** CustomAgent (conditional re-execution)

**What it does:**
- User drags a slider: "retire at 55 instead of 50"
- Determines: retirement age change affects Monte Carlo Engine and SIP Glidepath (Stage 2), but NOT Insurance Gap (Stage 2) or Macro Agent (Stage 1 — macro data is still fresh from session start)
- Re-runs only the affected Stage 2 agents with updated inputs
- **Shows probabilistic delta instead of single-path delta:**
  - OLD: "corpus drops from ₹9.27Cr to ₹7.1Cr" (single path — useless)
  - NEW: "Success probability rises from 78% to 91%. The P10 worst-case corpus improves from ₹5.8Cr to ₹7.9Cr. The uncertainty cone narrows significantly — 5 extra working years dramatically reduce sequence-of-returns risk."
- The Roadmap Builder (Stage 3) re-runs to reinterpret the new distribution and update recommendations

**Dependency map:**

| Input Changed | Agents That Re-Run | Agents That Stay Cached |
|--------------|-------------------|----------------------|
| Retirement age | Monte Carlo + SIP Glidepath + Roadmap Builder | Insurance Gap, Macro Agent (Stage 1) |
| Monthly draw target | Monte Carlo + SIP Glidepath + Roadmap Builder | Insurance Gap, Macro Agent (Stage 1) |
| Asset allocation | Monte Carlo + SIP Glidepath + Roadmap Builder | Insurance Gap, Macro Agent (Stage 1) |
| Income change | ALL Stage 2 + Roadmap Builder | Macro Agent (Stage 1 — still fresh) |
| Existing investments change | Monte Carlo + SIP Glidepath + Roadmap Builder | Insurance Gap, Macro Agent (Stage 1) |
| "Refresh macro data" | Macro Agent (Stage 1) → then ALL Stage 2 + Roadmap Builder | Insurance Gap |

**Session state written:** `fire_result`

---

### Shared Final Layer: Narrative Output + HITL Gate

**Agent:** Narrative Output Agent (LlmAgent, Gemini 3 Flash)

**What it does:**
- Reads final results from whichever pipelines ran: `portfolio_result`, `tax_result`, `fire_result`
- Converts structured JSON outputs into plain-English insights
- Formats "Show Your Math" expandable sections for every calculation
- Generates the overlap heatmap data, the regime comparison table, the month-by-month timeline

**Agent:** HITL Confirmation Gate (Tool Confirmation flow in ADK)

**What it does:**
- Presents the complete plan to the user
- Asks: "Would you like to save this as a PDF action sheet?" or "Would you like me to adjust any parameters?"
- Does NOT execute any trades — generates instructions the human manually executes
- This is a deliberate design choice for SEBI compliance

---

## 3. Knowledge Layer

### 3.1 Gemini Native PDF Document Processing

**Problem it solves:** CAMS/KFintech statements and Form 16 documents are complex PDFs with irregular table formats. Traditional PDF parsing libraries (pdfplumber, camelot) break on inconsistent AMC formats.

**How we use it:**
- Gemini 3 Flash has native PDF vision — it processes the PDF as an image, understanding table layouts, merged cells, and multi-column structures visually
- The Ingestion Agent passes the raw PDF to Gemini Flash WITHOUT any pre-processing
- Gemini extracts structured data directly, handling edge cases that rule-based parsers miss: STP circular entries, split transaction rows, different AMC header formats
- Form 16 processing works the same way: Gemini reads the visual layout and extracts salary components, deductions, and employer details

**Key advantage:** Zero dependency on external parsing libraries. One model handles all PDF variants. This also means our agent can gracefully handle unexpected document formats — it's not brittle.

### 3.2 Gemini Embedding 2 — Fund Holdings RAG Store

**Problem it solves:** The Overlap Agent needs reliable, structured fund holdings data. Google Search returns unpredictable snippets that may be outdated or from unreliable sources.

**How we build it:**

**Indexing pipeline (one-time setup, refresh monthly):**
1. Download latest monthly portfolio disclosure PDFs from AMFI for top 100-200 mutual funds
2. Chunk each factsheet into 6-page segments (Gemini Embedding 2 limit per request)
3. Embed each chunk using `gemini-embedding-2-preview` with `task_type: RETRIEVAL_DOCUMENT`
4. Store vectors in ChromaDB (lightweight, runs locally, no cloud dependency during demo)
5. Each vector is tagged with metadata: fund_name, AMC, disclosure_month, fund_category

**Retrieval at query time (inside Overlap Agent):**
1. Agent constructs query: "Top 10 holdings of HDFC Top 100 Fund with percentage weights"
2. Query embedded with `task_type: RETRIEVAL_QUERY` (asymmetric optimisation)
3. Cosine similarity search against ChromaDB returns the most relevant factsheet chunk
4. The retrieved chunk (containing the actual holdings table from the official AMC factsheet) is passed to Gemini Flash for structured extraction: stock_name, percentage_weight, sector
5. Result is OFFICIAL data from regulatory filings, not web snippets

**Why Gemini Embedding 2 specifically:**
- It embeds PDFs natively — no need to OCR the factsheet first, then embed the text separately
- The table layout is preserved in the embedding, so a query about "top holdings" matches the holdings table section, not a random paragraph mentioning the fund name
- Matryoshka representation: we can use 768 dimensions (not full 3072) for the hackathon to keep storage small while retaining high retrieval quality

### 3.3 Exa MCP Server — Structured Financial Search Fallback

**Problem it solves:** Our pre-seeded RAG store covers top 100-200 funds, but users might hold niche funds not in our index. We need a reliable fallback that's better than Google Search.

**How we use it:**

Exa MCP's `web_search_advanced_exa` tool with `category: "financial report"` provides structured financial document search with domain filtering. Our implementation:

1. Overlap Agent first queries the RAG store (Layer 1 — highest confidence)
2. If fund not found in RAG store, agent calls Exa with:
   - `category: "financial report"`
   - `includeDomains: ["amfiindia.com", "valueresearchonline.com", "moneycontrol.com"]`
   - `startPublishedDate` set to 3 months ago (ensures recent data)
3. Exa returns the actual factsheet page URL + content. Agent extracts holdings from the returned content
4. Result tagged as MEDIUM confidence
5. Only if Exa also fails: fall back to Google Search, tagged as LOW confidence

**Why Exa over raw Google Search:**
- Exa's neural search understands financial document semantics — "fund holdings" query returns actual factsheet pages, not news articles or forum posts mentioning the fund
- Domain filtering ensures we only pull from authoritative financial data sources
- Date filtering ensures we get recent disclosures, not stale data from 2 years ago
- The `category: "financial report"` filter is specifically trained for SEC filings and financial documents

**ADK integration:** Exa MCP integrates directly with ADK via `MCPToolset`. The Overlap Agent's tool list is prioritised: RAG tool first, Exa MCP second, Google Search third.

### 3.4 Three-Layer Data Confidence Architecture

| Layer | Source | Confidence | When Used |
|-------|--------|------------|-----------|
| 1 | RAG store (Gemini Embedding 2 + AMFI factsheets) | HIGH | Fund is in top 100-200 pre-indexed set |
| 2 | Exa MCP (`financial report` category) | MEDIUM | Fund not in RAG store, Exa returns authoritative result |
| 3 | Google Search | LOW | Both Layer 1 and 2 fail |

Every holdings data point in the final output carries its confidence tag. This transparency is an Enterprise Readiness feature — real systems always show data provenance.

---

## 4. Critique Resolution

### Critique 1: "Google Search for fund holdings is fragile"

**The problem:** Using `google_search` to fetch fund holdings risks pulling outdated snippets, hallucinated weightages from news articles, or forum posts instead of official AMC factsheets. If overlap calculations are based on bad data, the entire rebalancing strategy is compromised.

**Our solution:** The three-layer data confidence architecture described above. The RAG store with official AMFI factsheets is the primary source — it's deterministic, always available, and uses official regulatory data. Exa MCP is the structured search fallback. Google Search is the tagged last resort.

**Why this is better than any single source:**
- RAG store: Always available (no network dependency), official data, sub-second retrieval
- Exa fallback: Extends coverage beyond pre-seeded funds, domain-filtered to authoritative sources
- Confidence tagging: The system never silently uses bad data — if it's using Google Search, it says so explicitly
- Graceful degradation: If all three layers fail for a specific fund, the agent reports "Holdings data unavailable for this fund" rather than hallucinating — and still completes the analysis for all other funds

### Critique 2: "HITL 'execution' crosses SEBI regulatory boundaries"

**The problem:** If the agent implies it will trigger live mutual fund switches via a broker API, it crosses into unlicensed investment advisory territory under SEBI (Investment Advisers) Regulations, 2013. Enterprise judges will grill on liability and compliance.

**Our solution:** The HITL gate is explicitly a PLAN REVIEW, not a trade execution. The system architecture document makes this distinction in flaming red ink:

**What the HITL gate does:**
- Presents the complete rebalancing plan with all calculations shown
- Asks: "Would you like to save this as a PDF action sheet?"
- Generates step-by-step instructions the user can follow on their own broker platform (e.g., "Log into your Coin/Groww account → Go to HDFC Top 100 Regular → Redeem ₹2.3L → Navigate to Parag Parikh Flexi Cap Direct → Invest ₹2.3L via lumpsum")
- The system NEVER touches a broker API

**What the Compliance Loop enforces:**
- Any language suggesting the system will "execute" or "trigger" trades is flagged and removed
- All outputs include the SEBI disclaimer
- No specific return guarantees appear in any output
- The system distinguishes between "AI-generated guidance" and "licensed financial advice" in every response

**Why this scores high:** The rubric gives 20% to Enterprise Readiness. Most teams will either ignore SEBI entirely (risky) or build a fake broker integration (which judges will immediately challenge). Our approach shows we understand the regulatory landscape and have built guardrails accordingly.

### Critique 3: "What-If re-runs waste compute"

**The problem:** If a user changes one input (retirement age slider, additional NPS investment), the system shouldn't re-run the entire ParallelAgent from scratch. Re-fetching fund holdings, recalculating historical expense ratios, and re-running benchmarks when only the retirement age changed is wasteful.

**Our solution:** The Sensitivity Engine at Stage 5 of each pipeline is a CustomAgent (extends BaseAgent) that maintains a dependency graph. It knows exactly which Stage 2 agents are affected by each input change and re-runs ONLY those agents.

**How the caching works:**
- Every agent's output is persisted in ADK's session state via `output_key`
- Session state survives across turns within the same conversation
- The Sensitivity Engine reads the `changed_input` from session state, consults its dependency map, and selectively re-invokes only the affected sub-agents
- All other output keys remain cached from the previous run

**Specific examples of efficient re-execution:**
- "What if I change retirement from 50 to 55?" → Monte Carlo Engine + SIP Glidepath re-run. Insurance Gap and Macro Agent results are cached. Saves ~40% compute. Output shows probability shift: "success rate 78% → 91%."
- "What if I add ₹50K NPS?" → Only Old Regime Calculator re-runs. New Regime result is cached (NPS doesn't affect new regime). Saves ~50% compute.
- "What if I change risk profile to aggressive?" → No Stage 2 agents re-run in Portfolio pipeline. Only Stage 3 (Rebalancer) re-runs with the same cached data but different risk parameters. Saves ~80% compute.
- "What if I increase debt allocation to 25%?" → Monte Carlo re-runs with new allocation parameters (the simulation code changes, not the macro data). SIP Glidepath re-runs. Shows: "Median corpus drops 6%, but success probability rises from 78% to 89% — the uncertainty cone narrows."

**Why this matters for scoring:** The scenario pack says "plans that update dynamically when inputs change score higher" and "static outputs requiring a full re-run will score lower." Our architecture re-runs the minimum necessary computation — and we can demonstrate this in the ADK dev UI event trace, showing the judges exactly which agents ran and which were skipped.

---

## 5. Differentiating Features

### Feature 1: "Show Your Math" — Full Calculation Traceability

Every number the system produces is expandable to show the complete calculation chain. XIRR? Here's the cashflow series and the Newton-Raphson iterations. Tax liability? Here's every deduction, slab, cess, and surcharge. Monte Carlo success rate? Here's the simulation parameters, the return distribution used, and a sample of individual simulation paths.

**Why it matters:** The judges explicitly say "agents that give only a final answer without traceable logic will be penalised." Most teams will output a number. We output the number AND the auditable reasoning chain. For Monte Carlo, this means showing: "We ran 1,000 simulations using Nifty 50 historical returns (mean 12.1%, std dev 17.8%, sourced from NSE data via Exa on 2026-03-29). Here are 5 sample paths showing best case, worst case, and median trajectories."

**How it works:** The BuiltInCodeExecutor generates Python code that prints every intermediate value. The Monte Carlo engine logs its parameters, random seed, and percentile calculations. The Narrative Output Agent formats these into collapsible "Show Math" sections in the UI.

### Feature 2: Monte Carlo Fan Chart — Probabilistic Wealth Projection

This is the single biggest visual differentiator over every other Track 9 submission.

Instead of a single line saying "you'll have ₹9.27 crore at age 50" (which every SIP calculator on the internet already does), we show a **fan chart** — a visualisation where:
- The X-axis is time (age 34 → 50 → 85)
- The Y-axis is portfolio value
- The **median line** (P50) shows the most likely path
- **Shaded bands** expand outward showing the P25-P75 range (50% of scenarios), P10-P90 range (80% of scenarios), and P5-P95 range (90% of scenarios)
- The bands are **narrow near-term** (next 2-3 years — high certainty) and **wide long-term** (20+ years — high uncertainty)
- A **red zone** below the minimum viable corpus threshold shows "danger" scenarios

The fan chart makes uncertainty VISIBLE. A user can see at a glance: "My median outcome is great, but there's a 15% chance I fall short." That's fundamentally more honest and more useful than a single-line projection.

**Interactive elements:**
- User drags the retirement age slider → fan chart re-renders in real time, showing how the cone narrows or widens
- User toggles asset allocation → high-equity allocation shows a wider cone (more upside AND more downside), high-debt allocation shows a narrower cone
- User adjusts SIP amount → the median line shifts up/down, and the success probability updates

**Implementation:** The Monte Carlo engine (BuiltInCodeExecutor) outputs the year-by-year percentile data as JSON. The frontend renders this as a fan chart using a charting library (Recharts in React, or Chart.js). The AI never draws the chart — it produces the data; the frontend renders it.

### Feature 3: Cross-Pipeline Intelligence

The three pipelines don't operate in isolation. They share data through session state:

- Portfolio's Rebalancer reads `tax_result` → "Don't sell this fund now, STCG applies. Wait 3 months."
- FIRE's Roadmap Builder reads `tax_result` → "Allocate ₹25K/month to ELSS, it doubles as 80C tax saving."
- Tax's Input Collector reads `portfolio_data` → "Your proposed rebalancing will trigger ₹8,400 in LTCG."

This cross-pipeline awareness is what separates a collection of calculators from an integrated financial planning system. Most teams will build isolated features. Our agents collaborate.

### Feature 4: Graceful Degradation with Explicit Confidence

If any sub-agent fails — Exa is down, a fund isn't in the RAG store, the CAMS PDF has an unreadable page — the system doesn't crash. It:
1. Catches the error at the individual agent level
2. Reports what succeeded and what failed
3. Produces partial results with caveats: "Portfolio analysis complete for 5 of 6 funds. XIRR not available for Quant Small Cap Fund — holdings data could not be retrieved. Showing results for remaining funds."
4. Suggests a retry for the failed component

This is the kind of resilience that earns Enterprise Readiness points. Real production systems don't have 100% uptime on all dependencies.

### Feature 5: Cost-Efficient Model Routing

We don't use Gemini Pro for everything. Our architecture explicitly routes:
- Gemini 3 Flash (cheap, fast): Parsing, extraction, formatting, compliance checking, narration
- Gemini 3.1 Pro (expensive, smart): Only for the Rebalancing Strategist, Tax Optimizer, and Roadmap Builder — agents that need multi-variable reasoning across 4+ data sources

The rubric explicitly gives bonus points for "cost-efficient architectures, e.g. routing between large and small models." We can show the cost breakdown: "This analysis used 3 Pro calls and 14 Flash calls, estimated cost: ₹2.8 total."

### Feature 6: Stock-Level Overlap Heatmap Visualisation

Not just "3 funds have overlap." An interactive matrix in the UI:
- Rows = Fund A, B, C, D, E, F
- Columns = Top 20 holdings across all funds
- Cells = percentage weight of that stock in that fund
- Color intensity = overlap severity
- One glance shows exactly where the redundancy is

This is a visual differentiator. Most teams will output text. We output an interactive data visualisation.

### Feature 7: Tax-Aware Rebalancing Simulator

Before the user commits to any rebalancing move, they can simulate the tax impact:
- "If I exit Fund X today → STCG at 20%, tax = ₹12,400"
- "If I wait 3 months → Fund X crosses 1-year holding → LTCG at 12.5%, tax = ₹4,200"
- "Net saving by waiting: ₹8,200"

This forward-looking tax simulation is something most financial advisors don't even do consistently. Building it into the agent shows domain expertise depth.

### Feature 8: ADK Dev UI Event Trace for Demo

During the live demo, we use ADK's built-in developer UI to show the judges:
- The event graph: which agents ran, in what order, which ran in parallel
- The session state: what data each agent wrote and which agents read it
- The tool calls: which tools each agent invoked (CodeExecutor, RAG, Exa, Google Search)
- The timing: how long each agent took, proving parallelism actually saved time

This is the "architecture is the demo" approach. The judges care about the system design as much as the output. The ADK dev UI makes the architecture visible.

---

## 6. Rubric Alignment

| Dimension | Weight | How We Score |
|-----------|--------|-------------|
| **Autonomy Depth** | 30% | Each pipeline completes 5+ sequential steps without human input. Monte Carlo engine autonomously runs 1,000 simulations and produces probability distributions. Sensitivity Engine re-runs only affected agents. Compliance Loop self-corrects. Error recovery produces partial results without crashing. |
| **Multi-Agent Design** | 20% | Hybrid sequential + parallel architecture. FIRE pipeline demonstrates nested orchestration: Stage 1 ParallelAgent (data gathering) → Stage 2 ParallelAgent (computation) — parallel-inside-sequential-inside-sequential, with zero race conditions. ParallelAgent for independent analysis (4 agents in Portfolio, 3 in FIRE Stage 2), SequentialAgent for dependent stages, LoopAgent for compliance review, CustomAgent for conditional re-execution. Cross-pipeline data sharing via session state. Real-Time Macro Agent feeds live parameters into Monte Carlo Engine via guaranteed Stage 1 → Stage 2 handoff. |
| **Technical Creativity** | 20% | Monte Carlo probabilistic forecasting with fan chart visualisation (not a static calculator), Gemini Embedding 2 RAG store (released 3 weeks ago), native PDF processing (no parsing libraries), BuiltInCodeExecutor for deterministic math AND stochastic simulations, Exa MCP for structured financial search, cost-efficient Flash/Pro routing, three-layer data confidence architecture, AI interpretation of probability distributions (the core "AI Money Mentor" value-add). |
| **Enterprise Readiness** | 20% | SEBI compliance guardrails with LoopAgent enforcement — Monte Carlo outputs are framed as probabilities not predictions, HITL gate that generates plans (never executes trades), graceful degradation with partial results, confidence-tagged data provenance, audit trail via ADK event trace, explicit disclaimer injection, clear separation between deterministic computation (tax, XIRR) and probabilistic modelling (FIRE). |
| **Impact Quantification** | 10% | Expense ratio savings in rupees (direct vs regular plan switch), tax savings (old vs new regime + missed deductions), overlap reduction percentage, SIP optimisation (Monte Carlo shows: "increasing SIP by ₹13K/month raises success probability from 78% to 90%"), probability-of-success as the primary retirement metric (not a fictional single-path corpus number). |

---

## Appendix: Agent Count Summary

| Component | Agent Type | Model | Count |
|-----------|-----------|-------|-------|
| Orchestrator | LlmAgent | Gemini 3.1 Pro | 1 |
| Portfolio Pipeline | SequentialAgent (wrapper) | — | 1 |
| → Ingestion | LlmAgent | Gemini 3 Flash | 1 |
| → Parallel Analysis | ParallelAgent (wrapper) | — | 1 |
| → → XIRR Engine | LlmAgent + CodeExecutor | Gemini 3 Flash | 1 |
| → → Overlap Agent | LlmAgent + RAG + Exa + Search | Gemini 3 Flash | 1 |
| → → Expense Agent | LlmAgent + Search | Gemini 3 Flash | 1 |
| → → Benchmark Agent | LlmAgent + Search | Gemini 3 Flash | 1 |
| → Rebalancing Strategist | LlmAgent | Gemini 3.1 Pro | 1 |
| → Compliance Loop | LoopAgent (wrapper) | — | 1 |
| → → Compliance Checker | LlmAgent | Gemini 3 Flash | 1 |
| → → Disclaimer Injector | LlmAgent | Gemini 3 Flash | 1 |
| → Sensitivity Engine | CustomAgent | — | 1 |
| Tax Pipeline | SequentialAgent (wrapper) | — | 1 |
| → Input Collector | LlmAgent | Gemini 3 Flash | 1 |
| → Parallel Compute | ParallelAgent (wrapper) | — | 1 |
| → → Old Regime Calculator | LlmAgent + CodeExecutor | Gemini 3 Flash | 1 |
| → → New Regime Calculator | LlmAgent + CodeExecutor | Gemini 3 Flash | 1 |
| → Tax Optimizer | LlmAgent | Gemini 3.1 Pro | 1 |
| → Compliance Loop | LoopAgent (wrapper) | — | 1 |
| → → Compliance Checker | LlmAgent | Gemini 3 Flash | 1 |
| → → Disclaimer Injector | LlmAgent | Gemini 3 Flash | 1 |
| → Tax Sensitivity | CustomAgent | — | 1 |
| FIRE Pipeline | SequentialAgent (wrapper) | — | 1 |
| → Stage 1: Data Gathering | ParallelAgent (wrapper) | — | 1 |
| → → Goal Profiler | LlmAgent | Gemini 3 Flash | 1 |
| → → Real-Time Macro Agent | LlmAgent + Exa/Search | Gemini 3 Flash | 1 |
| → Stage 2: Parallel Compute | ParallelAgent (wrapper) | — | 1 |
| → → Monte Carlo Corpus Engine | LlmAgent + CodeExecutor | Gemini 3 Flash | 1 |
| → → SIP Glidepath | LlmAgent + CodeExecutor | Gemini 3 Flash | 1 |
| → → Insurance Gap Agent | LlmAgent + Search/Exa | Gemini 3 Flash | 1 |
| → Roadmap Builder | LlmAgent | Gemini 3.1 Pro | 1 |
| → Compliance Loop | LoopAgent (wrapper) | — | 1 |
| → → Compliance Checker | LlmAgent | Gemini 3 Flash | 1 |
| → → Disclaimer Injector | LlmAgent | Gemini 3 Flash | 1 |
| → FIRE Sensitivity | CustomAgent | — | 1 |
| Narrative Output | LlmAgent | Gemini 3 Flash | 1 |
| **TOTAL** | | | **39 components** |

**LlmAgent instances (actual AI calls):** 23
**Workflow Agents (deterministic orchestration):** 13 (one extra ParallelAgent wrapper in FIRE Stage 1)
**CustomAgents (programmatic logic):** 3
**Models used:** Gemini 3.1 Pro (4 instances), Gemini 3 Flash (19 instances), Gemini Embedding 2 (RAG indexing)
