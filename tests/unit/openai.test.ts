/**
 * OpenAI Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { getOpenAIInstance, getOpenAIEmbeddings, getOpenAIChat } from '../../server/openai'; 

vi.mock('openai');
vi.mock('../../server/config', () => ({
  config: {
    openai: {
      apiKey: 'mock-api-key-from-openai-test-specific-mock',
    },
  },
}));

describe('OpenAI Service', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    embeddings: {
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock implementation details for OpenAI methods
    (OpenAI as any).mockImplementation(() => mockOpenAI);
  });

  describe('getOpenAIInstance', () => {
    it('should return an instance of OpenAI', () => {
      const instance = getOpenAIInstance();
      expect(instance).toBeDefined();
      // Adjusted to check for the correct path to the mocked create function
      expect(typeof (instance.chat.completions as any).create).toBe('function'); 
    });
  });

  describe('getOpenAIEmbeddings', () => {
    it('should return embeddings for the given input', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockOpenAI.embeddings.create.mockResolvedValueOnce({ data: [{ embedding: mockEmbedding }] });

      const embeddings = await getOpenAIEmbeddings('test input');
      expect(embeddings).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOpenAIChat', () => {
    it('should return a chat response for the given messages', async () => {
      const mockResponse = 'Hello, how can I assist you?';
      // Adjusted to mock the correct path
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({ choices: [{ message: { content: mockResponse } }] });

      const response = await getOpenAIChat([{ role: 'user', content: 'Hi' }]);
      expect(response).toBe(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});
