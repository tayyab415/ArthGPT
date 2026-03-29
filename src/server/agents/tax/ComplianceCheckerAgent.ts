import { LlmAgent } from '../core/Agent';
import { SessionState, type TaxSessionState, type ComplianceViolation } from '../core/SessionState';
import { checkCompliance, MODELS } from '../utils/gemini';

/**
 * Stage 4A: Compliance Checker Agent
 * 
 * Scans the tax optimization narrative for compliance violations:
 * - Promises of specific returns or outcomes
 * - Language that constitutes licensed financial advice
 * - Missing disclaimers
 * - Incorrect tax rates for FY 2025-26
 * - Language suggesting execution of trades/filings
 * 
 * Outputs 'CLEAN' or a list of specific violations.
 * Writes to session_state.compliance_status.
 */
export class ComplianceCheckerAgent extends LlmAgent<TaxSessionState> {
  constructor() {
    super('ComplianceChecker', 4, MODELS.FLASH);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const optimization = state.get('tax_optimization');
    const explicitNarrative = state.get('compliance_target_narrative' as keyof TaxSessionState) as string | undefined;
    const complianceContext = ((state.get('compliance_context' as keyof TaxSessionState) as string | undefined) || 'tax') as 'tax' | 'fire' | 'generic';
    
    if (!optimization) {
      throw new Error('No tax_optimization found. TaxOptimizer must run first.');
    }

    console.log(`[Agent: ${this.name}] Scanning for compliance violations...`);

    // Build the full narrative to check
    const narrative = explicitNarrative || optimization.narrative;
    
    let result: 'CLEAN' | ComplianceViolation[];

    try {
      // Use Gemini to check for compliance issues
      const llmResult = await checkCompliance(narrative, { context: complianceContext });
      // Normalize LLM result to full ComplianceViolation type
      if (llmResult === 'CLEAN') {
        result = 'CLEAN';
      } else {
        result = llmResult.map(v => ({
          type: v.type,
          location: '',
          description: v.description,
          severity: 'warning' as const,
        }));
      }
    } catch {
      // Fallback: do simple keyword-based compliance check
      console.log(`[Agent: ${this.name}] LLM unavailable, using keyword-based check`);
      result = this.keywordBasedCheck(narrative, complianceContext);
    }

    if (result === 'CLEAN') {
      console.log(`[Agent: ${this.name}] Status: CLEAN - No violations found`);
      state.set('compliance_status', 'CLEAN');
    } else {
      const violations = result as ComplianceViolation[];
      console.log(`[Agent: ${this.name}] Found ${violations.length} violation(s):`);
      for (const v of violations) {
        console.log(`  - ${v.type}: ${v.description}`);
      }
      state.set('compliance_status', violations);
    }
  }

  /**
   * Fallback keyword-based compliance check when LLM unavailable
   */
  private keywordBasedCheck(
    narrative: string,
    context: 'tax' | 'fire' | 'generic',
  ): 'CLEAN' | ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const lowerNarrative = narrative.toLowerCase();

    // Check for prohibited phrases
    const prohibitedPhrases = [
      { pattern: /guarante/i, type: 'GUARANTEE' as const },
      { pattern: /you (will|shall) (save|earn|get)/i, type: 'PROMISE' as const },
      { pattern: /definitely/i, type: 'PROMISE' as const },
      { pattern: /100%|100 percent/i, type: 'GUARANTEE' as const },
      { pattern: /invest now|buy now|act now/i, type: 'ADVICE' as const },
    ];

    for (const { pattern, type } of prohibitedPhrases) {
      if (pattern.test(lowerNarrative)) {
        violations.push({
          type,
          location: narrative.slice(0, 100),
          description: `Narrative contains language that may constitute ${type.toLowerCase()} of returns`,
          severity: 'warning',
        });
      }
    }

    if (
      context === 'fire'
      && !/(probab|chance|scenario|range|percentile|uncertain)/i.test(lowerNarrative)
    ) {
      violations.push({
        type: 'PROBABILITY_FRAMING',
        location: narrative.slice(0, 100),
        description: 'Retirement outcomes should be framed as probabilities or scenarios, not certainty.',
        severity: 'warning',
      });
    }

    return violations.length > 0 ? violations : 'CLEAN';
  }
}
