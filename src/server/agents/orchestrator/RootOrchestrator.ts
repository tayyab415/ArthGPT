import { classifyIntent, type Intent } from './intentClassifier';

// ═══════════════════════════════════════════════════════════════════════════
// Root Orchestrator — Routes NL queries to the correct pipeline
// ═══════════════════════════════════════════════════════════════════════════

export interface OrchestratorResponse {
  intent: Intent;
  pipeline: string; // 'portfolio' | 'tax' | 'fire' | 'multi' | 'unknown'
  suggestedInputs?: Record<string, unknown>;
  message: string; // Natural language response explaining what will happen
}

/**
 * Orchestrate a user's natural language query:
 * 1. Classify the intent via Gemini Flash
 * 2. Generate a friendly response message
 * 3. Return the pipeline name for frontend tab switching
 *
 * @param context - Optional plain object with cross-pipeline data
 *                  (avoids importing React context on the server)
 */
export async function orchestrate(
  userMessage: string,
  context?: Record<string, unknown>
): Promise<OrchestratorResponse> {
  const intent = await classifyIntent(userMessage);

  const pipeline = intent.type;
  let message: string;

  switch (intent.type) {
    case 'portfolio':
      message = "I'll analyze your mutual fund portfolio with our 6-agent X-Ray pipeline — covering XIRR, overlap detection, expense analysis, benchmarking, and rebalancing recommendations.";
      break;
    case 'tax':
      message = "Let me run the Tax Wizard to optimize your tax strategy — I'll compare both regimes, find missed deductions, and generate SEBI-compliant recommendations.";
      break;
    case 'fire':
      message = "I'll build your FIRE roadmap with Monte Carlo simulations — including SIP glidepath, insurance gap analysis, and a comprehensive retirement plan.";
      break;
    case 'multi': {
      const first = intent.intents[0];
      const firstLabel = first ? pipelineLabel(first.type) : 'analysis';
      message = `This touches multiple areas. I'll start with ${firstLabel} and connect the insights across pipelines.`;
      break;
    }
    case 'unknown':
    default:
      message = "I can help with portfolio analysis, tax optimization, or retirement planning. Which would you like to explore?";
      break;
  }

  // If context has relevant data from previous pipeline runs, mention it
  if (context) {
    if (context.portfolioXirr !== undefined && (intent.type === 'portfolio' || intent.type === 'fire')) {
      message += " I see you've already run Portfolio X-Ray — I'll use those results.";
    }
    if (context.taxRegime !== undefined && (intent.type === 'tax' || intent.type === 'fire')) {
      message += " Your tax analysis is available — I'll factor that in.";
    }
    if (context.fireSuccessProbability !== undefined && intent.type === 'fire') {
      message += " Previous FIRE simulation data is available for comparison.";
    }
  }

  return {
    intent,
    pipeline,
    suggestedInputs: undefined,
    message,
  };
}

function pipelineLabel(type: string): string {
  switch (type) {
    case 'portfolio': return 'Portfolio X-Ray';
    case 'tax': return 'Tax Wizard';
    case 'fire': return 'FIRE Roadmap';
    default: return 'analysis';
  }
}
