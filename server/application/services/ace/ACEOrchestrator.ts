import { ACESimplifier } from '../../../services/text/ACESimplifier';
import { TermLockingService, GlossaryMap } from '../../../services/text/TermLockingService';

export interface ACEOptions {
  glossary?: GlossaryMap;
  simplification?: {
    maxWordsPerSentence?: number;
  };
  confusionWindowMs?: number;
  confusionThreshold?: number; // e.g., 0.15
}

export interface PerStudentContext {
  lowLiteracyMode?: boolean;
  languageCode: string;
}

export class ACEOrchestrator {
  private readonly simplifier: ACESimplifier;
  private readonly termLocker: TermLockingService;
  private readonly windowMs: number;
  private readonly threshold: number;
  private static signalTimestamps: Map<string, number[]> = new Map(); // sessionId -> timestamps of confusion/need_slower

  constructor(private readonly options: ACEOptions = {}) {
    this.simplifier = new ACESimplifier(options.simplification);
    this.termLocker = new TermLockingService(options.glossary || {});
    this.windowMs = options.confusionWindowMs ?? 10000;
    this.threshold = options.confusionThreshold ?? 0.15;
  }

  applyPerStudentShaping(text: string, student: PerStudentContext): string {
    let shaped = text;
    // Simplify and chunk when low literacy is on (or if class confusion handled by caller)
    if (student.lowLiteracyMode) {
      shaped = this.simplifier.simplify(shaped);
    }
    // Term locking always applies if glossary provided
    shaped = this.termLocker.applyLockedTerms(shaped, student.languageCode);
    return shaped;
  }

  recordComprehensionSignal(sessionId: string, signal: string, ts: number = Date.now()): void {
    if (!['need_slower', 'confused'].includes(signal)) return;
    const list = ACEOrchestrator.signalTimestamps.get(sessionId) || [];
    list.push(ts);
    ACEOrchestrator.signalTimestamps.set(sessionId, list);
  }

  shouldTriggerSlowRepeat(sessionId: string, now: number = Date.now(), studentCount: number): boolean {
    if (studentCount <= 0) return false;
    const list = (ACEOrchestrator.signalTimestamps.get(sessionId) || []).filter(t => now - t <= this.windowMs);
    ACEOrchestrator.signalTimestamps.set(sessionId, list);
    const ratio = list.length / studentCount;
    return ratio >= this.threshold;
  }
}


