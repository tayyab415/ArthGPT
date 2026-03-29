import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-2.5-flash';

// ═══════════════════════════════════════════════════════════════════════════
// Intent Types
// ═══════════════════════════════════════════════════════════════════════════

export type Intent =
  | { type: 'portfolio'; query: string }
  | { type: 'tax'; query: string }
  | { type: 'fire'; query: string }
  | { type: 'multi'; intents: Intent[]; query: string }
  | { type: 'unknown'; query: string };

// ═══════════════════════════════════════════════════════════════════════════
// Intent Classification via Gemini 2.5 Flash
// ═══════════════════════════════════════════════════════════════════════════

const CLASSIFICATION_PROMPT = `You are an intent classifier for ArthaGPT, an Indian personal finance assistant.
Classify the user's query into one of these categories:

- "portfolio": Questions about mutual funds, SIP, NAV, XIRR, portfolio analysis, fund overlap, rebalancing, investments, expense ratios
- "tax": Questions about income tax, 80C, deductions, tax regime (old/new), HRA, salary structure, Form 16, NPS, tax saving
- "fire": Questions about retirement, FIRE (Financial Independence Retire Early), corpus, pension, SWR (safe withdrawal rate), drawdown, financial independence, retirement planning
- "multi": When the query clearly spans multiple domains (e.g. "How does my portfolio affect my FIRE plan?" or "What tax impact does rebalancing have?")
- "unknown": Greetings, off-topic questions, unclear queries

For "multi" type, also identify the sub-intents (which domains the query touches).

User query: `;

interface ClassificationResult {
  type: string;
  query: string;
  subIntents?: string[];
}

/**
 * Classify a user's natural language message into a financial domain intent.
 * Uses Gemini 2.5 Flash for fast structured classification.
 */
export async function classifyIntent(userMessage: string): Promise<Intent> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: CLASSIFICATION_PROMPT + userMessage,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'The classified intent type: portfolio, tax, fire, multi, or unknown',
          },
          query: {
            type: Type.STRING,
            description: 'The original user query',
          },
          subIntents: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'For multi-intent queries, the list of sub-intent types (e.g. ["portfolio", "fire"])',
          },
        },
        required: ['type', 'query'],
      },
    },
  });

  const result: ClassificationResult = JSON.parse(response.text || '{}');

  // Normalize the type to one of our known values
  const normalizedType = normalizeIntentType(result.type);

  if (normalizedType === 'multi' && Array.isArray(result.subIntents) && result.subIntents.length > 0) {
    const subIntents: Intent[] = result.subIntents
      .map((sub) => normalizeIntentType(sub))
      .filter((t): t is 'portfolio' | 'tax' | 'fire' => ['portfolio', 'tax', 'fire'].includes(t))
      .map((t) => ({ type: t, query: userMessage }));

    return {
      type: 'multi',
      intents: subIntents.length > 0 ? subIntents : [{ type: 'unknown', query: userMessage }],
      query: userMessage,
    };
  }

  if (normalizedType === 'portfolio' || normalizedType === 'tax' || normalizedType === 'fire') {
    return { type: normalizedType, query: userMessage };
  }

  return { type: 'unknown', query: userMessage };
}

function normalizeIntentType(raw: string | undefined): string {
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase().trim();
  if (lower === 'portfolio') return 'portfolio';
  if (lower === 'tax') return 'tax';
  if (lower === 'fire') return 'fire';
  if (lower === 'multi') return 'multi';
  return 'unknown';
}
