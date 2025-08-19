import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StudentRequestMessageHandler - unit', () => {
  let handler: any;
  let context: any;
  let teacherWs: any;
  let studentWs: any;

  beforeEach(async () => {
    vi.resetModules();
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
    const mod = await import('../../../../server/interface-adapters/websocket/websocket-services/StudentRequestMessageHandler');
    handler = new mod.StudentRequestMessageHandler();

    teacherWs = { sent: [] as any[], send: vi.fn((s: string) => teacherWs.sent.push(JSON.parse(s))) };
    studentWs = { };

    const roles = new Map<any, string>([[teacherWs, 'teacher'], [studentWs, 'student']]);
    const sessionIds = new Map<any, string>([[teacherWs, 'S1'], [studentWs, 'S1']]);
    const settingsMap = new Map<any, any>([[studentWs, { twoWayEnabled: true }]]);

    context = {
      ws: studentWs,
      connectionManager: {
        getConnections: () => new Set([teacherWs, studentWs]),
        getRole: (ws: any) => roles.get(ws),
        getSessionId: (ws: any) => sessionIds.get(ws),
        getClientSettings: (ws: any) => settingsMap.get(ws),
        getLanguage: () => 'es-ES'
      },
      webSocketServer: { registerStudentRequest: vi.fn() },
    };
  });

  it('delivers student_request to teacher in same session', async () => {
    await handler.handle({ type: 'student_request', text: 'hola' } as any, context);
    // Allow any async retry to flush
    await new Promise(r => setTimeout(r, 120));
    const msg = teacherWs.sent.find((m: any) => m.type === 'student_request');
    expect(msg).toBeTruthy();
    expect(msg.payload.text).toBe('hola');
    expect(msg.payload.languageCode).toBe('es-ES');
  });

  it('does nothing when two-way disabled', async () => {
    // Re-import handler with env disabled before import to reflect gating
    vi.resetModules();
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '0';
    const mod2 = await import('../../../../server/interface-adapters/websocket/websocket-services/StudentRequestMessageHandler');
    const disabledHandler = new mod2.StudentRequestMessageHandler();
    const settings = new Map<any, any>([[studentWs, { twoWayEnabled: false }]]);
    context.connectionManager.getClientSettings = (ws: any) => settings.get(ws);
    await disabledHandler.handle({ type: 'student_request', text: 'hola' } as any, context);
    await new Promise(r => setTimeout(r, 120));
    const msg = teacherWs.sent.find((m: any) => m.type === 'student_request');
    expect(msg).toBeFalsy();
  });
});


