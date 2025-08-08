/**
 * Critical Audio Bug Test - Student Audio Delivery
 * Tests the complete audio pipeline from teacher speech to student audio playback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechPipelineOrchestrator } from '../../server/application/services/SpeechPipelineOrchestrator';
import { TranscriptionBusinessService } from '../../server/services/transcription/TranscriptionBusinessService';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';

// Mock WebSocket client
interface MockWebSocketClient {
  send: (data: string) => void;
  readyState: number;
  sentMessages: any[];
}

function createMockWebSocketClient(): MockWebSocketClient {
  const mock = {
    send: vi.fn((data: string) => {
      mock.sentMessages.push(JSON.parse(data));
    }),
    readyState: 1, // WebSocket.OPEN
    sentMessages: [] as any[]
  };
  return mock;
}

describe('🚨 CRITICAL: Student Audio Delivery Bug', () => {
  let testId: string;
  let storage: any;
  let speechOrchestrator: SpeechPipelineOrchestrator;
  let transcriptionService: TranscriptionBusinessService;
  let mockStudentWs: MockWebSocketClient;

  beforeEach(async () => {
    testId = `audio-bug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    storage = await setupIsolatedTest(testId);
    
    // Create services using real implementations (not mocked for integration test)
    speechOrchestrator = SpeechPipelineOrchestrator.createWithDefaultServices();
    transcriptionService = new TranscriptionBusinessService(storage, speechOrchestrator);
    
    // Create mock student WebSocket
    mockStudentWs = createMockWebSocketClient();
  });

  afterEach(async () => {
    await cleanupIsolatedTest(testId);
  });

  it('🎵 CRITICAL: Should deliver audio data to student when teacher sends transcription', async () => {
    console.log('🚨 [CRITICAL TEST] Testing student audio delivery pipeline...');
    
    // Mock the connection manager and context
    const mockConnectionManager = {
      getRole: vi.fn(() => 'teacher'),
      getLanguage: vi.fn(() => 'en-US'),
      getSessionId: vi.fn(() => 'test-session-123'),
      getStudentConnectionsAndLanguagesForSession: vi.fn(() => ({
        connections: [mockStudentWs as any],
        languages: ['es-ES']
      }))
    };

    const mockContext = {
      connectionManager: mockConnectionManager,
      storage,
      speechPipelineOrchestrator: speechOrchestrator
    };

    // Create a mock transcription message (what teacher sends)
    const teacherTranscriptionMessage = {
      type: 'transcription' as const,
      text: 'Hello, how are you today?',
      timestamp: Date.now(),
      isFinal: true
    };

    const mockLatencyTracking = {
      start: Date.now(),
      components: {
        preparation: 0,
        translation: 0,
        tts: 0,
        processing: 0
      },
      end: Date.now()
    };

    console.log('🚨 [CRITICAL TEST] Processing teacher transcription...');

    // Process the transcription (this should trigger translation and TTS)
    await transcriptionService.processTranscription(
      mockStudentWs as any,
      teacherTranscriptionMessage,
      mockLatencyTracking
    );

    console.log('🚨 [CRITICAL TEST] Checking student received messages...');
    console.log('📨 Student received messages:', mockStudentWs.sentMessages);

    // CRITICAL ASSERTIONS - This is where the bug manifests
    expect(mockStudentWs.sentMessages.length).toBeGreaterThan(0);
    
    const translationMessage = mockStudentWs.sentMessages.find(msg => msg.type === 'translation');
    expect(translationMessage).toBeDefined();

    // 🚨 CRITICAL: Check if audioData is present
    console.log('🎵 [CRITICAL] audioData present:', !!translationMessage?.audioData);
    console.log('🎵 [CRITICAL] audioData length:', translationMessage?.audioData?.length || 0);
    console.log('🎵 [CRITICAL] ttsServiceType:', translationMessage?.ttsServiceType);

    // These assertions will expose the audio bug
    expect(translationMessage.audioData).toBeDefined();
    expect(translationMessage.audioData).not.toBe('');
    expect(translationMessage.audioData.length).toBeGreaterThan(0);
    expect(translationMessage.ttsServiceType).toBeDefined();

    // Verify message structure matches what client expects
    expect(translationMessage).toMatchObject({
      type: 'translation',
      originalText: 'Hello, how are you today?',
      translatedText: expect.any(String),
      audioData: expect.any(String),
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES',
      ttsServiceType: expect.any(String)
    });

    console.log('✅ [CRITICAL TEST] Student audio delivery test completed successfully!');
  }, 30000);

  it('🎵 REGRESSION: Should match exact format expected by client Student.tsx component', async () => {
    console.log('🚨 [REGRESSION TEST] Testing exact client format compatibility...');
    
    // This test ensures the message format matches what client/src/components/Student.tsx expects
    const mockConnectionManager = {
      getRole: vi.fn(() => 'teacher'),
      getLanguage: vi.fn(() => 'en-US'),
      getSessionId: vi.fn(() => 'test-session-456'),
      getStudentConnectionsAndLanguagesForSession: vi.fn(() => ({
        connections: [mockStudentWs as any],
        languages: ['fr-FR']
      }))
    };

    const mockContext = {
      connectionManager: mockConnectionManager,
      storage,
      speechPipelineOrchestrator: speechOrchestrator
    };

    await transcriptionService.processTranscription(
      mockStudentWs as any,
      {
        type: 'transcription' as const,
        text: 'Good morning',
        timestamp: Date.now(),
        isFinal: true
      },
      {
        start: Date.now(),
        components: { preparation: 0, translation: 0, tts: 0, processing: 0 },
        end: Date.now()
      }
    );

    const message = mockStudentWs.sentMessages.find(msg => msg.type === 'translation');
    
    // Client expects `audioData` property (not `audio`)
    expect(message.audioData).toBeDefined();
    
    // Client checks if audio can be played
    if (message.audioData && message.audioData.length > 0) {
      const audioBuffer = Buffer.from(message.audioData, 'base64');
      expect(audioBuffer.length).toBeGreaterThan(0);
    }

    console.log('✅ [REGRESSION TEST] Client format compatibility verified!');
  }, 30000);
});
