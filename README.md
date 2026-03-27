<div align="center">

# 💰 ArthaGPT

### India's AI Money Mentor
**Your money. Finally understood.**

*ET AI Hackathon 2026 — Track 9*

[![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%203.1%20Pro-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![GCP](https://img.shields.io/badge/Built%20on-Google%20Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![License](https://img.shields.io/badge/License-MIT-gold?style=for-the-badge)](LICENSE)

</div>

---

## 🎯 The Problem

**95% of Indians have no financial plan.** A human advisor charges ₹25,000+/year and only serves HNIs. India has 14 crore demat account holders — ~9 crore have never consulted a financial advisor.

## 💡 Our Answer

ArthaGPT is an AI-powered financial mentor that does what a ₹25,000/year human financial advisor does — **for every Indian with a phone, for free, in under 10 minutes.**

Upload your CAMS statement, enter your salary structure, tell us your goals — ArthaGPT gives you a personalised retirement roadmap, an exact tax regime comparison with step-by-step working, and a specific rebalancing plan for your mutual fund portfolio.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│              ArthaGPT Multi-Agent System          │
├─────────────────────────────────────────────────┤
│  Layer 1: Orchestrator (Gemini 3.1 Pro)          │
│  ├── Routes requests to specialist agents        │
│  ├── Manages state & session                     │
│  └── Injects compliance guardrails               │
├─────────────────────────────────────────────────┤
│  Layer 2: Specialist Agents                       │
│  ├── Portfolio Agent (XIRR, overlap, rebalance)  │
│  ├── FIRE Agent (corpus, SIP, glidepath)         │
│  └── Tax Agent (deterministic FY 2025-26 slabs)  │
├─────────────────────────────────────────────────┤
│  Layer 3: Tool Layer                              │
│  ├── CASParser MCP (CAMS/KFintech PDF → JSON)    │
│  ├── mfapi.in (NAV history for XIRR)             │
│  ├── Tax Engine (hardcoded slabs, not LLM)        │
│  └── XIRR Calculator (Newton-Raphson)             │
├─────────────────────────────────────────────────┤
│  Layer 4: Output Agents                           │
│  ├── Narrative Agent (Gemini 3 Flash)             │
│  └── Image Agent (Gemini 3.1 Flash Image)         │
└─────────────────────────────────────────────────┘
```

### Model Tier Strategy

| Model | Role | Use Case |
|-------|------|----------|
| **Gemini 3.1 Pro** | Master reasoning engine | XIRR computation, tax regime comparison, FIRE calculations |
| **Gemini 3 Flash** | Mid-complexity analysis | Portfolio summaries, narrative explanations |
| **Gemini 2.5 Flash** | Conversational layer | Follow-up questions, reformatting outputs |
| **Gemini 3.1 Flash Image** | Visual output | FIRE roadmap infographics, portfolio visual summaries |

---

## 🧩 Three Core Modules

### 1. MF Portfolio X-Ray
- Upload CAMS/KFintech PDF → parse via CASParser
- True XIRR per fund using Newton-Raphson method
- Stock overlap heatmap across all fund holdings
- Expense ratio drag: regular vs direct plan comparison
- **Specific, fund-level rebalancing plan** with tax consequences

### 2. FIRE Path Planner
- Inflation-adjusted corpus target (6% India-specific inflation)
- 3% safe withdrawal rate (India-specific, not US 4% rule)
- Month-by-month SIP allocation with equity/debt glidepath
- **Interactive retirement age slider** — every figure recalculates client-side in real time
- Insurance gap detection

### 3. Tax Wizard (FY 2025-26)
- **Deterministic** tax engine — not LLM estimation
- Full step-by-step working shown for both regimes
- HRA exemption: three-way minimum formula with all values visible
- Slab-by-slab tax breakdown (expandable)
- Missed deduction detection with exact rupee savings
- Ranked tax-saving instrument recommendations

---

## 🛡 Compliance & Guardrails

| Layer | Implementation |
|-------|---------------|
| **Input guardrails** | Rejects implausible inputs (age > 100, negative values), asks for correction |
| **Calculation guardrails** | Flags anomalous XIRR (>100% or <-50%), asks user to verify |
| **Output guardrails** | Qualified language only ("based on your inputs..."), no imperatives |
| **SEBI Disclaimer** | Full mandatory disclaimer on every output screen |
| **Audit trail** | "How we calculated this" panel — every agent call, tool call, model decision visible |

---

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 3. Run the app
npm run dev

# Open http://localhost:3000
```

---

## 📊 Impact Quantification

| Metric | Value | Assumption |
|--------|-------|------------|
| **Addressable users** | 4 crore | Literate smartphone users within ET's user base |
| **Advisory cost displaced** | ₹60,000 Cr/year | 4Cr users × ₹15K/year RIA fee |
| **ET revenue potential** | ₹800 Cr/year | 2Cr MAU × ₹400/user ad + affiliate revenue |
| **Aggregate tax savings** | ₹9,000 Cr | 50L users × ₹30K avg missed deductions |
| **GCP cost** | < $70 total | Sustainable within $5,000 credits |

---

## 🔧 Tech Stack

- **Frontend:** React 19 + TypeScript, Tailwind CSS v4, Recharts, Framer Motion
- **Backend:** Express + Vite dev server, deterministic calculation engines
- **AI:** Gemini 3.1 Pro (Vertex AI), Gemini 3 Flash, Gemini 2.5 Flash
- **Data:** CASParser API (CAMS PDF), mfapi.in (NAV history)
- **Design:** Custom navy + gold design system, JetBrains Mono for financial data

---

## 📄 License

MIT — Built for ET AI Hackathon 2026 | Track 9

**ArthaGPT — Your money. Finally understood.**
