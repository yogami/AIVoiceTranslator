#!/bin/bash

# Ultra-Simple script to launch the Benedictaitor test app on Mac without any building
# This script simply launches Electron directly with our app

echo "🚀 Benedictaitor Test Runner - Simple Launcher"
echo "============================================="
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Create a temporary directory if it doesn't exist
TMP_DIR="./tmp"
mkdir -p "$TMP_DIR"

# Function to download Electron
function download_electron() {
  # Choose the right download based on architecture
  if [[ "$(uname -m)" == "arm64" ]]; then
    # M1/M2 Mac
    ELECTRON_URL="https://github.com/electron/electron/releases/download/v28.2.5/electron-v28.2.5-darwin-arm64.zip"
  else
    # Intel Mac
    ELECTRON_URL="https://github.com/electron/electron/releases/download/v28.2.5/electron-v28.2.5-darwin-x64.zip"
  fi
  
  echo "📥 Downloading Electron..."
  curl -sL "$ELECTRON_URL" -o "$TMP_DIR/electron.zip"
  
  echo "📦 Extracting Electron..."
  unzip -q "$TMP_DIR/electron.zip" -d "$TMP_DIR"
  
  # Clean up the zip file
  rm "$TMP_DIR/electron.zip"
}

# Download Electron if needed
if [[ ! -d "$TMP_DIR/Electron.app" ]]; then
  download_electron
fi

# Create a symbolic link to our app.js file if it doesn't exist
if [[ ! -f "$TMP_DIR/app.js" ]]; then
  ln -s "../main.js" "$TMP_DIR/app.js"
fi

# Copy preload.js to the temp directory
if [[ ! -f "$TMP_DIR/preload.js" ]]; then
  cp preload.js "$TMP_DIR/"
fi

# Copy our main file if we don't have it yet
if [[ ! -f "main.js" ]]; then
  echo "Creating main app file..."
  cat > main.js << 'EOL'
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');
  
  // Open DevTools for debugging
  // mainWindow.webContents.openDevTools();
  
  // Set the window title
  mainWindow.setTitle('Benedictaitor Test Runner');
}

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();
  
  // Set up IPC handlers for running tests
  setupTestRunner();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Set up the test runner functionality
