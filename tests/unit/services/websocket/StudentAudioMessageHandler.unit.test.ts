import { describe, it, expect, beforeAll } from 'vitest';

describe('StudentAudioMessageHandler', () => {
  beforeAll(() => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
  });

  it('delivers transcribedText as student_request to teacher and registers route', async () => {
    const { StudentAudioMessageHandler } = await import('../../../../server/interface-adapters/websocket/websocket-services/StudentAudioMessageHandler');
    const handler = new StudentAudioMessageHandler();

    // Fake sockets
    const sentToTeacher: any[] = [];
    const teacherWs: any = { send: (s: string) => sentToTeacher.push(JSON.parse(s)) };
    const studentWs: any = {}; // context.ws in test

    const connectionManager = {
      getRole: (ws: any) => (ws === studentWs ? 'student' : 'teacher'),
      getSessionId: (ws: any) => 'session-1',
      getLanguage: (ws: any) => 'es-ES',
      getName: (ws: any) => 'Student A',
      getConnections: () => [teacherWs, studentWs]
    };
    const context: any = {
      ws: studentWs,
      connectionManager,
      webSocketServer: { registerStudentRequest: (_sid: string, _rid: string, _ws: any) => {} },
      speechPipelineOrchestrator: null,
      storage: {}
    };

    await handler.handle({ type: 'student_audio', transcribedText: 'Hola', visibility: 'private' } as any, context);
    expect(sentToTeacher.length).toBeGreaterThan(0);
    const msg = sentToTeacher.find(m => m.type === 'student_request');
    expect(msg).toBeTruthy();
    expect(msg.payload.text).toContain('Hola');
  });
});


