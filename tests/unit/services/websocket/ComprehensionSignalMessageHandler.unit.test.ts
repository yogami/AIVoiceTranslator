import { describe, it, expect } from 'vitest';

describe.skip('ComprehensionSignalMessageHandler (London school ATDD)', () => {
  it('registers and no-ops safely', async () => {
    const { ComprehensionSignalMessageHandler } = await import('../../../../server/interface-adapters/websocket/websocket-services/ComprehensionSignalMessageHandler');
    const handler = new ComprehensionSignalMessageHandler();
    expect(handler.getMessageType()).toBe('comprehension_signal');
    await handler.handle({ type: 'comprehension_signal', level: 'confused' } as any, {} as any);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Mock feature flags so tests don't depend on process.env re-import semantics
vi.mock('../../../../server/application/services/config/FeatureFlags', () => ({
  FeatureFlags: { LIVE_COMPREHENSION_INDICATORS: true }
}));
import { ComprehensionSignalMessageHandler } from '../../../../server/interface-adapters/websocket/websocket-services/ComprehensionSignalMessageHandler';

describe.skip('ComprehensionSignalMessageHandler (London school ATDD)', () => {
  let handler: ComprehensionSignalMessageHandler;
  let context: any;
  let teacherWs: any;
  let studentWs: any;

  beforeEach(async () => {
    // Reset mocked flag to enabled (ESM-friendly dynamic import)
    const featureModule = await import('../../../../server/application/services/config/FeatureFlags');
    featureModule.FeatureFlags.LIVE_COMPREHENSION_INDICATORS = true as any;
    handler = new ComprehensionSignalMessageHandler();
    teacherWs = { sent: [] as any[], send: function (d: string) { this.sent.push(JSON.parse(d)); } };
    studentWs = { sent: [] as any[], send: function (d: string) { this.sent.push(JSON.parse(d)); } };

    const connections = new Set<any>();
    connections.add(teacherWs);
    connections.add(studentWs);

    const roles = new Map<any, string>([[teacherWs, 'teacher'], [studentWs, 'student']]);
    const sessions = new Map<any, string>([[teacherWs, 'sess1'], [studentWs, 'sess1']]);
    const settings = new Map<any, any>([[studentWs, { allowComprehensionSignals: true }]]);

    context = {
      ws: studentWs,
      connectionManager: {
        getConnections: () => connections,
        getRole: (ws: any) => roles.get(ws),
        getSessionId: (ws: any) => sessions.get(ws),
        getClientSettings: (ws: any) => settings.get(ws) || {},
      }
    };
  });

  it('dispatches comprehension_signal from student to teacher when feature enabled', async () => {
    await handler.handle({ type: 'comprehension_signal', signal: 'need_slower' } as any, context);
    expect(teacherWs.sent.length).toBe(1);
    expect(teacherWs.sent[0].type).toBe('comprehension_signal');
    expect(teacherWs.sent[0].signal).toBe('need_slower');
  });

  it('does nothing when feature flag disabled', async () => {
    const featureModule = await import('../../../../server/application/services/config/FeatureFlags');
    featureModule.FeatureFlags.LIVE_COMPREHENSION_INDICATORS = false as any;
    await handler.handle({ type: 'comprehension_signal', signal: 'confused' } as any, context);
    expect(teacherWs.sent.length).toBe(0);
  });

  it('does nothing when sender is not student', async () => {
    const teacherContext = { ...context, ws: teacherWs };
    await handler.handle({ type: 'comprehension_signal', signal: 'ok' } as any, teacherContext);
    expect(teacherWs.sent.length).toBe(0);
  });
});


