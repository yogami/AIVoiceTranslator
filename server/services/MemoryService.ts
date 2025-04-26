/**
 * Memory Service
 * 
 * This service provides a convenient API for interacting with
 * the assistant's memory system from various parts of the application.
 */

import { assistantMemory } from './AssistantMemoryManager';

class MemoryService {
  /**
   * Initialize the memory system and migrate existing data
   */
  public async initialize(): Promise<void> {
    try {
      // Migrate data from files to the database
      await assistantMemory.initializeFromFiles();
      
      // Log initialization success
      console.log('Memory system initialized successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize memory system:', errorMessage);
    }
  }
  
  /**
   * Store GitHub configuration
   */
  public async storeGitHubConfig(config: Record<string, any>): Promise<void> {
    try {
      await assistantMemory.storeGitHubConfig(config);
      console.log('GitHub configuration stored successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to store GitHub configuration:', errorMessage);
    }
  }
  
  /**
   * Get GitHub configuration
   */
  public async getGitHubConfig(): Promise<Record<string, any>> {
    try {
      return await assistantMemory.getGitHubConfig();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to retrieve GitHub configuration:', errorMessage);
      return {};
    }
  }
  
  /**
   * Store project configuration
   */
  public async storeProjectConfig(config: Record<string, any>): Promise<void> {
    try {
      await assistantMemory.storeProjectConfig(config);
      console.log('Project configuration stored successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to store project configuration:', errorMessage);
    }
  }
  
  /**
   * Get project configuration
   */
  public async getProjectConfig(): Promise<Record<string, any>> {
    try {
      return await assistantMemory.getProjectConfig();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to retrieve project configuration:', errorMessage);
      return {};
    }
  }
  
  /**
   * Store a conversation exchange
   */
  public async storeConversation(
    userMessage: string,
    assistantMessage: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      await assistantMemory.storeConversation(userMessage, assistantMessage, context);
      console.log('Conversation stored successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to store conversation:', errorMessage);
    }
  }
  
  /**
   * Get conversation history for current session
   */
  public async getSessionConversations(): Promise<any[]> {
    try {
      return await assistantMemory.getSessionConversations();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to retrieve session conversations:', errorMessage);
      return [];
    }
  }
  
  /**
   * Store memory item
   */
  public async storeMemory(key: string, value: string, category: string): Promise<void> {
    try {
      await assistantMemory.storeMemory(key, value, category);
      console.log(`Memory item '${key}' stored successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to store memory item '${key}':`, errorMessage);
    }
  }
  
  /**
   * Get memory item
   */
  public async getMemory(key: string): Promise<string | undefined> {
    try {
      const memoryItem = await assistantMemory.getMemory(key);
      return memoryItem?.value;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to retrieve memory item '${key}':`, errorMessage);
      return undefined;
    }
  }
  
  /**
   * Get all memories in a category
   */
  public async getMemoriesByCategory(category: string): Promise<Array<{key: string, value: string}>> {
    try {
      const memories = await assistantMemory.getMemoriesByCategory(category);
      return memories.map(mem => ({
        key: mem.key,
        value: mem.value
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to retrieve memories in category '${category}':`, errorMessage);
      return [];
    }
  }
  
  /**
   * Search memories and conversations
   */
  public async search(query: string): Promise<{
    memories: Array<{key: string, value: string, category: string}>;
    conversations: Array<{userMessage: string, assistantMessage: string}>;
  }> {
    try {
      const results = await assistantMemory.search(query);
      
      return {
        memories: results.memories.map(mem => ({
          key: mem.key,
          value: mem.value,
          category: mem.category
        })),
        conversations: results.conversations.map(conv => ({
          userMessage: conv.userMessage,
          assistantMessage: conv.assistantMessage
        }))
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to search for '${query}':`, errorMessage);
      return { memories: [], conversations: [] };
    }
  }
  
  /**
   * Get the session ID for linking related information
   */
  public getSessionId(): string {
    return assistantMemory.getSessionId();
  }
}

// Export a singleton instance
export const memoryService = new MemoryService();