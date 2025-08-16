import { describe, it, expect, vi } from 'vitest';
import { ACEOrchestrator } from '../../../server/application/services/ace/ACEOrchestrator';

describe('ACEOrchestrator', () => {
  it('tracks comprehension signals within a window and triggers slow repeat', () => {
    const ace = new ACEOrchestrator({ confusionWindowMs: 10000, confusionThreshold: 0.15 });
    const now = Date.now();
    const sessionId = 's1';
    for (let i = 0; i < 1; i++) ace.recordComprehensionSignal(sessionId, 'need_slower', now);
    expect(ace.shouldTriggerSlowRepeat(sessionId, now + 1000, 10)).toBe(false);
    for (let i = 0; i < 2; i++) ace.recordComprehensionSignal(sessionId, 'confused', now + 2000);
    expect(ace.shouldTriggerSlowRepeat(sessionId, now + 3000, 10)).toBe(true);
  });
});



