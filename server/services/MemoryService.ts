/**
 * MemoryService.ts
 * 
 * This service provides persistent memory capabilities for the AI Voice Translator project.
 * It allows storing and retrieving key-value data, conversation history, and configuration
 * information across sessions, enabling the AI assistant to maintain context.
 */

import { db } from '../db';
import { memory, conversations, configuration, insertMemorySchema, insertConversationSchema, insertConfigurationSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface MemoryServiceInterface {
  // Basic key-value memory operations
  store(key: string, value: any, category: string): Promise<void>;
  retrieve(key: string): Promise<any | null>;
  retrieveByCategory(category: string): Promise<Record<string, any>>;
  delete(key: string): Promise<void>;
  
  // Conversation history operations
  storeConversation(sessionId: string, userMessage: string, assistantMessage: string, context?: any): Promise<void>;
  getConversationHistory(sessionId: string, limit?: number): Promise<any[]>;
  getRecentConversations(limit?: number): Promise<any[]>;
  
  // Configuration operations
  storeConfiguration(name: string, value: any): Promise<void>;
  getConfiguration(name: string): Promise<any | null>;
  getAllConfiguration(): Promise<Record<string, any>>;
}

export class MemoryService implements MemoryServiceInterface {
  
  /**
   * Store a key-value pair in memory
   * @param key The unique identifier for this data
   * @param value The value to store (will be stringified if object)
   * @param category The category for organizing memory items
   */
  async store(key: string, value: any, category: string): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    try {
      // Check if key already exists
      const existing = await db.select().from(memory).where(eq(memory.key, key));
      
      if (existing.length > 0) {
        // Update existing record
        await db.update(memory)
          .set({ value: stringValue, category, timestamp: new Date() })
          .where(eq(memory.key, key));
      } else {
        // Insert new record
        await db.insert(memory).values({
          key,
          value: stringValue,
          category,
        });
      }
      
      console.log(`Memory stored: ${key} in category ${category}`);
    } catch (error) {
      console.error(`Error storing memory: ${error.message}`);
      throw new Error(`Failed to store memory: ${error.message}`);
    }
  }
  
  /**
   * Retrieve a value from memory by key
   * @param key The key to look up
   * @returns The stored value, or null if not found
   */
  async retrieve(key: string): Promise<any | null> {
    try {
      const result = await db.select().from(memory).where(eq(memory.key, key));
      
      if (result.length === 0) {
        return null;
      }
      
      const { value } = result[0];
      
      // Try to parse as JSON, return as string if not valid JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`Error retrieving memory: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Retrieve all memory items in a specific category
   * @param category The category to retrieve
   * @returns Object with key-value pairs from that category
   */
  async retrieveByCategory(category: string): Promise<Record<string, any>> {
    try {
      const results = await db.select()
        .from(memory)
        .where(eq(memory.category, category));
      
      const categoryData: Record<string, any> = {};
      
      for (const item of results) {
        // Try to parse as JSON, use as string if not valid JSON
        try {
          categoryData[item.key] = JSON.parse(item.value);
        } catch {
          categoryData[item.key] = item.value;
        }
      }
      
      return categoryData;
    } catch (error) {
      console.error(`Error retrieving category: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Delete a memory item by key
   * @param key The key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      await db.delete(memory).where(eq(memory.key, key));
      console.log(`Memory deleted: ${key}`);
    } catch (error) {
      console.error(`Error deleting memory: ${error.message}`);
      throw new Error(`Failed to delete memory: ${error.message}`);
    }
  }
  
  /**
   * Store a conversation exchange between user and assistant
   * @param sessionId Unique identifier for the conversation session
   * @param userMessage The message from the user
   * @param assistantMessage The response from the assistant
   * @param context Optional context data for the conversation
   */
  async storeConversation(
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
    context?: any
  ): Promise<void> {
    try {
      await db.insert(conversations).values({
        sessionId,
        userMessage,
        assistantMessage,
        context: context || null,
      });
      console.log(`Conversation stored for session ${sessionId}`);
    } catch (error) {
      console.error(`Error storing conversation: ${error.message}`);
      throw new Error(`Failed to store conversation: ${error.message}`);
    }
  }
  
  /**
   * Get conversation history for a specific session
   * @param sessionId The session to retrieve history for
   * @param limit Maximum number of conversation exchanges to retrieve
   * @returns Array of conversation exchanges
   */
  async getConversationHistory(sessionId: string, limit: number = 100): Promise<any[]> {
    try {
      const history = await db.select()
        .from(conversations)
        .where(eq(conversations.sessionId, sessionId))
        .orderBy(conversations.timestamp)
        .limit(limit);
      
      return history;
    } catch (error) {
      console.error(`Error retrieving conversation history: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get recent conversations across all sessions
   * @param limit Maximum number of conversation exchanges to retrieve
   * @returns Array of recent conversation exchanges
   */
  async getRecentConversations(limit: number = 50): Promise<any[]> {
    try {
      const recent = await db.select()
        .from(conversations)
        .orderBy(conversations.timestamp)
        .limit(limit);
      
      return recent;
    } catch (error) {
      console.error(`Error retrieving recent conversations: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Store configuration settings
   * @param name Configuration name/key
   * @param value Configuration value (object)
   */
  async storeConfiguration(name: string, value: any): Promise<void> {
    try {
      // Check if configuration already exists
      const existing = await db.select().from(configuration).where(eq(configuration.name, name));
      
      if (existing.length > 0) {
        // Update existing configuration
        await db.update(configuration)
          .set({ value, updatedAt: new Date() })
          .where(eq(configuration.name, name));
      } else {
        // Insert new configuration
        await db.insert(configuration).values({
          name,
          value,
        });
      }
      
      console.log(`Configuration stored: ${name}`);
    } catch (error) {
      console.error(`Error storing configuration: ${error.message}`);
      throw new Error(`Failed to store configuration: ${error.message}`);
    }
  }
  
  /**
   * Get configuration by name
   * @param name Configuration name to retrieve
   * @returns Configuration value or null if not found
   */
  async getConfiguration(name: string): Promise<any | null> {
    try {
      const result = await db.select().from(configuration).where(eq(configuration.name, name));
      
      if (result.length === 0) {
        return null;
      }
      
      return result[0].value;
    } catch (error) {
      console.error(`Error retrieving configuration: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get all configuration settings
   * @returns Object with all configuration settings
   */
  async getAllConfiguration(): Promise<Record<string, any>> {
    try {
      const results = await db.select().from(configuration);
      
      const allConfig: Record<string, any> = {};
      for (const item of results) {
        allConfig[item.name] = item.value;
      }
      
      return allConfig;
    } catch (error) {
      console.error(`Error retrieving all configuration: ${error.message}`);
      return {};
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();