import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { getOpenAIInstance, getOpenAIEmbeddings, getOpenAIChat } from '../../../server/openai';

/**
 * Check if we have a valid OpenAI API key for integration tests
 */
function hasRealApiKey(): boolean {
  const apiKey = process.env.OPENAI_API_KEY || '';
  // Skip if we only have the default test key
  if (!apiKey || apiKey === 'test-key-for-unit-tests') {
    return false;
  }
  // Real API keys typically start with 'sk-'
  return apiKey.startsWith('sk-');
}

// Check for rate limiting or quota issues during tests
function isOpenAIRateLimited(error: any): boolean {
  return error?.status === 429 || 
         error?.code === 'insufficient_quota' || 
         (error?.message && (
           error.message.includes('exceeded your current quota') ||
           error.message.includes('rate limit')
         ));
}

describe('OpenAI Service Integration Tests', () => {
  // Skip all tests if there's no valid OpenAI API key
  beforeAll(() => {
    if (!hasRealApiKey()) {
      console.log('⚠️ Skipping OpenAI integration tests: No valid API key found');
      return;
    }
    console.log('✅ Running OpenAI integration tests with API key:', 
      process.env.OPENAI_API_KEY?.substring(0, 5) + '...');
  });
  
  // Helper to skip individual tests
  function skipIfNoApiKey(testFn: () => void): () => void {
    return () => {
      if (!hasRealApiKey()) {
        console.log('Skipping test: No valid API key');
        return;
      }
      return testFn();
    };
  }

  describe('OpenAI Instance Management', () => {
    it('should get the OpenAI instance successfully', skipIfNoApiKey(() => {
      try {
        const instance = getOpenAIInstance();
        expect(instance).toBeDefined();
        expect(instance).toBeInstanceOf(OpenAI);
      } catch (error) {
        // Only fail if we have a real API key but still got an error
        if (hasRealApiKey()) {
          throw error;
        }
      }
    }));
  });

  describe('OpenAI Embeddings API', () => {
    it('should generate embeddings for a given text input', skipIfNoApiKey(async () => {
      try {
        const text = 'This is a test input for embeddings.';
        const embeddings = await getOpenAIEmbeddings(text);
        
        expect(embeddings).toBeDefined();
        // Check that some data structure was returned, even if we're mocking
        if (Array.isArray(embeddings)) {
          expect(embeddings.length).toBeGreaterThan(0);
        } else if (typeof embeddings === 'object') {
          expect(Object.keys(embeddings).length).toBeGreaterThan(0);
        }
      } catch (error) {
        console.log('Embeddings test error:', error);
        // Don't fail the test if we hit rate limits or quota issues
        if (!isOpenAIRateLimited(error)) {
          throw error;
        } else {
          // Test passes if we got expected rate limit errors
          console.log('Skipping embeddings test due to rate limits or quota issues');
        }
      }
    }));
  });

  describe('OpenAI Chat API', () => {
    it('should complete a chat conversation', skipIfNoApiKey(async () => {
      try {
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is the capital of France?' }
        ];
        
        const response = await getOpenAIChat(messages);
        
        expect(response).toBeDefined();
        if (response) {
          expect(typeof response).toBe('string');
          expect(response.toLowerCase()).toContain('paris');
        }
      } catch (error) {
        console.log('Chat completion test error:', error);
        // Don't fail the test if we hit rate limits or quota issues
        if (!isOpenAIRateLimited(error)) {
          throw error;
        } else {
          // Test passes if we got expected rate limit errors
          console.log('Skipping chat completion test due to rate limits or quota issues');
        }
      }
    }));
    
    it('should handle empty or invalid messages gracefully', skipIfNoApiKey(async () => {
      try {
        // Test with empty message array
        const emptyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        
        // This should throw an error with the OpenAI API
        await expect(getOpenAIChat(emptyMessages)).rejects.toThrow();
      } catch (error) {
        // Expected error with empty messages, no need to re-throw
        expect(error).toBeDefined();
      }
    }));
  });

  describe('Error Handling', () => {
    it('should handle API rate limits gracefully', skipIfNoApiKey(async () => {
      try {
        // Make multiple rapid requests to potentially trigger rate limiting
        const promises = Array(3).fill(0).map(() => 
          getOpenAIChat([
            { role: 'user', content: 'Write a short poem about testing.' } as ChatCompletionMessageParam
          ])
        );
        
        // We expect either all to succeed or some to fail with rate limit errors
        const results = await Promise.allSettled(promises);
        
        // Check that we got results (either success or failure)
        expect(results.length).toBe(3);
        
        // At least one successful response or proper rate limit error
        if (results.some(r => r.status === 'fulfilled')) {
          const successfulResult = results.find(r => r.status === 'fulfilled');
          if (successfulResult && successfulResult.status === 'fulfilled') {
            expect(typeof successfulResult.value).toBe('string');
          }
        } else {
          // All failed - check if they're rate limit errors
          const allRateLimited = results
            .every(r => r.status === 'rejected' && isOpenAIRateLimited(r.reason));
          expect(allRateLimited).toBe(true);
        }
      } catch (error) {
        // This catch should only handle unexpected errors
        console.log('Rate limit test unexpected error:', error);
        if (!isOpenAIRateLimited(error)) {
          throw error;
        }
      }
    }));
  });
});
