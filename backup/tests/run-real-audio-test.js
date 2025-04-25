#!/usr/bin/env node

/**
 * Run Real Audio Hardware Test for Benedictaitor
 * 
 * This script is a wrapper to run the real hardware test with proper environment
 * setup. It will:
 * 
 * 1. Check for dependencies and try to install them if needed
 * 2. Configure environment variables like OPENAI_API_KEY
 * 3. Run the real hardware test
 * 4. Report detailed results
 * 
 * This serves as a complete replacement for manual testing by using your actual
 * microphone and speakers to test the transcription functionality.
 */

import { spawn, spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m'
  }
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for user input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Check if server is running
async function checkServerRunning() {
  console.log(`${colors.bright}Checking if server is running...${colors.reset}`);
  
  try {
    const result = await fetch('http://localhost:5000/api/health', { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (result.ok) {
      console.log(`${colors.fg.green}✓ Server is running${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.fg.yellow}⚠ Server responded with status ${result.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.fg.red}✗ Server doesn't appear to be running${colors.reset}`);
    return false;
  }
}

// Start the server if it's not running
async function ensureServerRunning() {
  const isRunning = await checkServerRunning();
  
  if (!isRunning) {
    console.log(`${colors.bright}Server not detected. Do you want to start it now?${colors.reset}`);
    const startServer = await prompt('Start server? (Y/n): ');
    
    if (startServer.toLowerCase() !== 'n') {
      console.log(`${colors.fg.yellow}Starting server...${colors.reset}`);
      
      // Start the server in a detached process
      const server = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        detached: true
      });
      
      console.log(`${colors.fg.yellow}Waiting for server to initialize...${colors.reset}`);
      
      // Wait for server to start
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const running = await checkServerRunning();
        if (running) {
          return true;
        }
        attempts++;
        console.log(`${colors.fg.yellow}Still waiting for server (attempt ${attempts}/10)...${colors.reset}`);
      }
      
      console.log(`${colors.fg.red}Failed to detect server after multiple attempts.${colors.reset}`);
      return false;
    } else {
      console.log(`${colors.fg.yellow}Proceeding without starting server.${colors.reset}`);
      return false;
    }
  }
  
  return true;
}

// Check and prompt for OpenAI API key
async function ensureApiKey() {
  if (process.env.OPENAI_API_KEY) {
    console.log(`${colors.fg.green}✓ OPENAI_API_KEY is already set${colors.reset}`);
    return true;
  }
  
  console.log(`${colors.fg.yellow}⚠ OPENAI_API_KEY environment variable is not set${colors.reset}`);
  const setKey = await prompt('Would you like to provide an OpenAI API key? (Y/n): ');
  
  if (setKey.toLowerCase() !== 'n') {
    const apiKey = await prompt('Enter your OpenAI API key: ');
    
    if (apiKey && apiKey.trim().length > 0) {
      process.env.OPENAI_API_KEY = apiKey.trim();
      console.log(`${colors.fg.green}✓ OPENAI_API_KEY has been set for this session${colors.reset}`);
      return true;
    }
  }
  
  console.log(`${colors.fg.yellow}Proceeding without OpenAI API key. Will use pre-built test audio.${colors.reset}`);
  return false;
}

