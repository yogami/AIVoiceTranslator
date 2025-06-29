import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterMessageHandler } from '../../../../server/services/websocket/RegisterMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { RegisterMessageToServer } from '../../../../server/services/WebSocketTypes';

// Mock dependencies
const mockStorageSessionManager = {
  createSession: vi.fn(),
  updateSession: vi.fn(),
  getSession: vi.fn()
};

const mockClassroomSessionManager = {
  generateClassroomCode: vi.fn(),
  getSessionByCode: vi.fn(),
  isValidClassroomCode: vi.fn()
};

const mockConnectionManager = {
  getRole: vi.fn(),
  setRole: vi.fn(),
  getLanguage: vi.fn(),
  setLanguage: vi.fn(),
  getSessionId: vi.fn(),
  getClientSettings: vi.fn(),
  setClientSettings: vi.fn(),
  getConnections: vi.fn(() => []), // Return empty array by default
  isStudentCounted: vi.fn(),
  setStudentCounted: vi.fn()
};

const mockWebSocketServer = {
  classroomSessionManager: mockClassroomSessionManager,
  storageSessionManager: mockStorageSessionManager,
  getSessionCleanupService: vi.fn()
};

const mockWebSocket = {
  send: vi.fn()
} as any as WebSocketClient;

const mockStorage = {
  getSession: vi.fn(),
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn()
};

const mockSessionService = {
  handleSessionUpdate: vi.fn()
};

const mockTranslationService = {
  processTranslation: vi.fn()
};

const mockSessionLifecycleService = {
  handleSessionStart: vi.fn(),
  handleSessionEnd: vi.fn()
};

