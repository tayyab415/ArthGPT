# ArthaGPT Product Definition

## Vision
ArthaGPT aims to be India's first multi-agent AI financial advisor — free, instant, and built for every Indian. It democratizes financial advice by replacing human advisors with a sophisticated Multi-Agent System.

## The Problem
95% of Indians have no financial plan. Currently, the system uses a single zero-shot prompt to Gemini 3.1 Pro for portfolio analysis, which fails to live up to the multi-agent orchestration advertised in the evaluation rubric.

## Solution Architecture (Target State)
A true Multi-Agent System featuring:
- **Orchestrator**: Routes requests, manages session, injects guardrails.
- **Portfolio Agent**: XIRR calculation, overlap mapping, rebalancing.
- **FIRE Agent**: Corpus target, SIP back-calculation, glidepath.
- **Tax Agent**: Slab engine, HRA minimums, regime comparisons.
- **Output Agents**: Narrative (Flash) and formatting.

## Current State Analysis
The codebase in `server.ts` handles the entire portfolio analysis payload via a single monolithic prompt, producing a massive JSON object. This violates the 50% evaluation rubric weight on "Autonomy Depth" and "Multi-Agent Design".

We must migrate from this monolithic approach to a true orchestrator/sub-agent pattern.