// Check for required dependencies (Chrome WebDriver)
async function checkDependencies() {
  console.log(`${colors.bright}Checking for required dependencies...${colors.reset}`);
  
  // Check for required Node.js packages
  try {
    await import('selenium-webdriver');
    console.log(`${colors.fg.green}✓ selenium-webdriver is installed${colors.reset}`);
  } catch (error) {
    console.log(`${colors.fg.red}✗ selenium-webdriver is not installed${colors.reset}`);
    
    const installPackage = await prompt('Install selenium-webdriver? (Y/n): ');
    if (installPackage.toLowerCase() !== 'n') {
      try {
        console.log('Installing selenium-webdriver...');
        execSync('npm install selenium-webdriver', { stdio: 'inherit' });
        console.log(`${colors.fg.green}✓ selenium-webdriver installed successfully${colors.reset}`);
      } catch (installError) {
        console.error(`${colors.fg.red}Failed to install selenium-webdriver:${colors.reset}`, installError);
        return false;
      }
    } else {
      return false;
    }
  }
  
  // Check for Chrome WebDriver
  try {
    const result = spawnSync('chromedriver', ['--version'], { stdio: 'pipe' });
    if (result.status === 0) {
      console.log(`${colors.fg.green}✓ Chrome WebDriver is installed: ${result.stdout.toString().trim()}${colors.reset}`);
    } else {
      throw new Error('ChromeDriver not found');
    }
  } catch (error) {
    console.log(`${colors.fg.red}✗ Chrome WebDriver is not installed or not in PATH${colors.reset}`);
    
    // Provide installation instructions based on platform
    console.log('\nInstallation instructions:');
    
    if (process.platform === 'darwin') {
      console.log('On macOS: brew cask install chromedriver');
    } else if (process.platform === 'win32') {
      console.log('On Windows: npm install -g chromedriver');
    } else {
      console.log('On Linux: apt-get install chromium-chromedriver');
    }
    
    const continueAnyway = await prompt('\nContinue anyway? (y/N): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      return false;
    }
  }
  
  // Check for audio playing capabilities
  try {
    if (process.platform === 'darwin') {
      execSync('which afplay', { stdio: 'pipe' });
      console.log(`${colors.fg.green}✓ Audio player (afplay) is available${colors.reset}`);
    } else if (process.platform === 'linux') {
      try {
        execSync('which play', { stdio: 'pipe' });
        console.log(`${colors.fg.green}✓ Audio player (sox) is available${colors.reset}`);
      } catch (e) {
        console.log(`${colors.fg.yellow}⚠ SoX audio player not found. Install with: sudo apt-get install sox${colors.reset}`);
      }
    } else if (process.platform === 'win32') {
      console.log(`${colors.fg.green}✓ Windows audio capability is available (using PowerShell)${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.fg.yellow}⚠ Audio playback capability not confirmed${colors.reset}`);
  }
  
  return true;
}

// Main function
async function main() {
  console.log(`${colors.bg.blue}${colors.fg.white}${colors.bright} BENEDICTAITOR REAL HARDWARE AUDIO TEST ${colors.reset}`);
  console.log(`${colors.fg.cyan}This test will evaluate the speech recognition capabilities using your actual`);
  console.log(`microphone and speakers, providing a complete replacement for manual testing.${colors.reset}\n`);
  
  // Check dependencies
  const dependenciesOk = await checkDependencies();
  if (!dependenciesOk) {
    console.log(`${colors.fg.red}Dependencies check failed. Please install the required dependencies and try again.${colors.reset}`);
    rl.close();
    return;
  }
  
  // Ensure server is running
  const serverOk = await ensureServerRunning();
  if (!serverOk) {
    console.log(`${colors.fg.yellow}Proceeding without confirmed server. Test may fail if server is not accessible.${colors.reset}`);
  }
  
  // Check for OpenAI API key
  await ensureApiKey();
  
  // Ask user to prepare for audio test
  console.log(`\n${colors.bg.yellow}${colors.fg.black} PREPARE FOR AUDIO TEST ${colors.reset}`);
  console.log(`${colors.fg.yellow}This test will play audio through your speakers and record it with your microphone.`);
  console.log(`Please make sure your environment is ready:${colors.reset}`);
  console.log(`${colors.fg.white}- Your computer's speakers should be turned on at a moderate volume`);
  console.log(`- Your microphone should be enabled and working`);
  console.log(`- The room should be reasonably quiet${colors.reset}\n`);
  
  const readyToStart = await prompt('Ready to start the test? (Y/n): ');
  if (readyToStart.toLowerCase() === 'n') {
    console.log(`${colors.fg.yellow}Test aborted by user.${colors.reset}`);
    rl.close();
    return;
  }
  
  console.log(`\n${colors.bg.green}${colors.fg.black} STARTING TEST ${colors.reset}`);
  console.log(`${colors.fg.green}Running real hardware test...${colors.reset}\n`);
  
  // Run the actual test
  const realHardwareTest = spawn('node', ['real-hardware-test.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Wait for test to complete
  const exitCode = await new Promise(resolve => {
    realHardwareTest.on('close', resolve);
  });
  
  // Report overall result
  if (exitCode === 0) {
    console.log(`\n${colors.bg.green}${colors.fg.white}${colors.bright} TEST COMPLETED SUCCESSFULLY ${colors.reset}`);
  } else {
    console.log(`\n${colors.bg.red}${colors.fg.white}${colors.bright} TEST FAILED WITH EXIT CODE ${exitCode} ${colors.reset}`);
  }
  
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
});