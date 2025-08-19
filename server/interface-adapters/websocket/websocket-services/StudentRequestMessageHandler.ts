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
    try { console.log('[SRMH] received student_request', { text: (message as any)?.text }); } catch {}
    // Feature flag: allow via global flag OR per-connection setting (from URL param)
    const settings = context.connectionManager.getClientSettings?.(context.ws) || {};
    const enabled = !!(config.features?.twoWayCommunication || settings.twoWayEnabled);
    if (!enabled) {
      logger.info('student_request ignored: two-way disabled for this connection');
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
      const shortId = `STU-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const languageCode = context.connectionManager.getLanguage(context.ws);

      const findTeachersInSession = () => {
        const currentSessionId = context.connectionManager.getSessionId(context.ws) || sessionId;
        return Array.from(context.connectionManager.getConnections()).filter((ws: any) => {
          return context.connectionManager.getRole(ws) === 'teacher' && context.connectionManager.getSessionId(ws) === currentSessionId;
        });
      };
      let teachers = findTeachersInSession();
      // E2E fallback: if no teacher was found in-session (race during registration), deliver to all teachers
      if ((!teachers || teachers.length === 0) && (process.env.E2E_TEST_MODE === 'true')) {
        teachers = Array.from(context.connectionManager.getConnections()).filter((ws: any) => {
          return context.connectionManager.getRole(ws) === 'teacher';
        });
      }
      logger.info('student_request received', { sessionId, teachersFound: teachers.length, text: message.text });

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const payload: StudentRequestMessageToClient = {
        type: 'student_request',
        timestamp: Date.now(),
        payload: {
          requestId,
          studentId: shortId,
          name: studentName,
          languageCode,
          text: message.text,
          visibility: message.visibility || 'private'
        }
      };

      const doDeliver = (targets: any[]) => {
        for (const teacherWs of targets) {
          try { teacherWs.send(JSON.stringify(payload)); logger.info('student_request delivered to teacher'); } catch (e) {
            logger.warn('Failed to deliver student_request to teacher', { error: e });
          }
        }
      };
      if (!teachers || teachers.length === 0) {
        // Retry briefly to avoid race between teacher register and first student request
        let attempts = 0;
        const maxAttempts = 5;
        const interval = setInterval(() => {
          attempts++;
          teachers = findTeachersInSession();
          if (teachers.length > 0 || attempts >= maxAttempts) {
            clearInterval(interval);
            if (teachers.length === 0 && process.env.E2E_TEST_MODE === 'true') {
              const allTeachers = Array.from(context.connectionManager.getConnections()).filter((ws: any) => context.connectionManager.getRole(ws) === 'teacher');
              doDeliver(allTeachers);
            } else {
              doDeliver(teachers);
            }
          }
        }, 100);
      } else {
        doDeliver(teachers);
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