describe('RegisterMessageHandler', () => {
  let handler: RegisterMessageHandler;
  let context: MessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    handler = new RegisterMessageHandler();
    context = {
      ws: mockWebSocket,
      connectionManager: mockConnectionManager,
      storage: mockStorage,
      sessionService: mockSessionService,
      translationService: mockTranslationService,
      sessionLifecycleService: mockSessionLifecycleService,
      webSocketServer: mockWebSocketServer as any
    };

    // Default mocks
    mockConnectionManager.getRole.mockReturnValue(null);
    mockConnectionManager.getSessionId.mockReturnValue('test-session-123');
    mockConnectionManager.getClientSettings.mockReturnValue({});
    mockConnectionManager.isStudentCounted.mockReturnValue(false);
    mockClassroomSessionManager.generateClassroomCode.mockReturnValue('ABC123');
    mockClassroomSessionManager.getSessionByCode.mockReturnValue({
      code: 'ABC123',
      sessionId: 'test-session-123',
      teacherConnected: true
    });
    mockWebSocketServer.getSessionCleanupService.mockReturnValue({
      markStudentsRejoined: vi.fn()
    });
    mockStorageSessionManager.createSession.mockResolvedValue({});
    mockStorageSessionManager.updateSession.mockResolvedValue({});
    mockStorage.createSession.mockResolvedValue({
      id: 1,
      sessionId: 'test-session-123',
      isActive: true
    });
    mockStorage.getActiveSession = vi.fn();
  });

  describe('Teacher Registration', () => {
    it('should NOT create database session when teacher registers', async () => {
      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Test Teacher'
      };

      await handler.handle(message, context);

      // Teacher registration should NOT create database session
      expect(mockStorage.createSession).not.toHaveBeenCalled();
      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'teacher');
      expect(mockConnectionManager.setLanguage).toHaveBeenCalledWith(mockWebSocket, 'en');
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it('should generate classroom code for teacher', async () => {
      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Test Teacher'
      };

      await handler.handle(message, context);

      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
    });
  });

  describe('Student Registration - Session Creation Logic', () => {
    it('should update database session when student joins (session created on connection)', async () => {
      // Mock: Session already exists from connection
      mockStorage.getActiveSession = vi.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        studentsCount: 0,
        isActive: true
      });
      mockConnectionManager.isStudentCounted.mockReturnValue(false); // Student not counted yet
      
      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await handler.handle(message, context);

      // Student joining should NOT create session (created on connection), only update it
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1,
          isActive: true
        })
      );
      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'student');
      expect(mockConnectionManager.setLanguage).toHaveBeenCalledWith(mockWebSocket, 'es');
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });

    it('should NOT create database session when SECOND student joins existing session', async () => {
      // Mock: Session already exists in database
      mockStorage.getActiveSession = vi.fn().mockResolvedValue({
        id: 1,
        sessionId: 'test-session-123',
        isActive: true,
        studentsCount: 1
      });
      mockConnectionManager.isStudentCounted.mockReturnValue(false); // New student connection

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'fr',
        name: 'Second Student'
      };

      await handler.handle(message, context);

      // Session already exists, should NOT create a new one
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      // Should update existing session instead
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 2, // Should increment from 1 to 2
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });

    it('should handle session creation errors gracefully', async () => {
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.createSession = vi.fn().mockRejectedValue(new Error('Database error'));

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      // Should not throw error, should handle gracefully
      await expect(handler.handle(message, context)).resolves.not.toThrow();
      
      // Should still set role and language even if session creation fails
      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'student');
      expect(mockConnectionManager.setLanguage).toHaveBeenCalledWith(mockWebSocket, 'es');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate the correct session lifecycle', async () => {
      // Step 1: Teacher connects (no database session created)
      const teacherMessage: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Teacher'
      };

      await handler.handle(teacherMessage, context);
      expect(mockStorage.createSession).not.toHaveBeenCalled();

      // Step 2: First student joins (database session created)
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      const firstStudentMessage: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'First Student'
      };

      await handler.handle(firstStudentMessage, context);
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledTimes(1);

      // Step 3: Second student joins (no new session created)
      mockStorage.getActiveSession = vi.fn().mockResolvedValue({ 
        id: 1, 
        sessionId: 'test-session-123', 
        isActive: true 
      });
      const secondStudentMessage: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'fr',
        name: 'Second Student'
      };

      await handler.handle(secondStudentMessage, context);
      // Still only 1 session creation call
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledTimes(1);
    });

    it('should create session with correct properties when first student joins', async () => {
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValueOnce(null) // First call returns null (no session)
        .mockResolvedValueOnce({ // Second call returns created session 
          sessionId: 'test-session-123', 
          studentsCount: 0,
          isActive: true 
        });
      mockConnectionManager.getLanguage.mockReturnValue('en'); // Teacher language
      mockConnectionManager.isStudentCounted.mockReturnValue(false);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await handler.handle(message, context);

      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123');
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1,
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session ID gracefully', async () => {
      mockConnectionManager.getSessionId.mockReturnValue(null);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await expect(handler.handle(message, context)).resolves.not.toThrow();
      // Should not try to create session without sessionId
      expect(mockStorage.createSession).not.toHaveBeenCalled();
    });

    it('should store classCode and studentLanguage when student joins', async () => {
      // Mock: No existing session in database
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValueOnce(null) // First call returns null (no session)
        .mockResolvedValueOnce({ // Second call returns created session
          sessionId: 'test-session-123',
          studentsCount: 0,
          isActive: true
        });
      mockConnectionManager.isStudentCounted.mockReturnValue(false);
      
      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'de',
        name: 'Test Student',
        classroomCode: 'ABC123'
      };

      await handler.handle(message, context);

      // Should create session with classCode and studentLanguage
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123');
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          classCode: 'ABC123',
          studentLanguage: 'de',
          studentsCount: 1,
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });

    it('should handle role changes properly', async () => {
      // User initially connects as student, then changes to teacher
      mockConnectionManager.getRole.mockReturnValue('student');

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'User'
      };

      await handler.handle(message, context);

      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'teacher');
      // When changing from student to teacher, should not create session
      expect(mockStorage.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Student Counting Logic', () => {
    it('should only count student once when registering for first time', async () => {
      mockStorage.getActiveSession = vi.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        studentsCount: 0,
        isActive: true
      });
      mockConnectionManager.isStudentCounted.mockReturnValue(false);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await handler.handle(message, context);

      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1, // Should increment from 0 to 1
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });

    it('should not increment count if student already counted', async () => {
      mockStorage.getActiveSession = vi.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        studentsCount: 2,
        isActive: true
      });
      mockConnectionManager.isStudentCounted.mockReturnValue(true); // Already counted

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await handler.handle(message, context);

      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 2, // Should NOT increment
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).not.toHaveBeenCalled();
    });

    it('should create session and count student when no session exists', async () => {
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValueOnce(null) // First call returns null (no session)
        .mockResolvedValueOnce({ // Second call returns created session
          sessionId: 'test-session-123',
          studentsCount: 0,
          isActive: true
        });
      mockConnectionManager.isStudentCounted.mockReturnValue(false);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        name: 'Test Student'
      };

      await handler.handle(message, context);

      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123');
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1,
          isActive: true
        })
      );
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });
  });

  describe('Settings Merge Logic', () => {
    it('should merge settings properly when provided', async () => {
      const existingSettings = {
        ttsServiceType: 'openai'
      };
      mockConnectionManager.getClientSettings.mockReturnValue(existingSettings);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        settings: {
          useClientSpeech: true,
          ttsServiceType: 'google' // Override existing
        }
      };

      await handler.handle(message, context);

      expect(mockConnectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWebSocket, 
        expect.objectContaining({
          ttsServiceType: 'google', // Overridden
          useClientSpeech: true // New setting added
        })
      );
    });

    it('should override existing settings with new values', async () => {
      const existingSettings = {
        ttsServiceType: 'openai',
        useClientSpeech: false
      };
      mockConnectionManager.getClientSettings.mockReturnValue(existingSettings);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'es',
        settings: {
          ttsServiceType: 'google', // Override existing
          useClientSpeech: true // Override existing
        }
      };

      await handler.handle(message, context);

      expect(mockConnectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWebSocket, 
        expect.objectContaining({
          ttsServiceType: 'google', // Overridden
          useClientSpeech: true // Overridden
        })
      );
    });

    it('should handle empty existing settings', async () => {
      mockConnectionManager.getClientSettings.mockReturnValue({});

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        settings: {
          ttsServiceType: 'google',
          useClientSpeech: true
        }
      };

      await handler.handle(message, context);

      expect(mockConnectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWebSocket, 
        expect.objectContaining({
          ttsServiceType: 'google',
          useClientSpeech: true
        })
      );
    });

    it('should work when no settings provided in message', async () => {
      const existingSettings = {
        ttsServiceType: 'openai'
      };
      mockConnectionManager.getClientSettings.mockReturnValue(existingSettings);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en'
        // No settings provided
      };

      await handler.handle(message, context);

      expect(mockConnectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWebSocket, 
        existingSettings // Should preserve existing settings
      );
    });
  });
});
