/**
 * PolicyViolationSimulator
 * 
 * Generates mock agent actions that violate governance policies.
 * Used for demo purposes to showcase the AgentVerify safety pipeline.
 */
export class PolicyViolationSimulator {
  /**
   * Generate a mock agent action that represents unsafe content.
   * This simulates an agent attempting to deliver unverified material
   * that breaches educational content safety standards.
   */
  public static generateViolation(): {
    type: string;
    payload: { content: string; category: string; severity: string };
  } {
    console.log('[PolicyViolationSimulator] Generating simulated policy violation for demo');
    return {
      type: 'unsafe_content',
      payload: {
        content: 'This content contains biased and inappropriate material that violates educational safety standards.',
        category: 'content_safety',
        severity: 'HIGH'
      }
    };
  }
}
