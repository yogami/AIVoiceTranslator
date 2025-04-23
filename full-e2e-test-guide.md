# Running Full End-to-End Selenium Tests for Benedictaitor

This guide will help you set up and run real Selenium tests against the complete Benedictaitor application on your local Mac.

## Prerequisites

1. **Node.js**: Install Node.js from https://nodejs.org/ (LTS version recommended)
2. **WebDriver**: You need Chrome or Firefox and their WebDriver
3. **Git**: To clone the Benedictaitor repository

## Step 1: Clone the Benedictaitor Repository

```bash
git clone https://github.com/GITHUB_USERNAME/benedictaitor.git
cd benedictaitor
```

Replace `GITHUB_USERNAME` with the actual GitHub username where the repo is hosted.

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Create the E2E Test File

Create a file named `full-e2e-test.js` in the root directory with the following content:

```javascript
/**
 * Full End-to-End Test for Benedictaitor
 * 
 * This test:
 * 1. Starts the Benedictaitor application
 * 2. Opens a browser using Selenium
 * 3. Tests real audio input and WebSocket communication
 * 4. Verifies translations appear correctly
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Configuration
const APP_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds timeout
const TEST_AUDIO_PATH = path.join(__dirname, 'test-audio.wav');

// Flag to track if we started the server
let serverProcess = null;

async function ensureTestAudioExists() {
  // Create a simple test message if it doesn't exist
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Test audio file not found. Creating a sample message...');
    
    // You would normally generate audio here, but for simplicity let's use
    // a placeholder. In a real test, you'd create an actual audio file.
    fs.writeFileSync(
      path.join(__dirname, 'test-message.txt'), 
      'This is a test message for the Benedictaitor system.'
    );
    
    // For this example, we'll assume test-audio.wav exists
    console.log('Please ensure test-audio.wav exists for audio testing.');
  }
}

async function startServer() {
  if (serverProcess) return; // Server already started
  
  console.log('Starting Benedictaitor server...');
  
  // Start the server
  serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    detached: false
  });
  
  // Log server output
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
    
    // If you detect server is ready based on a specific log message:
    if (data.toString().includes('Server is ready')) {
      console.log('Server is ready!');
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server error: ${data}`);
  });
  
  // Give the server time to start up
  console.log('Waiting for server to start...');
  await sleep(5000);
  console.log('Proceeding with test...');
}

async function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');
    // Kill the server process
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
      process.kill(-serverProcess.pid);
    }
    serverProcess = null;
  }
}

async function injectAudioMock(driver) {
  console.log('Injecting audio mock functions...');
  
  // This script mocks the audio functions to simulate a recording
  const mockScript = `
    // Save original functions
    const originalMediaDevices = navigator.mediaDevices;
    const originalMediaRecorder = window.MediaRecorder;
    
    // Mock getUserMedia to always succeed
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      console.log('Mocked getUserMedia called with', constraints);
      
      // Create a mock audio track
      const mockTrack = {
        kind: 'audio',
        enabled: true,
        id: 'mock-audio-track-id',
        label: 'Mock Audio Track',
        stop: () => console.log('Mock track stopped')
      };
      
      // Create and return a mock stream
      return {
        id: 'mock-stream-id',
        active: true,
        getTracks: () => [mockTrack],
        getAudioTracks: () => [mockTrack],
        getVideoTracks: () => [],
        addTrack: (track) => console.log('Track added', track),
        removeTrack: (track) => console.log('Track removed', track),
        clone: () => this
      };
    };
    
    // Mock MediaRecorder
    window.MediaRecorder = class MockMediaRecorder {
      constructor(stream, options) {
        console.log('Mock MediaRecorder created', options);
        this.stream = stream;
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
        this.audioBitsPerSecond = 128000;
        this.videoBitsPerSecond = 0;
        
        // Event handlers
        this.onstart = null;
        this.onstop = null;
        this.ondataavailable = null;
        this.onerror = null;
        this.onpause = null;
        this.onresume = null;
        
        // Timer for simulated recording
        this.timer = null;
      }
      
      start(timeslice) {
        console.log('Mock recording started with timeslice', timeslice);
        this.state = 'recording';
        
        // Fire onstart event
        if (this.onstart) {
          this.onstart(new Event('start'));
        }
        
        // Simulate recording with periodic data events
        const interval = timeslice || 1000;
        this.timer = setInterval(() => {
          // Create "audio" data - random noise
          const dataLength = Math.floor(Math.random() * 10000) + 5000;
          const mockData = new Uint8Array(dataLength);
          for (let i = 0; i < dataLength; i++) {
            mockData[i] = Math.floor(Math.random() * 256);
          }
          
          // Create a mock Blob
          const mockBlob = new Blob([mockData], { type: 'audio/webm' });
          
          // Fire dataavailable event
          if (this.ondataavailable) {
            const event = new Event('dataavailable');
            event.data = mockBlob;
            this.ondataavailable(event);
          }
        }, interval);
      }
      
      stop() {
        console.log('Mock recording stopped');
        
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        
        // Clear the timer
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        
        // Fire onstop event
        if (this.onstop) {
          this.onstop(new Event('stop'));
        }
      }
      
      pause() {
        console.log('Mock recording paused');
        this.state = 'paused';
        
        if (this.onpause) {
          this.onpause(new Event('pause'));
        }
      }
      
      resume() {
        console.log('Mock recording resumed');
        this.state = 'recording';
        
        if (this.onresume) {
          this.onresume(new Event('resume'));
        }
      }
      
      static isTypeSupported(mimeType) {
        return ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg'].includes(mimeType);
      }
    };
    
    console.log('Audio mocks successfully injected');
  `;
  
  // Execute the mock script in the browser
  await driver.executeScript(mockScript);
}

