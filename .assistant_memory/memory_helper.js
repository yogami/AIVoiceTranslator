/**
 * Assistant Memory Helper
 * 
 * This simple script helps manage the assistant's memory
 * files for maintaining context across sessions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_DIR = path.resolve(__dirname, '..');

// Helper functions for working with memory files
const memoryHelper = {
  /**
   * Update GitHub configuration
   * @param {Object} config - GitHub configuration to update
   */
  updateGitHubConfig: (config) => {
    const configPath = path.join(MEMORY_DIR, 'github_config.json');
    let currentConfig = {};
    
    // Read existing config if it exists
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      currentConfig = JSON.parse(fileContent);
    }
    
    // Merge with new config
    const updatedConfig = { ...currentConfig, ...config };
    
    // Write updated config
    fs.writeFileSync(
      configPath,
      JSON.stringify(updatedConfig, null, 2),
      'utf8'
    );
    
    console.log('GitHub configuration updated');
    return updatedConfig;
  },
  
  /**
   * Update project configuration
   * @param {Object} config - Project configuration to update
   */
  updateProjectConfig: (config) => {
    const configPath = path.join(MEMORY_DIR, 'project_config.json');
    let currentConfig = {};
    
    // Read existing config if it exists
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      currentConfig = JSON.parse(fileContent);
    }
    
    // Merge with new config, handling nested objects
    const updatedConfig = mergeDeep(currentConfig, config);
    
    // Add last updated timestamp
    updatedConfig.lastUpdated = new Date().toISOString();
    
    // Write updated config
    fs.writeFileSync(
      configPath,
      JSON.stringify(updatedConfig, null, 2),
      'utf8'
    );
    
    console.log('Project configuration updated');
    return updatedConfig;
  },
  
  /**
   * Create a README for the memory system
   */
  createReadme: () => {
    const readmePath = path.join(MEMORY_DIR, 'README.md');
    const content = `# Assistant Memory

This directory contains files used by the AI assistant to maintain context across conversations. These files are not part of the actual AIVoiceTranslator project but are used to help us work together more efficiently by remembering important information.

## Files

- **project_config.json**: General information about the project
- **github_config.json**: GitHub repository information
- **conversation_history.md**: History of our important discussions
- **session_journal.md**: Technical decisions and progress notes

These files will be updated as we work together to maintain a persistent memory of our development work.`;
    
    fs.writeFileSync(readmePath, content, 'utf8');
    console.log('README created successfully');
  },
  
  /**
   * Add entry to conversation history
   * @param {string} title - Title for the conversation entry
   * @param {string} content - Content of the conversation
   */
  addConversationEntry: (title, content) => {
    const historyPath = path.join(MEMORY_DIR, 'conversation_history.md');
    const date = new Date().toISOString().split('T')[0];
    
    let historyContent = '';
    
    // Read existing history if it exists
    if (fs.existsSync(historyPath)) {
      historyContent = fs.readFileSync(historyPath, 'utf8');
    }
    
    // Check if today's date is already in the file
    if (historyContent.includes(`## ${date}`)) {
      // Append to today's section
      const updatedContent = historyContent.replace(
        `## ${date}`,
        `## ${date}\n\n### ${title}\n${content}`
      );
      fs.writeFileSync(historyPath, updatedContent, 'utf8');
    } else {
      // Add new date section
      const newEntry = `\n\n## ${date}\n\n### ${title}\n${content}`;
      fs.writeFileSync(historyPath, historyContent + newEntry, 'utf8');
    }
    
    console.log('Conversation history updated');
  },
  
  /**
   * Add entry to session journal
   * @param {string} sessionTitle - Title for the session
   * @param {Object} content - Content with context, decisions, and notes
   */
  addJournalEntry: (sessionTitle, content) => {
    const journalPath = path.join(MEMORY_DIR, 'session_journal.md');
    const date = new Date().toISOString().split('T')[0];
    
    let journalContent = '';
    
    // Read existing journal if it exists
    if (fs.existsSync(journalPath)) {
      journalContent = fs.readFileSync(journalPath, 'utf8');
    }
    
    // Format content sections
    let formattedContent = '';
    
    if (content.context) {
      formattedContent += '### Context\n';
      if (Array.isArray(content.context)) {
        content.context.forEach(item => {
          formattedContent += `- ${item}\n`;
        });
      } else {
        formattedContent += `${content.context}\n`;
      }
      formattedContent += '\n';
    }
    
    if (content.decisions) {
      formattedContent += '### Key Technical Decisions\n';
      if (Array.isArray(content.decisions)) {
        content.decisions.forEach(item => {
          formattedContent += `- ${item}\n`;
        });
      } else {
        formattedContent += `${content.decisions}\n`;
      }
      formattedContent += '\n';
    }
    
    if (content.notes) {
      formattedContent += '### User Experience Notes\n';
      if (Array.isArray(content.notes)) {
        content.notes.forEach(item => {
          formattedContent += `- ${item}\n`;
        });
      } else {
        formattedContent += `${content.notes}\n`;
      }
    }
    
    // Create new entry
    const newEntry = `\n\n## ${date} - ${sessionTitle}\n\n${formattedContent}`;
    
    // Write updated journal
    fs.writeFileSync(journalPath, journalContent + newEntry, 'utf8');
    
    console.log('Session journal updated');
  },
  
  /**
   * Create a new memory file
   * @param {string} fileName - Name of the file
   * @param {string|Object} content - Content to write to the file
   */
  createMemoryFile: (fileName, content) => {
    const filePath = path.join(MEMORY_DIR, fileName);
    
    // Ensure content is string
    const fileContent = typeof content === 'object' 
      ? JSON.stringify(content, null, 2) 
      : content;
    
    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`Memory file "${fileName}" created`);
  }
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is an object
 * @param {*} item - Item to check
 * @returns {boolean} Whether item is an object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

// Process command line arguments when run directly
const command = process.argv[2];
const args = process.argv.slice(3);

if (command) {
  switch (command) {
    case 'update-github':
      const githubConfig = JSON.parse(args[0]);
      memoryHelper.updateGitHubConfig(githubConfig);
      break;
      
    case 'update-project':
      const projectConfig = JSON.parse(args[0]);
      memoryHelper.updateProjectConfig(projectConfig);
      break;
      
    case 'add-conversation':
      const title = args[0];
      const content = args[1];
      memoryHelper.addConversationEntry(title, content);
      break;
      
    case 'add-journal':
      const sessionTitle = args[0];
      const journalContent = JSON.parse(args[1]);
      memoryHelper.addJournalEntry(sessionTitle, journalContent);
      break;
      
    case 'create-file':
      const fileName = args[0];
      const fileContent = args[1];
      memoryHelper.createMemoryFile(fileName, fileContent);
      break;
      
    case 'create-readme':
      memoryHelper.createReadme();
      break;
      
    default:
      console.log(`Unknown command: ${command}`);
      process.exit(1);
  }
}

export default memoryHelper;