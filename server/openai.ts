/**
 * OpenAI Service Facade
 * 
 * This module provides a clean, simplified interface to OpenAI-powered
 * transcription and translation services. It acts as a facade pattern
 * implementation, hiding the complexity of the underlying services.
 * 
 * Design Principles Applied:
 * - Facade Pattern: Simplifies complex subsystem interfaces
 * - DRY (Don't Repeat Yourself): Centralizes OpenAI service access
 * - Single Responsibility: Only responsible for exposing translation API
 */

import OpenAI from 'openai'; // Added import for OpenAI
import { config } from './config'; // Added import for config

// --- Added OpenAI utility functions to satisfy openai.test.ts ---
let openAIInstance: OpenAI | null = null;

export function getOpenAIInstance(): OpenAI {
  if (!config.openai?.apiKey) {
    // Ensure your config structure matches: config.openai.apiKey
    throw new Error('OpenAI API key is not configured. Check server/config.ts and ensure config.openai.apiKey is set.');
  }
  if (!openAIInstance) {
    openAIInstance = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openAIInstance;
}

export async function getOpenAIEmbeddings(input: string): Promise<any> {
  const openai = getOpenAIInstance() as any; 
  // Use the correct embeddings endpoint
  const response = await openai.embeddings.create({ 
    input: input,
    model: 'text-embedding-ada-002'
  });
  
  // Return the embedding data directly from the embeddings API response
  return response.data[0].embedding;
}

export async function getOpenAIChat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string | null> {
  const openai = getOpenAIInstance() as any; 
  // This implementation uses openai.chat.completions.create to match the actual SDK and test mock structure.
  const response = await openai.chat.completions.create({ 
    messages: messages,
    model: 'gpt-3.5-turbo' // Example chat model, adjust if necessary or ensure tests mock appropriately
  });
  return response.choices[0]?.message?.content ?? null;
}
// --- End of added OpenAI utility functions ---