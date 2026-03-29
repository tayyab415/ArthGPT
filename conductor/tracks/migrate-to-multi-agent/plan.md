# Implementation Plan: Migrate to Multi-Agent

## Phase 1: Establish Agent Tools & Roles
1. **Define Tools**: Create explicit tool definitions for the orchestrator to call (e.g., `calculateTrueXirr`, `getOverlapData`, `generateRebalancingPlan`).
2. **Setup Output Schemas**: Define Zod or JSON schemas for the structured outputs expected from each sub-agent.

## Phase 2: Refactor `/api/analyze-portfolio` Endpoint
1. Initialize the **Orchestrator Agent**. Give it the system prompt defining its role.
2. Replace the monolithic prompt with a sequence of agent calls or a system that allows the orchestrator to use tool calling to dispatch work to sub-agents.
   - Orchestrator requests XIRR and overlap analysis from the **Portfolio Agent**.
   - Orchestrator passes that output to the **Rebalancing Agent** for actionable advice.
   - Orchestrator sends all raw data to the **Narrative/Output Agent** to generate the final JSON payload.

## Phase 3: Validation and Integration
1. Validate that the new multi-agent flow returns the exact same JSON structure expected by the frontend.
2. Update the `fallback/mock` response in case of API failure.
3. Verify latency and add error handling for individual sub-agent failures.