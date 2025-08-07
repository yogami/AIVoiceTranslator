

// Import robust fs and util.promisify mocks (must be first!)
import '../../test-helpers/fs-promisify-mocks';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOpenAICreate = vi.fn();
const mockElevenLabsFetch = vi.fn();
const mockWhisperNode = vi.fn();

vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockOpenAICreate
      }
    }
  }))
}));

// SUT import
import { AutoFallbackSTTService } from '../../../server/services/stttranscription/AutoFallbackSTTService';

// Minimal component test for fallback logic

describe('AutoFallbackSTTService (component)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
  });

  it('should transcribe using OpenAI', async () => {
    mockOpenAICreate.mockResolvedValue({ text: 'openai result' });
    const service = new AutoFallbackSTTService();
    const result = await service.transcribe(Buffer.from('audio'), 'en');
    expect(result).toBe('openai result');
    expect(mockOpenAICreate).toHaveBeenCalled();
  });

  it('should fallback to ElevenLabs if OpenAI fails', async () => {
    mockOpenAICreate.mockRejectedValue(new Error('fail'));
    global.fetch = mockElevenLabsFetch;
    mockElevenLabsFetch.mockResolvedValue({ ok: true, json: async () => ({ text: 'elevenlabs result' }) });
    const service = new AutoFallbackSTTService();
    const result = await service.transcribe(Buffer.from('audio'), 'en');
    expect(result).toBe('elevenlabs result');
    expect(mockElevenLabsFetch).toHaveBeenCalled();
  });

  it('should fallback to Whisper if both OpenAI and ElevenLabs fail', async () => {
    mockOpenAICreate.mockRejectedValue(new Error('fail'));
    global.fetch = mockElevenLabsFetch;
    mockElevenLabsFetch.mockRejectedValue(new Error('fail'));
    vi.mock('whisper-node', () => ({
      default: vi.fn(() => mockWhisperNode)
    }));
    mockWhisperNode.mockResolvedValue([{ speech: 'whisper result' }]);
    const service = new AutoFallbackSTTService();
    const result = await service.transcribe(Buffer.from('audio'), 'en');
    expect(result).toBe('whisper result');
    expect(mockWhisperNode).toHaveBeenCalled();
  });
});