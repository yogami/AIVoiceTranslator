/**
 * Session Classification Interface
 * 
 * Defines the contract for session quality classification.
 * Follows Single Responsibility Principle - only handles classification logic.
 */

export interface SessionQuality {
  isReal: boolean;
  reason: 'no_students' | 'no_activity' | 'too_short' | 'real';
  studentsCount: number;
  totalTranslations: number;
  duration: number; // in milliseconds
  transcriptCount: number;
}

export interface ClassificationResult {
  classified: number;
  realSessions: number;
  deadSessions: number;
}

export interface ISessionClassifier {
  /**
   * Classify a single session based on its metrics
   * @param session Session data
   * @param transcriptCount Number of transcripts for this session
   * @returns SessionQuality classification
   */
  classifySession(session: any, transcriptCount: number): SessionQuality;

  /**
   * Generate human-readable quality reason text
   * @param classification Session quality classification
   * @returns Human-readable description
   */
  getQualityReasonText(classification: SessionQuality): string;

  /**
   * Classify multiple dead sessions for analytics
   * @param limit Maximum number of sessions to process
   * @returns Promise<ClassificationResult>
   */
  classifyDeadSessions(limit?: number): Promise<ClassificationResult>;
} 