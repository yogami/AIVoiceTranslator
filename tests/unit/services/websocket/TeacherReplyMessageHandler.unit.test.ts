import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('TeacherReplyMessageHandler - basic wiring', () => {
  beforeAll(() => {
    process.env.FEATURE_TWO_WAY_COMMUNICATION = '1';
  });

  it('skips when not teacher', async () => {
    const mod = await import('../../../../server/interface-adapters/websocket/websocket-services/TeacherReplyMessageHandler');
    const handler = new mod.TeacherReplyMessageHandler();
    const context: any = {
      connectionManager: {
        getRole: () => 'student',
        getSessionId: () => 's1',
        getLanguage: () => 'en-US',
        getStudentConnectionsAndLanguagesForSession: () => ({ connections: [], languages: [] })
      },
      webSocketServer: { getStudentForRequest: vi.fn() },
      storage: {},
      speechPipelineOrchestrator: {},
    };
    await handler.handle({ type: 'teacher_reply', text: 'Hi', scope: 'class' } as any, context);
    expect(context.webSocketServer.getStudentForRequest).not.toHaveBeenCalled();
  });
});


