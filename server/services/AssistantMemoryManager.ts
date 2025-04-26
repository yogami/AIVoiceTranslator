/**
 * Assistant Memory Manager
 * 
 * This service manages the persistent memory for the AI assistant using PostgreSQL.
 * It provides methods to store and retrieve various types of memory data including:
 * - Configuration settings
 * - Conversation history
 * - Technical decisions
 * - Project context
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { 
  memory,
  conversations,
  configuration,
  type Memory,
  type InsertMemory,
  type Conversation,
  type InsertConversation,
  type Configuration,
  type InsertConfiguration
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export class AssistantMemoryManager {
  private static instance: AssistantMemoryManager;
  private sessionId: string;

  private constructor() {
    // Generate a unique session ID for this conversation
    this.sessionId = uuidv4();
    console.log(`AssistantMemoryManager initialized with session ID: ${this.sessionId}`);
  }

  /**
   * Get the singleton instance of the memory manager
   */
  public static getInstance(): AssistantMemoryManager {
    if (!AssistantMemoryManager.instance) {
      AssistantMemoryManager.instance = new AssistantMemoryManager();
    }
    return AssistantMemoryManager.instance;
  }

  /**
   * Get the current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Store a key-value pair in memory
   */
  public async storeMemory(key: string, value: string, category: string): Promise<Memory> {
    try {
      // Check if this key already exists
      const existingMemory = await db.select()
        .from(memory)
        .where(eq(memory.key, key))
        .limit(1);

      if (existingMemory.length > 0) {
        // Update existing memory
        const [updated] = await db.update(memory)
          .set({ value, category, timestamp: new Date() })
          .where(eq(memory.id, existingMemory[0].id))
          .returning();
        return updated;
      } else {
        // Insert new memory
        const memoryData: InsertMemory = {
          key,
          value,
          category
        };
        const [result] = await db.insert(memory).values(memoryData).returning();
        return result;
      }
    } catch (error) {
      console.error('Error storing memory:', error);
      throw new Error(`Failed to store memory: ${error.message}`);
    }
  }

  /**
   * Retrieve a memory value by key
   */
  public async getMemory(key: string): Promise<Memory | undefined> {
    try {
      const [result] = await db.select()
        .from(memory)
        .where(eq(memory.key, key))
        .limit(1);
      return result;
    } catch (error) {
      console.error('Error retrieving memory:', error);
      return undefined;
    }
  }

  /**
   * Get all memories in a specific category
   */
  public async getMemoriesByCategory(category: string): Promise<Memory[]> {
    try {
      return await db.select()
        .from(memory)
        .where(eq(memory.category, category))
        .orderBy(desc(memory.timestamp));
    } catch (error) {
      console.error('Error retrieving memories by category:', error);
      return [];
    }
  }

  /**
   * Store a conversation exchange between the user and assistant
   */
  public async storeConversation(
    userMessage: string,
    assistantMessage: string,
    context?: any
  ): Promise<Conversation> {
    try {
      const conversationData: InsertConversation = {
        sessionId: this.sessionId,
        userMessage,
        assistantMessage,
        context: context || null
      };
      
      const [result] = await db.insert(conversations)
        .values(conversationData)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error storing conversation:', error);
      throw new Error(`Failed to store conversation: ${error.message}`);
    }
  }

  /**
   * Get conversation history for the current session
   */
  public async getSessionConversations(): Promise<Conversation[]> {
    try {
      return await db.select()
        .from(conversations)
        .where(eq(conversations.sessionId, this.sessionId))
        .orderBy(conversations.timestamp);
    } catch (error) {
      console.error('Error retrieving session conversations:', error);
      return [];
    }
  }

  /**
   * Get all conversations across all sessions
   */
  public async getAllConversations(limit: number = 50): Promise<Conversation[]> {
    try {
      return await db.select()
        .from(conversations)
        .orderBy(desc(conversations.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('Error retrieving all conversations:', error);
      return [];
    }
  }

  /**
   * Store configuration settings
   */
  public async storeConfiguration(name: string, value: any): Promise<Configuration> {
    try {
      // Check if this configuration already exists
      const existingConfig = await db.select()
        .from(configuration)
        .where(eq(configuration.name, name))
        .limit(1);

      if (existingConfig.length > 0) {
        // Update existing configuration
        const [updated] = await db.update(configuration)
          .set({ value, updatedAt: new Date() })
          .where(eq(configuration.id, existingConfig[0].id))
          .returning();
        return updated;
      } else {
        // Insert new configuration
        const configData: InsertConfiguration = {
          name,
          value
        };
        const [result] = await db.insert(configuration).values(configData).returning();
        return result;
      }
    } catch (error) {
      console.error('Error storing configuration:', error);
      throw new Error(`Failed to store configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration settings by name
   */
  public async getConfiguration(name: string): Promise<Configuration | undefined> {
    try {
      const [result] = await db.select()
        .from(configuration)
        .where(eq(configuration.name, name))
        .limit(1);
      return result;
    } catch (error) {
      console.error('Error retrieving configuration:', error);
      return undefined;
    }
  }

  /**
   * Get all configuration settings
   */
  public async getAllConfigurations(): Promise<Configuration[]> {
    try {
      return await db.select().from(configuration);
    } catch (error) {
      console.error('Error retrieving all configurations:', error);
      return [];
    }
  }

  /**
   * Store GitHub configuration
   */
  public async storeGitHubConfig(config: any): Promise<Configuration> {
    return this.storeConfiguration('github', config);
  }

  /**
   * Get GitHub configuration
   */
  public async getGitHubConfig(): Promise<any> {
    const config = await this.getConfiguration('github');
    return config?.value || {};
  }

  /**
   * Store project configuration
   */
  public async storeProjectConfig(config: any): Promise<Configuration> {
    return this.storeConfiguration('project', config);
  }

  /**
   * Get project configuration
   */
  public async getProjectConfig(): Promise<any> {
    const config = await this.getConfiguration('project');
    return config?.value || {};
  }

  /**
   * Search for memories and conversations by text query
   */
  public async search(query: string): Promise<{memories: Memory[], conversations: Conversation[]}> {
    try {
      // Search in memories
      const matchingMemories = await db.select()
        .from(memory)
        .where(sql`${memory.value} ILIKE ${`%${query}%`}`)
        .orderBy(desc(memory.timestamp))
        .limit(10);
      
      // Search in conversations
      const matchingConversations = await db.select()
        .from(conversations)
        .where(
          sql`${conversations.userMessage} ILIKE ${`%${query}%`} OR 
              ${conversations.assistantMessage} ILIKE ${`%${query}%`}`
        )
        .orderBy(desc(conversations.timestamp))
        .limit(10);
      
      return {
        memories: matchingMemories,
        conversations: matchingConversations
      };
    } catch (error) {
      console.error('Error searching memory:', error);
      return { memories: [], conversations: [] };
    }
  }

  /**
   * Initialize by migrating data from file-based storage
   */
  public async initializeFromFiles(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const memoryDir = '.assistant_memory';
      
      // Check if directory exists
      if (!fs.existsSync(memoryDir)) {
        console.log('Memory directory not found, skipping initialization');
        return;
      }
      
      // Migrate GitHub config
      const githubConfigPath = path.join(memoryDir, 'github_config.json');
      if (fs.existsSync(githubConfigPath)) {
        const githubConfig = JSON.parse(fs.readFileSync(githubConfigPath, 'utf-8'));
        await this.storeGitHubConfig(githubConfig);
        console.log('GitHub configuration migrated to database');
      }
      
      // Migrate project config
      const projectConfigPath = path.join(memoryDir, 'project_config.json');
      if (fs.existsSync(projectConfigPath)) {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
        await this.storeProjectConfig(projectConfig);
        console.log('Project configuration migrated to database');
      }
      
      // Store conversation history as a memory entry
      const conversationHistoryPath = path.join(memoryDir, 'conversation_history.md');
      if (fs.existsSync(conversationHistoryPath)) {
        const conversationHistory = fs.readFileSync(conversationHistoryPath, 'utf-8');
        await this.storeMemory('conversation_history', conversationHistory, 'history');
        console.log('Conversation history migrated to database');
      }
      
      // Store session journal as a memory entry
      const sessionJournalPath = path.join(memoryDir, 'session_journal.md');
      if (fs.existsSync(sessionJournalPath)) {
        const sessionJournal = fs.readFileSync(sessionJournalPath, 'utf-8');
        await this.storeMemory('session_journal', sessionJournal, 'journal');
        console.log('Session journal migrated to database');
      }
      
      console.log('Memory initialization from files complete');
    } catch (error) {
      console.error('Error initializing memory from files:', error);
    }
  }
}

// Export the singleton instance
export const assistantMemory = AssistantMemoryManager.getInstance();