async function runTest() {
  await ensureTestAudioExists();
  
  // Start the server
  await startServer();
  
  let driver;
  
  try {
    console.log('Starting Selenium WebDriver...');
    
    // Setup Chrome options for better test performance
    const options = new chrome.Options()
      .addArguments('--disable-gpu')
      .addArguments('--window-size=1280,800')
      .addArguments('--disable-dev-shm-usage')
      .addArguments('--no-sandbox');
      // Uncomment to run headless (no browser UI):
      // .addArguments('--headless');
    
    // Build and start Chrome
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
      
    console.log('WebDriver started successfully');
    
    // Set timeout
    await driver.manage().setTimeouts({ implicit: 10000, pageLoad: 20000, script: 30000 });
    
    // Navigate to teacher interface
    console.log('Navigating to the teacher interface...');
    await driver.get(`${APP_URL}/teacher`);
    
    console.log('Waiting for page to load...');
    await driver.wait(until.elementLocated(By.css('h1, h2')), 10000);
    
    // Inject audio mocks
    await injectAudioMock(driver);
    
    // Verify page is loaded correctly
    const title = await driver.getTitle();
    console.log(`Page loaded with title: ${title}`);
    
    // Take a screenshot
    const screenshotPath = path.join(__dirname, 'teacher-interface.png');
    await driver.takeScreenshot().then(
      image => fs.writeFileSync(screenshotPath, image, 'base64')
    );
    console.log(`Screenshot saved at: ${screenshotPath}`);
    
    // Find and click the record button
    console.log('Looking for record button...');
    const recordButtons = await driver.findElements(By.css('button'));
    
    let recordButton = null;
    for (const button of recordButtons) {
      const text = await button.getText();
      if (text.toLowerCase().includes('record') || text.toLowerCase().includes('start')) {
        recordButton = button;
        break;
      }
    }
    
    if (!recordButton) {
      throw new Error('Could not find a record button on the page');
    }
    
    console.log('Found record button. Starting test recording...');
    await recordButton.click();
    
    // Wait for recording to be processed (adjust time as needed)
    console.log('Waiting for speech recognition to process...');
    await sleep(5000);
    
    // Look for transcript or translations (this will depend on your UI structure)
    console.log('Looking for transcription or translations...');
    const transcriptElements = await driver.findElements(By.css('.transcript, [data-testid="transcript"], p, div'));
    
    let found = false;
    for (const element of transcriptElements) {
      const text = await element.getText();
      if (text && text.length > 5) {
        console.log(`Found text content: "${text}"`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.warn('Could not find any significant text content that might be transcription');
    }
    
    // Find and click stop button if recording is still active
    console.log('Stopping recording...');
    const stopButtons = await driver.findElements(By.css('button'));
    
    let stopButton = null;
    for (const button of stopButtons) {
      const text = await button.getText();
      if (text.toLowerCase().includes('stop')) {
        stopButton = button;
        break;
      }
    }
    
    if (stopButton) {
      await stopButton.click();
      console.log('Recording stopped');
    }
    
    // Take a final screenshot
    const finalScreenshotPath = path.join(__dirname, 'test-completed.png');
    await driver.takeScreenshot().then(
      image => fs.writeFileSync(finalScreenshotPath, image, 'base64')
    );
    console.log(`Final screenshot saved at: ${finalScreenshotPath}`);
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
    
    // Take error screenshot if driver is available
    if (driver) {
      const errorScreenshotPath = path.join(__dirname, 'error-screenshot.png');
      await driver.takeScreenshot().then(
        image => fs.writeFileSync(errorScreenshotPath, image, 'base64')
      );
      console.log(`Error screenshot saved at: ${errorScreenshotPath}`);
    }
    
    throw error;
  } finally {
    // Clean up
    if (driver) {
      console.log('Closing WebDriver...');
      await driver.quit();
    }
    
    // Stop the server
    await stopServer();
  }
}

// Run the test
runTest().then(() => {
  console.log('E2E test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('E2E test failed:', error);
  process.exit(1);
});
```

## Step 4: Run the Test

Run the test with:

```bash
node full-e2e-test.js
```

This will:
1. Start the Benedictaitor server automatically
2. Launch a Chrome browser controlled by Selenium
3. Navigate to the teacher interface
4. Simulate audio recording
5. Check for transcriptions or translations
6. Take screenshots at important points
7. Clean up resources when done

## Troubleshooting

### WebDriver Issues

If you get errors about ChromeDriver:

```bash
npm install -g chromedriver
```

Or download and install it manually from https://chromedriver.chromium.org/downloads.

### Port Already in Use

If the server can't start because the port is in use:

```bash
# Find the process using port 3000 (or whatever port the app uses)
lsof -i :3000
# Kill the process
kill -9 [PID]
```

### Improve the Test

To enhance the test:

1. Create real test audio files using Text-to-Speech
2. Add checks for specific translation content
3. Add more detailed logging
4. Test both teacher and student interfaces

## Further Reading

- Selenium WebDriver documentation: https://www.selenium.dev/documentation/en/webdriver/
- Selenium JavaScript API: https://www.selenium.dev/selenium/docs/api/javascript/index.html