function setupTestRunner() {
  // Create index.html if it doesn't exist
  if (!fs.existsSync(path.join(__dirname, 'index.html'))) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Benedictaitor Test Runner</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f7;
          color: #333;
        }
        header {
          background-color: #333;
          color: white;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0;
          font-size: 24px;
        }
        .container {
          display: flex;
          flex-direction: row;
        }
        .sidebar {
          width: 250px;
          background-color: #fff;
          border-radius: 8px;
          padding: 15px;
          margin-right: 20px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .main {
          flex-grow: 1;
          background-color: #fff;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        button {
          background-color: #0071e3;
          color: white;
          border: none;
          padding: 8px 16px;
          margin: 5px 0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          text-align: left;
        }
        button:hover {
          background-color: #0077ed;
        }
        #output {
          background-color: #1e1e1e;
          color: #ddd;
          padding: 15px;
          border-radius: 6px;
          font-family: monospace;
          height: 500px;
          overflow-y: auto;
        }
        .test-category {
          margin-bottom: 15px;
        }
        h3 {
          margin-top: 0;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>Benedictaitor Test Runner</h1>
      </header>
      
      <div class="container">
        <div class="sidebar">
          <div class="test-category">
            <h3>End-to-End Tests</h3>
            <button id="btn-e2e-test">Run E2E Test</button>
            <button id="btn-real-hardware-test">Run Real Hardware Test</button>
          </div>
          
          <div class="test-category">
            <h3>Component Tests</h3>
            <button id="btn-websocket-test">WebSocket Test</button>
            <button id="btn-speech-test">Speech API Test</button>
            <button id="btn-audio-utils-test">Audio Utils Test</button>
            <button id="btn-ui-components-test">UI Components Test</button>
          </div>
          
          <div class="test-category">
            <h3>Tools</h3>
            <button id="btn-clear-output">Clear Output</button>
            <button id="btn-save-results">Save Results</button>
          </div>
        </div>
        
        <div class="main">
          <h3>Test Output</h3>
          <div id="output">Welcome to the Benedictaitor Test Runner.
Select a test to run from the sidebar.</div>
        </div>
      </div>
      
      <script>
        // Connect buttons to IPC calls
        document.getElementById('btn-e2e-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'e2e-test');
        });
        
        document.getElementById('btn-real-hardware-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'real-hardware-test');
        });
        
        document.getElementById('btn-websocket-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'websocket-test');
        });
        
        document.getElementById('btn-speech-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'speech-test');
        });
        
        document.getElementById('btn-audio-utils-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'audio-utils-test');
        });
        
        document.getElementById('btn-ui-components-test').addEventListener('click', () => {
          window.ipcRenderer.send('run-test', 'ui-components-test');
        });
        
        document.getElementById('btn-clear-output').addEventListener('click', () => {
          document.getElementById('output').innerHTML = '';
        });
        
        document.getElementById('btn-save-results').addEventListener('click', () => {
          window.ipcRenderer.send('save-results');
        });
        
        // Listen for test output
        window.ipcRenderer.on('test-output', (event, data) => {
          const output = document.getElementById('output');
          output.innerHTML += data + '<br>';
          output.scrollTop = output.scrollHeight;
        });
        
        // Listen for test completion
        window.ipcRenderer.on('test-complete', (event, success) => {
          const output = document.getElementById('output');
          if (success) {
            output.innerHTML += '<span style="color: #5cb85c">✓ Test completed successfully</span><br>';
          } else {
            output.innerHTML += '<span style="color: #d9534f">✗ Test failed</span><br>';
          }
          output.scrollTop = output.scrollHeight;
        });
      </script>
    </body>
    </html>
    `;
    
    fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  }
  
  // Handle test run requests
  ipcMain.on('run-test', (event, testName) => {
    let scriptPath;
    
    switch (testName) {
      case 'e2e-test':
        scriptPath = path.join(__dirname, 'tests', 'e2e-selenium-test.js');
        break;
      case 'real-hardware-test':
        scriptPath = path.join(__dirname, 'tests', 'real-hardware-test.js');
        break;
      case 'websocket-test':
        scriptPath = path.join(__dirname, 'tests', 'websocket-tests.js');
        break;
      case 'speech-test':
        scriptPath = path.join(__dirname, 'tests', 'speech-test.js');
        break;
      case 'audio-utils-test':
        scriptPath = path.join(__dirname, 'tests', 'audio-utils-tests.js');
        break;
      case 'ui-components-test':
        scriptPath = path.join(__dirname, 'tests', 'ui-components-test.js');
        break;
      default:
        mainWindow.webContents.send('test-output', 'Unknown test: ' + testName);
        return;
    }
    
    // Check if the test file exists
    if (!fs.existsSync(scriptPath)) {
      mainWindow.webContents.send('test-output', 'Test file not found: ' + scriptPath);
      return;
    }
    
    // Run the test
    mainWindow.webContents.send('test-output', 'Running test: ' + testName);
    
    const testProcess = spawn('node', [scriptPath]);
    
    testProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('test-output', data.toString());
    });
    
    testProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('test-output', 'ERROR: ' + data.toString());
    });
    
    testProcess.on('close', (code) => {
      mainWindow.webContents.send('test-complete', code === 0);
    });
  });
  
  // Handle save results request
  ipcMain.on('save-results', () => {
    const savePath = path.join(app.getPath('desktop'), 'benedictaitor-test-results.txt');
    
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('output').innerText
    `).then((result) => {
      fs.writeFileSync(savePath, result);
      mainWindow.webContents.send('test-output', 'Results saved to desktop: benedictaitor-test-results.txt');
    });
  });
}
EOL

  # Create HTML file too
  if [[ ! -f "index.html" ]]; then
    echo "Creating HTML template..."
    touch index.html
  fi
}

# Launch the app
echo "🚀 Launching Benedictaitor Test Runner..."
"$TMP_DIR/Electron.app/Contents/MacOS/Electron" "$PWD"