/**
 * Assistant Memory System Test
 * 
 * This script tests the PostgreSQL-based memory system by:
 * 1. Migrating existing data from files to the database
 * 2. Storing new data in the database
 * 3. Retrieving data from the database
 * 4. Searching for data across different categories
 */

import { memoryService } from './server/services/MemoryService.js';

async function testMemorySystem() {
  console.log('Starting memory system test...');
  
  try {
    // 1. Initialize the memory system (migrates data from files)
    await memoryService.initialize();
    console.log('Memory system initialized successfully');
    
    // 2. Store GitHub configuration
    const githubConfig = {
      username: 'YourGitHubUsername',
      repository: 'AIVoiceTranslator',
      token: 'Environment secret GITHUB_TOKEN is available',
      lastCommit: {
        date: '2025-04-26',
        message: 'Implement PostgreSQL-based memory system',
        files: [
          'server/services/AssistantMemoryManager.ts',
          'server/services/MemoryService.ts'
        ]
      }
    };
    
    await memoryService.storeGitHubConfig(githubConfig);
    console.log('GitHub configuration stored successfully');
    
    // 3. Store project configuration
    const projectConfig = {
      name: 'AIVoiceTranslator',
      description: 'Real-time voice translation system for classroom environments',
      version: '0.1.0',
      features: [
        'WebSocket communication',
        'Speech recognition',
        'Real-time translation',
        'Text-to-speech synthesis'
      ],
      lastUpdated: new Date().toISOString()
    };
    
    await memoryService.storeProjectConfig(projectConfig);
    console.log('Project configuration stored successfully');
    
    // 4. Store a memory item
    await memoryService.storeMemory(
      'database_migration_status', 
      'Completed successfully on ' + new Date().toISOString(),
      'system'
    );
    console.log('Memory item stored successfully');
    
    // 5. Store a conversation
    await memoryService.storeConversation(
      'Please implement a PostgreSQL-based memory system',
      'I\'ve implemented a PostgreSQL-based memory system with migration from file-based storage',
      { timestamp: new Date().toISOString() }
    );
    console.log('Conversation stored successfully');
    
    // 6. Retrieve data
    const retrievedGithubConfig = await memoryService.getGitHubConfig();
    console.log('Retrieved GitHub config:', JSON.stringify(retrievedGithubConfig, null, 2));
    
    const retrievedProjectConfig = await memoryService.getProjectConfig();
    console.log('Retrieved project config:', JSON.stringify(retrievedProjectConfig, null, 2));
    
    const retrievedMemory = await memoryService.getMemory('database_migration_status');
    console.log('Retrieved memory item:', retrievedMemory);
    
    const conversations = await memoryService.getSessionConversations();
    console.log('Retrieved conversations:', JSON.stringify(conversations, null, 2));
    
    // 7. Search for data
    const searchResults = await memoryService.search('PostgreSQL');
    console.log('Search results:', JSON.stringify(searchResults, null, 2));
    
    console.log('Memory system test completed successfully');
  } catch (error) {
    console.error('Error testing memory system:', error);
  }
}

// Run the test
testMemorySystem().catch(error => {
  console.error('Unhandled error in test:', error);
});