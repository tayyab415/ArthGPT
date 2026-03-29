# Plan: Root Orchestrator with Intent Classification

## Tasks

### Task 12: Root Orchestrator

**Files:**
- `src/server/agents/orchestrator/RootOrchestrator.ts` (new)
- `src/server/agents/orchestrator/intentClassifier.ts` (new)
- `server.ts` (modify — add orchestrator endpoint)
- `src/components/Dashboard.tsx` (modify — add natural language input)

**intentClassifier.ts:**
```typescript
export type Intent = 
  | { type: 'portfolio'; query: string }
  | { type: 'tax'; query: string }
  | { type: 'fire'; query: string }
  | { type: 'multi'; intents: Intent[] }
  | { type: 'unknown'; query: string };

// Use Gemini Flash for fast classification
export async function classifyIntent(userMessage: string): Promise<Intent>
```

**Implementation:**
1. Gemini Flash call with structured prompt:
   - "portfolio" keywords: fund, mutual fund, SIP, NAV, XIRR, portfolio, overlap, rebalance
   - "tax" keywords: tax, 80C, deduction, regime, HRA, salary, Form 16
   - "fire" keywords: retire, FIRE, corpus, pension, SWR, drawdown
   - Multi-intent: "How does my portfolio affect my FIRE plan?" → multi
2. Return classified intent with original query

**RootOrchestrator.ts:**
```typescript
export async function orchestrate(
  userMessage: string,
  context: CrossPipelineData
): Promise<OrchestratorResponse>

interface OrchestratorResponse {
  intent: Intent;
  pipeline: string;
  suggestedInputs?: Partial<FireInputs | TaxInputs | PortfolioInputs>;
  message: string; // Natural language response explaining what will happen
}
```

**Endpoint:** `POST /api/v2/orchestrate`
- Accepts `{ message: string }`
- Returns `OrchestratorResponse`
- Frontend uses response to auto-navigate to correct tab and pre-fill inputs

**Dashboard changes:**
1. Add text input at top: "Ask ArthGPT anything about your finances..."
2. On submit, call orchestrator
3. Auto-switch to correct tab based on intent
4. Show orchestrator's message as a banner
5. Pre-fill pipeline inputs if suggested

**Acceptance Criteria:**
- "Analyze my mutual funds" → routes to Portfolio tab
- "How much tax do I save with NPS?" → routes to Tax tab  
- "When can I retire?" → routes to FIRE tab
- Multi-intent detected and handled (sequential pipeline execution)
- Unknown intent gets helpful response suggesting available features
- Natural language input works on Dashboard
