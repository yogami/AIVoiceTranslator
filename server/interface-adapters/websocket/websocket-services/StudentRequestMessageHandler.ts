import logger from '../../../logger';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { StudentRequestMessageToServer, StudentRequestMessageToClient } from '../WebSocketTypes';
import { config } from '../../../config';

export class StudentRequestMessageHandler implements IMessageHandler<StudentRequestMessageToServer> {
  // Simple per-connection rate limiting to prevent spam
  private static requestWindowMs: number = parseInt(process.env.TWOWAY_REQ_WINDOW_MS || '2000', 10);
  private static requestMaxPerWindow: number = parseInt(process.env.TWOWAY_REQ_MAX || '3', 10);
  private static rateState: WeakMap<any, { windowStart: number; count: number }> = new WeakMap();

  getMessageType(): string {
    return 'student_request';
  }

  async handle(message: StudentRequestMessageToServer, context: MessageHandlerContext): Promise<void> {
    // Feature flag: allow via global flag OR per-connection setting (from URL param)
    const settings = context.connectionManager.getClientSettings?.(context.ws) || {};
    const enabled = !!(config.features?.twoWayCommunication || settings.twoWayEnabled);
    if (!enabled) {
      return;
    }
    try {
      const role = context.connectionManager.getRole(context.ws);
      if (role !== 'student') return;

      // Rate limiting per student connection
      const now = Date.now();
      const state = StudentRequestMessageHandler.rateState.get(context.ws) || { windowStart: now, count: 0 };
      if (now - state.windowStart > StudentRequestMessageHandler.requestWindowMs) {
        state.windowStart = now;
        state.count = 0;
      }
      if (state.count >= StudentRequestMessageHandler.requestMaxPerWindow) {
        logger.warn('Throttling student_request due to rate limit');
        StudentRequestMessageHandler.rateState.set(context.ws, state);
        return;
      }
      state.count += 1;
      StudentRequestMessageHandler.rateState.set(context.ws, state);

      const sessionId = context.connectionManager.getSessionId(context.ws);
      if (!sessionId) return;

      const studentName = (context.connectionManager.getClientSettings(context.ws)?.name as string) || undefined;
      const languageCode = context.connectionManager.getLanguage(context.ws);

      const teachers = Array.from(context.connectionManager.getConnections()).filter((ws: any) => {
        return context.connectionManager.getRole(ws) === 'teacher' && context.connectionManager.getSessionId(ws) === sessionId;
      });

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const payload: StudentRequestMessageToClient = {
        type: 'student_request',
        timestamp: Date.now(),
        payload: {
          requestId,
          name: studentName,
          languageCode,
          text: message.text,
          visibility: message.visibility || 'private'
        }
      };

      for (const teacherWs of teachers) {
        try { teacherWs.send(JSON.stringify(payload)); } catch (e) {
          logger.warn('Failed to deliver student_request to teacher', { error: e });
        }
      }

      // Register routing for private replies
      try {
        if (sessionId) {
          context.webSocketServer.registerStudentRequest(sessionId, requestId, context.ws);
        }
      } catch (e) {
        logger.warn('Failed to register student request routing', { error: e });
      }
    } catch (error) {
      logger.error('StudentRequestMessageHandler error', { error });
    }
  }
}


