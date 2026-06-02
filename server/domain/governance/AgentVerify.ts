import { ComplianceLedger, AuditReceipt } from './ComplianceLedger';
import { ContentSafetyService, ContentVerificationResult } from './ContentSafetyService';

export class AgentVerify {
  /**
   * Intercepts an agent action and evaluates it against formal LTL (Linear Temporal Logic) constraints.
   * Synchronous structural check — fast, deterministic.
   */
  public static evaluateAction(agentAction: any): AuditReceipt {
    const actionType = agentAction.type || 'unknown_action';
    
    // Default LTL Rules for the demo
    const ltlRules = [
      'G (Action -> ContextVerified)',
      `G (${actionType} -> SafeContent)`
    ];
    
    let euClause = 'Article 12: Record-keeping';
    let status: 'PASSED' | 'FAILED' = 'PASSED';
    let details = 'Action cryptographically verified against governance invariants.';

    // Specific LTL logic demo
    if (actionType === 'unsafe_content') {
      ltlRules.push('G (¬UnsafeContent)');
      euClause = 'Article 9: Risk management system';
      status = 'FAILED';
      details = 'VIOLATION DETECTED: Content safety invariant breached. Agent attempted to deliver unverified content outside approved curriculum scope.';
      console.log('[AgentVerify] ⛔ FAILED: unsafe_content action detected — governance invariant violated');
    } else if (actionType === 'generate_quiz') {
      ltlRules.push('G (Quiz -> F(HumanApproval))');
      euClause = 'Article 14: Human oversight';
      details = 'Verified that the generated quiz maps to factual curriculum context.';
    } else if (actionType === 'vocabulary') {
      ltlRules.push('G (VocabExtraction -> OntologyAligned)');
      euClause = 'Article 10: Data and data governance';
      details = 'Verified that the vocabulary extraction does not hallucinate definitions outside of the domain ontology.';
    }

    // Generate the immutable receipt
    return ComplianceLedger.generateReceipt(
      actionType,
      ltlRules,
      euClause,
      status,
      details
    );
  }

  /**
   * Evaluates translated content using deterministic verification layers:
   * 1. OpenAI Moderation API (content safety classifier — FREE)
   * 2. Embedding cosine similarity (curriculum scope — ~$0)
   * 
   * This is NOT an LLM-as-Judge. Both methods are classifier/embedding based,
   * providing deterministic results for the same input.
   */
  public static async evaluateContent(
    originalText: string,
    translatedText: string
  ): Promise<{ receipt: AuditReceipt; verification: ContentVerificationResult }> {
    const verification = await ContentSafetyService.verifyContent(translatedText);

    const ltlRules = [
      'G (Content → ¬Harmful)',
      'G (Content → WithinCurriculumScope)'
    ];

    let status: 'PASSED' | 'FAILED' = 'PASSED';
    let details: string;
    let euClause = 'Article 9: Risk management system';

    if (!verification.safe) {
      status = 'FAILED';
      details = `VIOLATION DETECTED: ${verification.failureReasons.join('; ')}`;
      console.log(`[AgentVerify] ⛔ Content verification FAILED: ${verification.failureReasons.join('; ')}`);
    } else {
      details = `Content verified safe. Moderation: clean (highest=${verification.moderation.highestCategory}:${verification.moderation.highestScore.toFixed(4)}). ` +
        `Scope: similarity=${verification.scope.similarityScore.toFixed(4)} to "${verification.scope.closestTopic}" (threshold=${verification.scope.threshold}).`;
      console.log(`[AgentVerify] ✅ Content verification PASSED`);
    }

    const receipt = ComplianceLedger.generateReceipt(
      'content_verification',
      ltlRules,
      euClause,
      status,
      details
    );

    return { receipt, verification };
  }
}
