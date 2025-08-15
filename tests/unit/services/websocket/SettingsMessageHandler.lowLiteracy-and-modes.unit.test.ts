import { describe, it, expect, beforeEach } from 'vitest';

describe('SettingsMessageHandler - lowLiteracy and classroom modes (ATDD)', () => {
  let handler: any;
  let context: any;
  let teacherWs: any;
  let studentWs: any;

  beforeEach(async () => {
    // Enable both features
    process.env.FEATURE_LOW_LITERACY_MODE = '1';
    process.env.FEATURE_CLASSROOM_MODES = '1';
    const mod = await import('../../../../server/interface-adapters/websocket/websocket-services/SettingsMessageHandler');
    handler = new mod.SettingsMessageHandler();

    teacherWs = { readyState: 1, sent: [] as any[], send(d: string) { this.sent.push(JSON.parse(d)); } };
    studentWs = { readyState: 1, sent: [] as any[], send(d: string) { this.sent.push(JSON.parse(d)); } };

    const connections = new Set<any>([teacherWs, studentWs]);
    const roles = new Map<any, string>([[teacherWs, 'teacher'], [studentWs, 'student']]);
    const sessions = new Map<any, string>([[teacherWs, 'sess1'], [studentWs, 'sess1']]);
    const settings = new Map<any, any>();

    context = {
      ws: teacherWs,
      connectionManager: {
        getConnections: () => connections,
        getRole: (ws: any) => roles.get(ws),
        getSessionId: (ws: any) => sessions.get(ws),
        getStudentConnectionsAndLanguagesForSession: (sid: string) => ({ connections: [studentWs], languages: ['es'] }),
        getClientSettings: (ws: any) => settings.get(ws),
        setClientSettings: (ws: any, s: any) => { settings.set(ws, s); },
      },
    };
  });

  it('broadcasts classroom_mode when teacher sets classroomMode', async () => {
    await handler.handle({ type: 'settings', settings: { classroomMode: 'group' } } as any, context);
    // teacher gets ack
    const ack = teacherWs.sent.find((m: any) => m.type === 'settings');
    expect(ack).toBeTruthy();
    // student receives classroom_mode broadcast
    const modeMsg = studentWs.sent.find((m: any) => m.type === 'classroom_mode');
    expect(modeMsg).toBeTruthy();
    expect(modeMsg.mode).toBe('group');
  });
});


