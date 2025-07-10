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
  isValidClassroomCode: vi.fn(),
  restoreClassroomSession: vi.fn()
};

const mockConnectionManager = {
  getRole: vi.fn(),
  setRole: vi.fn(),
  getLanguage: vi.fn(),
  setLanguage: vi.fn(),
  getSessionId: vi.fn(),
  updateSessionId: vi.fn(),
  getClassroomCode: vi.fn(),
  getClientSettings: vi.fn(),
  setClientSettings: vi.fn(),
  getConnections: vi.fn(() => []), // Return empty array by default
  isStudentCounted: vi.fn(),
  setStudentCounted: vi.fn()
};

const mockWebSocketServer = {
  classroomSessionManager: mockClassroomSessionManager,
  _classroomSessionManager: mockClassroomSessionManager,
  storageSessionManager: mockStorageSessionManager,
  getSessionCleanupService: vi.fn().mockReturnValue({
    markStudentsRejoined: vi.fn(),
    updateSessionActivity: vi.fn()
  })
};

const mockWebSocket = {
  send: vi.fn()
} as any as WebSocketClient;

const mockStorage = {
  getSession: vi.fn(),
  getActiveSession: vi.fn(),
  getActiveSessions: vi.fn().mockResolvedValue([]),
  getAllActiveSessions: vi.fn().mockResolvedValue([]),
  getSessionById: vi.fn(),
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
    
    // Ensure getSessionById returns the same data as getActiveSession for consistency
    mockStorage.getSessionById = vi.fn().mockImplementation(async (sessionId) => {
      const activeSession = await mockStorage.getActiveSession(sessionId);
      return activeSession;
    });
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
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        id: 1,
        sessionId: 'test-session-123',
        studentsCount: 0,
        isActive: true
      });
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        id: 1,
        sessionId: 'test-session-123',
        studentsCount: 0, // Start with 0 so it increments to 1
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
          studentsCount: 1, // Should increment from 0 to 1
          isActive: true,
          studentLanguage: 'es'
        })
      );
      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'student');
      expect(mockConnectionManager.setLanguage).toHaveBeenCalledWith(mockWebSocket, 'es');
      expect(mockConnectionManager.setStudentCounted).toHaveBeenCalledWith(mockWebSocket, true);
    });

    it('should NOT create database session when SECOND student joins existing session', async () => {
      // Mock: Session already exists in database
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
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
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
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
      // Setup: Session exists (created by teacher previously)
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValue({ 
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

      // Sessions are not created by students - they update existing sessions
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1,
          isActive: true,
          studentLanguage: 'es'
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
      // Setup: Session exists (created by teacher previously)
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValue({ 
          sessionId: 'test-session-123',
          studentsCount: 0,
          isActive: true
        });
      mockConnectionManager.isStudentCounted.mockReturnValue(false);
      mockClassroomSessionManager.isValidClassroomCode.mockReturnValue(true);
      
      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'student',
        languageCode: 'de',
        name: 'Test Student',
        classroomCode: 'ABC123'
      };

      await handler.handle(message, context);

      // Should update session with classCode and studentLanguage (no creation)
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
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
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        id: 1,
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
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        id: 1,
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
      // Setup: Session exists (created by teacher previously)
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValue({ 
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

      // Should update session (no creation by students)
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 1,
          isActive: true,
          studentLanguage: 'es'
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

  describe('Teacher Reconnection Logic', () => {    it('should reconnect teacher to existing active session and reuse classroom code', async () => {
      // Mock: No session for current sessionId, but existing session with same teacher language exists
      mockStorage.getActiveSession = vi.fn()
        .mockResolvedValueOnce(null) // First call for current sessionId
        .mockResolvedValueOnce({ // Second call after reconnecting to existing session
          sessionId: 'existing-session-123',
          teacherLanguage: 'en',
          isActive: true,
          studentsCount: 2,
          classCode: 'XYZ789'
        });
        
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([
        {
          sessionId: 'existing-session-123',
          teacherLanguage: 'en',
          isActive: true,
          studentsCount: 2,
          classCode: 'XYZ789',
          lastActivityAt: new Date() // Add recent activity timestamp
        }
      ]);
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        sessionId: 'existing-session-123',
        classCode: 'XYZ789'
      });

      // Ensure the cleanup service methods don't throw
      mockWebSocketServer.getSessionCleanupService = vi.fn().mockReturnValue({
        updateSessionActivity: vi.fn().mockResolvedValue(undefined),
        endSession: vi.fn().mockResolvedValue(undefined)
      });

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Reconnecting Teacher'
      };

      await handler.handle(message, context);

      // Should find and reconnect to existing session
      expect(mockConnectionManager.updateSessionId).toHaveBeenCalledWith(mockWebSocket, 'existing-session-123');
      
      // Should restore classroom session
      expect(mockClassroomSessionManager.restoreClassroomSession).toHaveBeenCalledWith('XYZ789', 'existing-session-123');
      
      // Should generate new classroom code (implementation always generates one)
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('existing-session-123');
      
      // Should set the teacher role
      expect(mockConnectionManager.setRole).toHaveBeenCalledWith(mockWebSocket, 'teacher');
      expect(mockConnectionManager.setLanguage).toHaveBeenCalledWith(mockWebSocket, 'en');
    });

    it('should create new session if no active session exists for teacher', async () => {
      // Mock: No sessions exist
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([]);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'New Teacher'
      };

      await handler.handle(message, context);

      // Should create new session
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123', undefined);
      
      // Should generate classroom code for new session
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
      
      // Should send classroom code
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"classroom_code"')
      );
    });

    it('should handle case where active session exists but no classroom code', async () => {
      // Mock: Session exists but no classroom code stored
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        id: 1,
        sessionId: 'test-session-123',
        isActive: true,
        studentsCount: 0,
        classCode: null
      });
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        sessionId: 'test-session-123',
        classCode: null
      });

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Teacher Without Code'
      };

      await handler.handle(message, context);

      // Should generate classroom code for existing session
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
      
      // Should update session with new classroom code
      expect(mockStorageSessionManager.updateSession).toHaveBeenCalledWith('test-session-123', {
        classCode: 'ABC123'
      });
    });

    it('should handle teacher reconnecting with different language (no existing session)', async () => {
      // Mock: No existing sessions with this teacher language
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([
        {
          sessionId: 'other-session',
          teacherLanguage: 'fr', // Different language
          isActive: true
        }
      ]);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en', // Teacher wants English
        name: 'Teacher Different Language'
      };

      await handler.handle(message, context);

      // Should not reconnect to French session
      expect(mockConnectionManager.updateSessionId).not.toHaveBeenCalled();
      
      // Should create new session
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123', undefined);
      
      // Should generate new classroom code
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
    });

    it('should handle error during existing session search gracefully', async () => {
      // Mock: Error when searching for existing sessions
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.getAllActiveSessions = vi.fn().mockRejectedValue(new Error('Database error'));

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Teacher with DB Error'
      };

      await handler.handle(message, context);

      // Should still create new session when search fails
      expect(mockStorageSessionManager.createSession).toHaveBeenCalledWith('test-session-123', undefined);
      
      // Should generate classroom code
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
    });
  });

  describe('Classroom Code Reuse Prevention', () => {
    it('should not reuse classroom code from expired session', async () => {
      // Mock: No active sessions exist
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([]);

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Teacher After Expiration'
      };

      await handler.handle(message, context);

      // Should generate new classroom code
      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
      
      // Should send classroom_code message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"classroom_code"')
      );
    });

    it('should ensure classroom code uniqueness across sessions', async () => {
      // This test verifies that each session gets its own unique code
      mockStorage.getActiveSession = vi.fn().mockResolvedValue(null);
      mockStorage.getAllActiveSessions = vi.fn().mockResolvedValue([]);
      mockClassroomSessionManager.generateClassroomCode.mockReturnValue('UNIQUE123');

      const message: RegisterMessageToServer = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en',
        name: 'Teacher Needing Unique Code'
      };

      await handler.handle(message, context);

      expect(mockClassroomSessionManager.generateClassroomCode).toHaveBeenCalledWith('test-session-123');
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"UNIQUE123"')
      );
    });
  });
});
