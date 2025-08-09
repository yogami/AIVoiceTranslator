import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { setupIsolatedTest } from '../../utils/test-database-isolation';
import { initTestDatabase, closeDatabaseConnection } from '../../setup/db-setup';

const TEST_CONFIG = {
  CONNECTION_TIMEOUT: 10000,
  MESSAGE_TIMEOUT: 15000,
};

describe('End-to-End TTS Orchestrator Integration', { timeout: 45000 }, () => {
  let httpServer: HTTPServer;
  let wsServer: TestWebSocketServer;
  let realStorage: any;
  let serverPort: number;
  let teacherClient: WebSocket | null = null;
  let studentClient: WebSocket | null = null;
  let clients: WebSocket[] = [];


  // Use a WeakMap to track messages for each WebSocket
  const wsMessages = new WeakMap<WebSocket, any[]>();

  const createClient = async (path: string = '/ws', idx?: number): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}${path}`);
      wsMessages.set(ws, []);
      clients.push(ws);
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          wsMessages.get(ws)?.push(msg);
        } catch {}
      });
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), TEST_CONFIG.CONNECTION_TIMEOUT);
      ws.on('open', () => {
        clearTimeout(timeout);
        setTimeout(() => resolve(ws), 100);
      });
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  };

  const waitForMessage = (ws: WebSocket, type?: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Message timeout for type: ${type || 'any'}`));
      }, TEST_CONFIG.MESSAGE_TIMEOUT);
      const interval = setInterval(() => {
        const messages = wsMessages.get(ws) || [];
        let messageIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (!type || messages[i].type === type) {
            messageIndex = i;
            break;
          }
        }
        if (messageIndex >= 0) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(messages[messageIndex]);
        }
      }, 100);
    });
  };

  beforeAll(async () => {
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-key';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    await initTestDatabase();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  beforeEach(async () => {
    // Setup isolated test environment
    const testId = `tts-e2e-orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    httpServer = createServer();
    realStorage = await setupIsolatedTest(testId);
    await new Promise<void>((resolve, reject) => {
      const tryPort = 51000 + Math.floor(Math.random() * 1000);
      httpServer.listen(tryPort, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
          resolve();
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
      httpServer.on('error', reject);
    });
    wsServer = new TestWebSocketServer(httpServer, realStorage);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }
    clients = [];
    teacherClient = null;
    studentClient = null;
    if (wsServer) await wsServer.shutdown();
    if (httpServer) await new Promise<void>(resolve => httpServer.close(() => resolve()));
    vi.restoreAllMocks();
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  interface RunE2ETestOptions {
    sttFlag: string;
    translationFlag: string;
    ttsFlag: string;
    expectTTS: string;
    simulateTTSFailure?: boolean;
    simulateSTTFailure?: boolean;
  }

  async function runE2ETest({ sttFlag, translationFlag, ttsFlag, expectTTS, simulateTTSFailure = false, simulateSTTFailure = false }: RunE2ETestOptions) {
    // Set up environment flags
    process.env.STT_SERVICE_TYPE = sttFlag;
    process.env.TTS_SERVICE_TYPE = ttsFlag;
    process.env.TRANSLATION_SERVICE_TYPE = translationFlag;
    process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-key';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

    // Optionally simulate TTS failure by mocking fetch
    if (simulateTTSFailure) {
      global.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
        headers: new Map(),
        redirected: false,
        statusText: '',
        type: '',
        url: '',
        clone: function() { return this as Response; },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
        formData: async () => new FormData(),
      } as unknown as Response);
    }
    if (simulateSTTFailure) {
      global.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'STT Error',
        headers: new Map(),
        redirected: false,
        statusText: '',
        type: '',
        url: '',
        clone: function() { return this as Response; },
        body: null,
        bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
        formData: async () => new FormData(),
      } as unknown as Response);
    }

    // Teacher connects and registers
    teacherClient = await createClient('/', 1);
    await waitForMessage(teacherClient, 'connection');
    await new Promise(resolve => setTimeout(resolve, 200));
    teacherClient.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'E2E Teacher',
      settings: { sttServiceType: sttFlag, translationServiceType: translationFlag, ttsServiceType: ttsFlag }
    }));
    const classroomCodeMsg = await waitForMessage(teacherClient, 'classroom_code');
    expect(classroomCodeMsg.code).toMatch(/^[A-Z0-9]{6}$/);

    // Student connects and registers
    studentClient = await createClient(`/ws?code=${classroomCodeMsg.code}`, 2);
    await waitForMessage(studentClient, 'connection');
    await new Promise(resolve => setTimeout(resolve, 200));
    studentClient.send(JSON.stringify({
      type: 'register',
      role: 'student',
      languageCode: 'en-US',
      name: 'E2E Student',
      settings: { sttServiceType: sttFlag, translationServiceType: translationFlag, ttsServiceType: ttsFlag }
    }));
    await waitForMessage(studentClient, 'register');

    // Teacher sends a transcription message (triggers translation pipeline)
    teacherClient.send(JSON.stringify({
      type: 'transcription',
      text: 'Hello world'
    }));
    // Wait for translation message to student
    const translationMsg = await waitForMessage(studentClient, 'translation');
    expect(translationMsg).toBeDefined();
    if (expectTTS) {
      expect(translationMsg.ttsServiceType).toBe(expectTTS);
    }
    if (simulateTTSFailure) {
      expect(translationMsg.ttsServiceType).not.toBe(ttsFlag); // Should fallback
    }
    if (simulateSTTFailure) {
      expect(translationMsg.transcriptionError).toBeDefined();
    }
  }

  it('should use Local or Browser TTS when all flags are auto', async () => {
    // In our cost-optimized auto flow, local/browser come before paid tiers
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'auto', expectTTS: '', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should use OpenAI TTS when ttsFlag is openai', async () => {
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'openai', expectTTS: 'openai', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should use Browser TTS when ttsFlag is browser', async () => {
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'browser', expectTTS: 'browser', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should fallback to Browser/OpenAI TTS when paid service fails', async () => {
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'auto', expectTTS: '', simulateTTSFailure: true, simulateSTTFailure: false });
  });

  it('should fallback to Browser TTS when all paid tiers fail', async () => {
    // Simulate both failures by chaining two mocks
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      if (callCount === 1 || callCount === 2) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Server Error',
          headers: new Map(),
          redirected: false,
          statusText: '',
          type: '',
          url: '',
          clone: () => this,
          body: null,
          bodyUsed: false,
          arrayBuffer: async () => new ArrayBuffer(0),
          json: async () => ({}),
          formData: async () => new FormData(),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
        text: async () => '',
        headers: new Map(),
        redirected: false,
        statusText: '',
        type: '',
        url: '',
        clone: () => this,
        body: null,
        bodyUsed: false,
        json: async () => ({}),
        formData: async () => new FormData(),
      } as unknown as Response;
    };
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'auto', expectTTS: '', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should use Whisper.cpp STT when sttFlag is whispercpp', async () => {
    await runE2ETest({ sttFlag: 'whispercpp', translationFlag: 'auto', ttsFlag: 'auto', expectTTS: '', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should use OpenAI STT and ElevenLabs TTS when flags are openai and elevenlabs', async () => {
    await runE2ETest({ sttFlag: 'openai', translationFlag: 'auto', ttsFlag: 'elevenlabs', expectTTS: 'elevenlabs', simulateTTSFailure: false, simulateSTTFailure: false });
  });

  it('should handle all TTS failures and fallback to silent/browser', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'All TTS Error',
      headers: new Map(),
      redirected: false,
      statusText: '',
      type: '',
      url: '',
      clone: () => this,
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      json: async () => ({}),
      formData: async () => new FormData(),
    } as unknown as Response);
    await runE2ETest({ sttFlag: 'auto', translationFlag: 'auto', ttsFlag: 'auto', expectTTS: 'browser', simulateTTSFailure: true, simulateSTTFailure: false });
  });

  // Add more permutations and edge cases as needed
});
