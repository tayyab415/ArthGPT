# Specification: Migrate to Multi-Agent

## Objective
Refactor the `/api/analyze-portfolio` endpoint in `server.ts` to implement a true Multi-Agent System. The current implementation relies on a single zero-shot prompt to Gemini 3.1 Pro, which does not satisfy the "Autonomy Depth" and "Multi-Agent Design" criteria of the evaluation rubric.

## Current State
- `server.ts` accepts an array of funds and a risk profile.
- It sends the entire payload in one prompt to `gemini-3.1-pro-preview`.
- The prompt explicitly asks the model to return a massive JSON structure representing the entire portfolio analysis (XIRR, expense drag, overlapping stocks, and a rebalancing plan).

## Target State
Implement an orchestrator pattern with specialized agents:
1. **Orchestrator Agent**: Receives the user request, breaks it down, and delegates tasks to sub-agents.
2. **Portfolio Analysis Agent**: Focuses strictly on the math and overlaps (e.g., true XIRR, overlapping stocks).
3. **Rebalancing Agent**: Generates the rebalancing plan based on the output of the Portfolio Analysis Agent and the user's risk profile.
4. **Narrative/Output Agent**: Takes the outputs from the specialized agents and formats them into the final JSON response expected by the frontend.

## Constraints
- Do not break the API contract expected by the frontend.
- Ensure deterministic operations (like tax and FIRE calculations) remain outside the LLM scope where appropriate, or are integrated properly as tools if an agent needs them.