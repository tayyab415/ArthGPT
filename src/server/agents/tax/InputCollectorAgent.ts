import { LlmAgent } from '../core/Agent';
import { SessionState, type TaxSessionState, type SalaryStructure } from '../core/SessionState';
import { extractSalaryStructure, MODELS } from '../utils/gemini';

/**
 * Stage 1: Input Collector Agent
 * 
 * Takes the raw user payload and parses it into structured salary_structure.
 * Uses Gemini Flash for extraction with structured JSON output.
 * Falls back to direct passthrough if LLM is unavailable.
 */
export class InputCollectorAgent extends LlmAgent<TaxSessionState> {
  constructor() {
    super('InputCollector', 1, MODELS.FLASH);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const rawInput = state.get('raw_input');
    
    if (!rawInput) {
      throw new Error('No raw_input found in session state');
    }

    console.log(`[Agent: ${this.name}] Extracting salary structure from raw input...`);

    let salaryStructure: SalaryStructure;

    try {
      // Use Gemini to extract and validate salary structure
      salaryStructure = await extractSalaryStructure({
        baseSalary: rawInput.baseSalary,
        hraReceived: rawInput.hraReceived,
        rentPaid: rawInput.rentPaid,
        section80C: rawInput.section80C,
        section80CCD1B: rawInput.section80CCD1B,
        section80D: rawInput.section80D,
        homeLoanInterest: rawInput.homeLoanInterest,
        isMetro: rawInput.isMetro,
      });
    } catch (error) {
      // Fallback: pass through raw input directly
      console.log(`[Agent: ${this.name}] LLM unavailable, using direct passthrough`);
      salaryStructure = {
        baseSalary: rawInput.baseSalary || 0,
        hraReceived: rawInput.hraReceived || 0,
        rentPaid: rawInput.rentPaid || 0,
        section80C: Math.min(rawInput.section80C || 0, 150000),
        section80CCD1B: Math.min(rawInput.section80CCD1B || 0, 50000),
        section80D: Math.min(rawInput.section80D || 0, 75000),
        homeLoanInterest: Math.min(rawInput.homeLoanInterest || 0, 200000),
        isMetro: rawInput.isMetro ?? true,
        extractionConfidence: 'high',
        extractionNotes: 'Direct passthrough (LLM unavailable)',
      };
    }

    console.log(`[Agent: ${this.name}] Extracted salary structure:`, {
      grossSalary: salaryStructure.baseSalary + salaryStructure.hraReceived,
      deductions: {
        '80C': salaryStructure.section80C,
        '80CCD1B': salaryStructure.section80CCD1B,
        '80D': salaryStructure.section80D,
      },
      confidence: salaryStructure.extractionConfidence,
    });

    state.set('salary_structure', salaryStructure);
  }
}
