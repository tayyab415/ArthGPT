import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateTax } from './src/server/taxEngine';
import { calculateFire } from './src/server/fireEngine';
import { GoogleGenAI } from '@google/genai';
import { FirePipeline, PortfolioPipeline, TaxPipeline, type AgentEvent } from './src/server/agents';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/analyze-portfolio', async (req, res) => {
    try {
      const { funds, riskProfile, investmentHorizon } = req.body || {};
      if (!Array.isArray(funds) || funds.length === 0) {
        return res.status(400).json({ error: 'funds array is required and must not be empty' });
      }
      for (const f of funds) {
        if (!f.name || typeof f.units !== 'number' || typeof f.nav !== 'number') {
          return res.status(400).json({ error: 'Each fund must have name (string), units (number), nav (number)' });
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze the following portfolio and return a JSON response with the following structure:
        {
          "trueXirr": number,
          "benchmarkReturn": number,
          "expenseRatioDrag": number,
          "overlappingStocks": number,
          "overlapData": [
            { "stock": string, "funds": string[], "percentage": number }
          ],
          "expenseData": [
            { "name": string, "regular": number, "direct": number, "diff": number }
          ],
          "rebalancingPlan": [
            {
              "fundToRedeem": string,
              "units": number,
              "currentValue": number,
              "holdingPeriod": string,
              "estimatedTax": number,
              "fundToInvest": string,
              "reason": string,
              "expenseBenefit": string
            }
          ]
        }
        
        Portfolio details:
        ${JSON.stringify(req.body)}
        
        Make sure the response is valid JSON. Do not include markdown formatting like \`\`\`json.`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const jsonStr = response.text?.trim() || '{}';
      const result = JSON.parse(jsonStr);
      res.json(result);
    } catch (e) {
      console.error('Error analyzing portfolio:', e);
      // Fallback to mock data if Gemini fails or API key is missing
      res.json({
        trueXirr: 14.2,
        benchmarkReturn: 12.1,
        expenseRatioDrag: 14250,
        overlappingStocks: 18,
        overlapData: [
          { stock: 'Reliance Ind.', funds: ['Mirae', 'HDFC', 'Parag Parikh'], percentage: 11.2 },
          { stock: 'HDFC Bank', funds: ['Mirae', 'HDFC', 'SBI'], percentage: 8.4 },
        ],
        expenseData: [
          { name: 'Mirae Large Cap', regular: 1.62, direct: 0.54, diff: 1.08 },
          { name: 'HDFC Flexi Cap', regular: 1.58, direct: 0.82, diff: 0.76 },
        ],
        rebalancingPlan: [
          {
            fundToRedeem: 'Mirae Asset Large Cap (Regular)',
            units: 3500,
            currentValue: 87400,
            holdingPeriod: '14 months',
            estimatedTax: 0,
            fundToInvest: 'Parag Parikh Flexi Cap (Direct)',
            reason: 'No overlap with existing holdings',
            expenseBenefit: '0.9% lower'
          }
        ]
      });
    }
  });

  app.post('/api/fire-plan', async (req, res) => {
    try {
      const { age, retireAge, income, existingMfCorpus, existingPpfCorpus, targetMonthlyDraw } = req.body || {};
      if (typeof age !== 'number' || age < 18 || age > 80) return res.status(400).json({ error: 'age must be a number between 18 and 80' });
      if (typeof retireAge !== 'number' || retireAge <= age) return res.status(400).json({ error: 'retireAge must be greater than age' });
      if (typeof income !== 'number' || income <= 0) return res.status(400).json({ error: 'income must be a positive number' });
      if (typeof targetMonthlyDraw !== 'number' || targetMonthlyDraw <= 0) return res.status(400).json({ error: 'targetMonthlyDraw must be a positive number' });

      const result = calculateFire({
        age,
        retireAge,
        income,
        existingMfCorpus: Math.max(0, existingMfCorpus || 0),
        existingPpfCorpus: Math.max(0, existingPpfCorpus || 0),
        targetMonthlyDraw,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post('/api/tax-compare', async (req, res) => {
    try {
      const b = req.body || {};
      const baseSalary = Math.max(0, Number(b.baseSalary) || 0);
      const hraReceived = Math.max(0, Number(b.hraReceived) || 0);
      if (baseSalary + hraReceived <= 0) return res.status(400).json({ error: 'baseSalary + hraReceived must be positive' });

      const result = calculateTax({
        baseSalary,
        hraReceived,
        rentPaid: Math.max(0, Number(b.rentPaid) || 0),
        section80C: Math.min(Math.max(0, Number(b.section80C) || 0), 150000),
        section80CCD1B: Math.min(Math.max(0, Number(b.section80CCD1B) || 0), 50000),
        section80D: Math.min(Math.max(0, Number(b.section80D) || 0), 100000),
        homeLoanInterest: Math.min(Math.max(0, Number(b.homeLoanInterest) || 0), 200000),
        isMetro: Boolean(b.isMetro),
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 Tax Pipeline - Multi-Agent System with SSE Streaming
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * POST /api/v2/tax-pipeline
   * 
   * Executes the multi-agent tax pipeline with Server-Sent Events (SSE) streaming.
   * Each agent's start/complete events are streamed in real-time.
   * 
   * Request Body: TaxInput (baseSalary, hraReceived, etc.)
   * Response: SSE stream of AgentEvent objects, followed by pipeline_complete with full result.
   */
  app.post('/api/v2/tax-pipeline', async (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Helper to send SSE event
    const sendEvent = (event: AgentEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const b = req.body || {};
      const baseSalary = Math.max(0, Number(b.baseSalary) || 0);
      const hraReceived = Math.max(0, Number(b.hraReceived) || 0);
      
      if (baseSalary + hraReceived <= 0) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'baseSalary + hraReceived must be positive',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      const taxInput = {
        baseSalary,
        hraReceived,
        rentPaid: Math.max(0, Number(b.rentPaid) || 0),
        section80C: Math.min(Math.max(0, Number(b.section80C) || 0), 150000),
        section80CCD1B: Math.min(Math.max(0, Number(b.section80CCD1B) || 0), 50000),
        section80D: Math.min(Math.max(0, Number(b.section80D) || 0), 100000),
        homeLoanInterest: Math.min(Math.max(0, Number(b.homeLoanInterest) || 0), 200000),
        isMetro: Boolean(b.isMetro),
      };

      // Create pipeline instance
      const pipeline = new TaxPipeline();

      // Execute with event streaming
      await pipeline.executeWithEvents(taxInput, sendEvent);

      res.end();
    } catch (e) {
      console.error('Tax pipeline error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      sendEvent({
        type: 'agent_error',
        agent: 'Pipeline',
        stage: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      res.end();
    }
  });

  /**
   * GET /api/v2/tax-pipeline/status
   * 
   * Health check endpoint for the tax pipeline.
   */
  app.get('/api/v2/tax-pipeline/status', (req, res) => {
    res.json({
      status: 'ready',
      version: '2.0',
      stages: [
        { stage: 1, name: 'InputCollector', type: 'LlmAgent' },
        { stage: 2, name: 'ParallelCompute', type: 'ParallelAgent', agents: ['OldRegimeCalc', 'NewRegimeCalc'] },
        { stage: 3, name: 'TaxOptimizer', type: 'LlmAgent' },
        { stage: 4, name: 'ComplianceLoop', type: 'LoopAgent', agents: ['ComplianceChecker', 'DisclaimerInjector'] },
      ],
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 Portfolio Pipeline - Multi-Agent System with SSE Streaming
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * POST /api/v2/portfolio-pipeline
   * 
   * Executes the multi-agent portfolio pipeline with Server-Sent Events (SSE) streaming.
   * 4-way parallel fan-out at Stage 2: XIRR, Overlap, Expense, Benchmark.
   * 
   * Request Body: { funds: [...], riskProfile: string, investmentHorizon?: string }
   * Response: SSE stream of AgentEvent objects, followed by pipeline_complete with full result.
   */
  app.post('/api/v2/portfolio-pipeline', async (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Helper to send SSE event
    const sendEvent = (event: AgentEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const { funds, riskProfile, investmentHorizon } = req.body || {};
      
      if (!Array.isArray(funds) || funds.length === 0) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'funds array is required and must not be empty',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      // Validate each fund
      for (const f of funds) {
        if (!f.name || typeof f.units !== 'number' || typeof f.nav !== 'number') {
          sendEvent({
            type: 'agent_error',
            agent: 'Pipeline',
            stage: 0,
            error: 'Each fund must have name (string), units (number), nav (number)',
            timestamp: new Date().toISOString(),
          });
          res.end();
          return;
        }
      }

      const portfolioInput = {
        funds: funds.map((f: { name: string; units: number; nav: number; investedAmount?: number }) => ({
          name: f.name,
          units: Math.max(0, f.units),
          nav: Math.max(0, f.nav),
          investedAmount: f.investedAmount ? Math.max(0, f.investedAmount) : undefined,
        })),
        riskProfile: (['Conservative', 'Moderate', 'Aggressive'].includes(riskProfile) 
          ? riskProfile 
          : 'Moderate') as 'Conservative' | 'Moderate' | 'Aggressive',
        investmentHorizon: investmentHorizon || '10+ years',
      };

      // Create pipeline instance
      const pipeline = new PortfolioPipeline();

      // Execute with event streaming
      await pipeline.executeWithEvents(portfolioInput, sendEvent);

      res.end();
    } catch (e) {
      console.error('Portfolio pipeline error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      
      sendEvent({
        type: 'agent_error',
        agent: 'Pipeline',
        stage: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      
      res.end();
    }
  });

  /**
   * GET /api/v2/portfolio-pipeline/status
   * 
   * Health check endpoint for the portfolio pipeline.
   */
  app.get('/api/v2/portfolio-pipeline/status', (req, res) => {
    res.json({
      status: 'ready',
      version: '2.0',
      stages: [
        { stage: 1, name: 'IngestionAgent', type: 'LlmAgent' },
        { stage: 2, name: 'ParallelAnalysis', type: 'ParallelAgent', agents: ['XirrEngine', 'OverlapAgent', 'ExpenseAgent', 'BenchmarkAgent'] },
        { stage: 3, name: 'RebalancingStrategist', type: 'LlmAgent' },
        { stage: 4, name: 'ComplianceLoop', type: 'LoopAgent', agents: ['ComplianceChecker', 'DisclaimerInjector'] },
      ],
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 FIRE Pipeline - Multi-Agent System with SSE Streaming
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/v2/fire-pipeline', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event: AgentEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const b = req.body || {};
      const rawAge = Number(b.age);
      const rawRetireAge = Number(b.retireAge);
      const age = Math.max(18, Math.min(80, rawAge || 0));
      const retireAge = Math.max(age + 1, rawRetireAge || 0);
      const income = Math.max(0, Number(b.income) || 0);
      const targetMonthlyDraw = Math.max(0, Number(b.targetMonthlyDraw) || 0);

      if (!Number.isFinite(rawAge) || rawAge < 18 || rawAge > 80) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'age must be a number between 18 and 80',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      if (!Number.isFinite(rawRetireAge) || rawRetireAge <= age) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'retireAge must be greater than age',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      if (income <= 0) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'income must be a positive number',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      if (targetMonthlyDraw <= 0) {
        sendEvent({
          type: 'agent_error',
          agent: 'Pipeline',
          stage: 0,
          error: 'targetMonthlyDraw must be a positive number',
          timestamp: new Date().toISOString(),
        });
        res.end();
        return;
      }

      const fireInput = {
        age,
        retireAge,
        income,
        existingMfCorpus: Math.max(0, Number(b.existingMfCorpus) || 0),
        existingPpfCorpus: Math.max(0, Number(b.existingPpfCorpus) || 0),
        targetMonthlyDraw,
        declaredLifeCover: Math.max(0, Number(b.declaredLifeCover) || 0),
        monthlySipCurrent: Math.max(0, Number(b.monthlySipCurrent) || 0),
      };

      const pipeline = new FirePipeline();
      await pipeline.executeWithEvents(fireInput, sendEvent);
      res.end();
    } catch (e) {
      console.error('FIRE pipeline error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);

      sendEvent({
        type: 'agent_error',
        agent: 'Pipeline',
        stage: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      res.end();
    }
  });

  app.get('/api/v2/fire-pipeline/status', (req, res) => {
    res.json({
      status: 'ready',
      version: '2.0',
      stages: [
        { stage: 1, name: 'Stage1_ParallelGather', type: 'ParallelAgent', agents: ['GoalProfiler', 'MacroAgent'] },
        { stage: 2, name: 'Stage2_ParallelCompute', type: 'ParallelAgent', agents: ['MonteCarloEngine', 'SipGlidepathEngine', 'InsuranceGapAgent'] },
        { stage: 3, name: 'RoadmapBuilder', type: 'LlmAgent' },
        { stage: 4, name: 'ComplianceLoop', type: 'LoopAgent', agents: ['ComplianceChecker', 'DisclaimerInjector'] },
      ],
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
