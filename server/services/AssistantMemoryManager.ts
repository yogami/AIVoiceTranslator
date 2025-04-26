/**
 * AssistantMemoryManager.ts
 * 
 * High-level manager for maintaining AI assistant's memory across sessions.
 * Provides specialized methods for common memory patterns specifically for
 * the AI Voice Translator project.
 */

import { memoryService } from './MemoryService';
import { v4 as uuidv4 } from 'uuid';

// Memory categories
export const MEMORY_CATEGORIES = {
  GITHUB: 'github',
  PROJECT: 'project',
  USER_PREFERENCES: 'user_preferences',
  DEVELOPMENT_STATE: 'development_state',
  TEST_RESULTS: 'test_results',
  CONVERSATION_CONTEXT: 'conversation_context',
};

export class AssistantMemoryManager {
  private static instance: AssistantMemoryManager;
  private currentSessionId: string;
  
  private constructor() {
    this.currentSessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Get singleton instance
   * @returns AssistantMemoryManager instance
   */
  public static getInstance(): AssistantMemoryManager {
    if (!AssistantMemoryManager.instance) {
      AssistantMemoryManager.instance = new AssistantMemoryManager();
    }
    return AssistantMemoryManager.instance;
  }
  
  /**
   * Store GitHub credentials
   * @param username GitHub username
   * @param repoName GitHub repository name
   */
  async storeGitHubCredentials(username: string, repoName: string): Promise<void> {
    await memoryService.store('github_username', username, MEMORY_CATEGORIES.GITHUB);
    await memoryService.store('github_repo', repoName, MEMORY_CATEGORIES.GITHUB);
    
    // Also store in project configuration for easy access
    await this.updateProjectConfig({
      github: {
        username,
        repository: repoName
      }
    });
    
    console.log(`Stored GitHub credentials for ${username}/${repoName}`);
  }
  
  /**
   * Get GitHub credentials
   * @returns Object with username and repository name
   */
  async getGitHubCredentials(): Promise<{ username: string | null, repoName: string | null }> {
    const username = await memoryService.retrieve('github_username');
    const repoName = await memoryService.retrieve('github_repo');
    return { username, repoName };
  }
  
  /**
   * Store project state information
   * @param key Specific state key
   * @param value State value
   */
  async storeProjectState(key: string, value: any): Promise<void> {
    await memoryService.store(`project_state_${key}`, value, MEMORY_CATEGORIES.DEVELOPMENT_STATE);
  }
  
  /**
   * Get project state information
   * @param key Specific state key
   * @returns The stored state value or null
   */
  async getProjectState(key: string): Promise<any> {
    return await memoryService.retrieve(`project_state_${key}`);
  }
  
  /**
   * Update project configuration with partial config
   * @param configUpdate Partial configuration object to update
   */
  async updateProjectConfig(configUpdate: Record<string, any>): Promise<void> {
    // Get existing config or create new one
    const existingConfig = await memoryService.getConfiguration('project_config') || {};
    
    // Merge updates with existing config
    const updatedConfig = {
      ...existingConfig,
      ...configUpdate,
      lastUpdated: new Date().toISOString()
    };
    
    // Store updated config
    await memoryService.storeConfiguration('project_config', updatedConfig);
  }
  
  /**
   * Get complete project configuration
   * @returns Project configuration object
   */
  async getProjectConfig(): Promise<Record<string, any>> {
    return await memoryService.getConfiguration('project_config') || {};
  }
  
  /**
   * Remember current conversation exchange
   * @param userMessage Message from the user
   * @param assistantMessage Response from the assistant
   * @param context Additional context for this exchange
   */
  async rememberConversation(
    userMessage: string,
    assistantMessage: string,
    context?: any
  ): Promise<void> {
    await memoryService.storeConversation(
      this.currentSessionId,
      userMessage,
      assistantMessage,
      context
    );
  }
  
  /**
   * Get recent conversation history
   * @param limit Maximum number of exchanges to retrieve
   * @returns Array of conversation exchanges
   */
  async getRecentConversations(limit: number = 10): Promise<any[]> {
    return await memoryService.getRecentConversations(limit);
  }
  
  /**
   * Remember test results
   * @param testName Name of the test
   * @param passed Whether the test passed
   * @param details Additional test details
   */
  async rememberTestResult(testName: string, passed: boolean, details?: any): Promise<void> {
    const testResult = {
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };
    
    await memoryService.store(`test_result_${testName}`, testResult, MEMORY_CATEGORIES.TEST_RESULTS);
    
    // Update the list of tests
    const testsList = await this.getTestResultsList();
    if (!testsList.includes(testName)) {
      testsList.push(testName);
      await memoryService.store('tests_list', testsList, MEMORY_CATEGORIES.TEST_RESULTS);
    }
  }
  
  /**
   * Get list of all test names
   * @returns Array of test names
   */
  async getTestResultsList(): Promise<string[]> {
    const list = await memoryService.retrieve('tests_list');
    return Array.isArray(list) ? list : [];
  }
  
  /**
   * Get results for a specific test
   * @param testName Name of the test
   * @returns Test result or null
   */
  async getTestResult(testName: string): Promise<any> {
    return await memoryService.retrieve(`test_result_${testName}`);
  }
  
  /**
   * Remember user preference
   * @param key Preference key
   * @param value Preference value
   */
  async rememberUserPreference(key: string, value: any): Promise<void> {
    await memoryService.store(`user_pref_${key}`, value, MEMORY_CATEGORIES.USER_PREFERENCES);
  }
  
  /**
   * Get user preference
   * @param key Preference key
   * @returns Preference value or null
   */
  async getUserPreference(key: string): Promise<any> {
    return await memoryService.retrieve(`user_pref_${key}`);
  }
  
  /**
   * Track a development feature status
   * @param featureName Name of the feature
   * @param status Status of the feature (e.g., 'planned', 'in-progress', 'completed')
   * @param details Additional details about the feature
   */
  async trackFeature(featureName: string, status: string, details?: any): Promise<void> {
    const feature = {
      name: featureName,
      status,
      details,
      lastUpdated: new Date().toISOString()
    };
    
    await memoryService.store(`feature_${featureName}`, feature, MEMORY_CATEGORIES.DEVELOPMENT_STATE);
    
    // Update features list
    const featuresList = await this.getFeaturesList();
    if (!featuresList.includes(featureName)) {
      featuresList.push(featureName);
      await memoryService.store('features_list', featuresList, MEMORY_CATEGORIES.DEVELOPMENT_STATE);
    }
  }
  
  /**
   * Get list of all feature names
   * @returns Array of feature names
   */
  async getFeaturesList(): Promise<string[]> {
    const list = await memoryService.retrieve('features_list');
    return Array.isArray(list) ? list : [];
  }
  
  /**
   * Get status of a specific feature
   * @param featureName Name of the feature
   * @returns Feature status or null
   */
  async getFeatureStatus(featureName: string): Promise<any> {
    return await memoryService.retrieve(`feature_${featureName}`);
  }
  
  /**
   * Initialize core project memory on first use
   * This stores essential project information and configuration
   */
  async initializeProjectMemory(): Promise<void> {
    // Check if already initialized to avoid overwriting
    const isInitialized = await memoryService.retrieve('project_initialized');
    if (isInitialized) {
      return;
    }
    
    // Set up initial project configuration
    await this.updateProjectConfig({
      projectName: "AIVoiceTranslator",
      projectDescription: "Advanced multilingual communication web application that provides interactive, real-time language translation experiences",
      initializedDate: new Date().toISOString(),
      testingStrategy: {
        direct: "Using direct WebSocket testing for core functionality",
        selenium: "Using Selenium for browser-based UI testing",
        ci: "GitHub Actions workflows for automated CI/CD"
      }
    });
    
    // Initialize development workflow tracking
    await this.trackFeature('connect-button', 'completed', {
      description: 'Fix Connect button functionality in student interface',
      testMethod: 'Direct WebSocket testing'
    });
    
    // Mark as initialized
    await memoryService.store('project_initialized', true, MEMORY_CATEGORIES.PROJECT);
    console.log('Project memory initialized');
  }
}

// Export singleton instance
export const assistantMemory = AssistantMemoryManager.getInstance();