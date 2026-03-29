import { LlmAgent } from '../core/Agent';
import { SessionState, type TaxSessionState, type ComplianceViolation } from '../core/SessionState';
import { injectDisclaimer, MODELS } from '../utils/gemini';

const STANDARD_DISCLAIMER = `This is AI-generated educational guidance for informational purposes only. It is not professional tax or financial advice. Tax laws change frequently — please consult a qualified tax advisor or CA for your specific situation. Past tax savings are not guaranteed in future years.`;
const FIRE_STANDARD_DISCLAIMER = `This is AI-generated educational guidance for informational purposes only. Monte Carlo simulations express probability, not certainty. Actual market conditions may differ materially. It is not professional financial advice. Consult a SEBI-registered investment advisor before making financial decisions.`;

/**
 * Stage 4B: Disclaimer Injector Agent
 * 
 * If compliance_status is 'CLEAN', passes the narrative through unchanged.
 * If violations found, rewrites the flagged sections to be compliant
 * and adds the SEBI disclaimer.
 * 
 * Writes to session_state.compliant_narrative.
 */
export class DisclaimerInjectorAgent extends LlmAgent<TaxSessionState> {
  constructor() {
    super('DisclaimerInjector', 4, MODELS.FLASH);
  }

  protected async run(state: SessionState<TaxSessionState>): Promise<void> {
    const optimization = state.get('tax_optimization');
    const complianceStatus = state.get('compliance_status');
    const explicitNarrative = state.get('compliance_target_narrative' as keyof TaxSessionState) as string | undefined;
    const complianceContext = ((state.get('compliance_context' as keyof TaxSessionState) as string | undefined) || 'tax') as 'tax' | 'fire' | 'generic';
    const customDisclaimer = state.get('compliance_disclaimer' as keyof TaxSessionState) as string | undefined;
    
    if (!optimization) {
      throw new Error('No tax_optimization found. TaxOptimizer must run first.');
    }
    
    if (complianceStatus === undefined) {
      throw new Error('No compliance_status found. ComplianceChecker must run first.');
    }

    console.log(`[Agent: ${this.name}] Processing narrative for compliance...`);
    const narrative = explicitNarrative || optimization.narrative;
    const standardDisclaimer = customDisclaimer || (complianceContext === 'fire' ? FIRE_STANDARD_DISCLAIMER : STANDARD_DISCLAIMER);

    if (complianceStatus === 'CLEAN') {
      // No violations - just ensure disclaimer is present
      console.log(`[Agent: ${this.name}] Narrative is compliant. Adding standard disclaimer.`);
      
      const compliantNarrative = narrative.includes('AI-generated')
        ? narrative
        : `${narrative}\n\n📋 **Disclaimer:** ${standardDisclaimer}`;
      
      state.set('compliant_narrative', compliantNarrative);
    } else {
      // Violations found - rewrite the narrative
      const violations = complianceStatus as ComplianceViolation[];
      console.log(`[Agent: ${this.name}] Rewriting narrative to fix ${violations.length} violation(s)...`);
      
      let compliantNarrative: string;

      try {
        compliantNarrative = await injectDisclaimer(
          narrative,
          violations.map(v => ({ type: v.type, description: v.description })),
          {
            context: complianceContext,
            disclaimer: standardDisclaimer,
          },
        );
      } catch {
        // Fallback: simple disclaimer injection without rewriting
        console.log(`[Agent: ${this.name}] LLM unavailable, using simple disclaimer injection`);
        compliantNarrative = `${narrative}\n\n📋 **Disclaimer:** ${standardDisclaimer}\n\n⚠️ Some content in this analysis may require verification with a qualified professional.`;
      }
      
      state.set('compliant_narrative', compliantNarrative);
      
      // Update compliance status after fix
      state.set('compliance_status', 'CLEAN');
    }

    console.log(`[Agent: ${this.name}] Compliant narrative generated.`);
  }
}
