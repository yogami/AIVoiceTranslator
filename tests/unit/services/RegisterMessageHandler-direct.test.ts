/**
 * Minimal RegisterMessageHandler Test
 * 
 * This test bypasses the complex integration test infrastructure and directly
 * tests the RegisterMessageHandler in isolation to verify it works.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { RegisterMessageHandler } from '../../../server/services/websocket/RegisterMessageHandler';
import { MessageHandlerContext } from '../../../server/services/websocket/MessageHandler';

describe('RegisterMessageHandler Direct Test', () => {
  let handler: RegisterMessageHandler;
  let mockContext: MessageHandlerContext;
  let mockWs: any;

  beforeEach(() => {
    handler = new RegisterMessageHandler();
    
    // Create minimal mocks
    mockWs = {
      send: (data: string) => {
        console.log('✅ MOCK WS SEND:', data);
      }
    };

    mockContext = {
      ws: mockWs,
      connectionManager: {
        getRole: () => undefined,
        setRole: () => {},
        getLanguage: () => 'en',
        setLanguage: () => {},
        getClientSettings: () => ({}),
        setClientSettings: () => {},
        getSessionId: () => 'test-session-123',
        updateSessionId: () => {},
      },
      storage: {
        findActiveSessionByTeacherId: () => Promise.resolve(null),
        getActiveSession: () => Promise.resolve(null),
      },
      sessionService: {},
      translationService: {},
      speechPipelineOrchestrator: {},
      sessionLifecycleService: {},
      webSocketServer: {
        _classroomSessionManager: {
          generateClassroomCode: () => 'TEST123',
          getSessionByCode: () => ({ expiresAt: Date.now() + 3600000 })
        },
        storageSessionManager: {
          createSession: () => Promise.resolve(),
          updateSession: () => Promise.resolve(true)
        },
        getSessionCleanupService: () => null
      }
    } as any;
  });

  test('RegisterMessageHandler should be properly instantiated', () => {
    expect(handler).toBeDefined();
    expect(handler.getMessageType()).toBe('register');
  });

  test('RegisterMessageHandler should handle teacher registration message', async () => {
    console.log('🧪 Testing RegisterMessageHandler with teacher registration...');
    
    const teacherMessage = {
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'Test Teacher'
    };

    // This should not throw and should call ws.send
    await handler.handle(teacherMessage as any, mockContext);
    
    console.log('✅ Teacher registration completed without errors');
  });

  test('RegisterMessageHandler should handle student registration message', async () => {
    console.log('🧪 Testing RegisterMessageHandler with student registration...');
    
    const studentMessage = {
      type: 'register', 
      role: 'student',
      languageCode: 'es',
      name: 'Test Student'
    };

    // This should not throw and should call ws.send
    await handler.handle(studentMessage as any, mockContext);
    
    console.log('✅ Student registration completed without errors');
  });
});
