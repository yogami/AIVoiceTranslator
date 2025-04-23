// Main Electron file for Benedictaitor Test Runner
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const os = require('os');

// Main window reference
let mainWindow;

// Keep track of any child processes
let testProcesses = [];

// Initialize app when Electron is ready
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });
  
  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();
  
  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    // Terminate all child processes
    testProcesses.forEach(process => {
      try {
        process.kill();
      } catch (e) {
        console.error('Error killing process:', e);
      }
    });
  });
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle IPC messages from renderer process
ipcMain.on('run-test', (event, testName) => {
  runTest(testName, event);
});

ipcMain.on('run-all-tests', (event) => {
  runAllTests(event);
});

ipcMain.on('save-results', (event, results) => {
  saveResults(results, event);
});

// Run a specific test
function runTest(testName, event) {
  const testFile = path.join(__dirname, 'tests', `${testName}.js`);
  
  if (!fs.existsSync(testFile)) {
    event.reply('test-output', {
      type: 'error',
      message: `Test file not found: ${testFile}`
    });
    return;
  }
  
  event.reply('test-output', {
    type: 'info',
    message: `Running test: ${testName}...`
  });
  
  const testProcess = spawn('node', [testFile], {
    shell: true
  });
  
  testProcesses.push(testProcess);
  
  testProcess.stdout.on('data', (data) => {
    event.reply('test-output', {
      type: 'stdout',
      message: data.toString()
    });
  });
  
  testProcess.stderr.on('data', (data) => {
    event.reply('test-output', {
      type: 'stderr',
      message: data.toString()
    });
  });
  
  testProcess.on('close', (code) => {
    const status = code === 0 ? 'success' : 'error';
    event.reply('test-output', {
      type: status,
      message: `Test finished with exit code: ${code}`
    });
    
    const index = testProcesses.indexOf(testProcess);
    if (index > -1) {
      testProcesses.splice(index, 1);
    }
  });
}

// Run all tests
function runAllTests(event) {
  const testDir = path.join(__dirname, 'tests');
  fs.readdir(testDir, (err, files) => {
    if (err) {
      event.reply('test-output', {
        type: 'error',
        message: `Error reading test directory: ${err.message}`
      });
      return;
    }
    
    const testFiles = files.filter(file => file.endsWith('.js'));
    
    if (testFiles.length === 0) {
      event.reply('test-output', {
        type: 'warning',
        message: 'No test files found'
      });
      return;
    }
    
    event.reply('test-output', {
      type: 'info',
      message: `Found ${testFiles.length} test files. Running all tests...`
    });
    
    let completed = 0;
    
    testFiles.forEach(file => {
      const testName = file.replace('.js', '');
      const testFile = path.join(testDir, file);
      
      event.reply('test-output', {
        type: 'info',
        message: `Running test (${completed + 1}/${testFiles.length}): ${testName}...`
      });
      
      const testProcess = spawn('node', [testFile], {
        shell: true
      });
      
      testProcesses.push(testProcess);
      
      testProcess.stdout.on('data', (data) => {
        event.reply('test-output', {
          type: 'stdout',
          test: testName,
          message: data.toString()
        });
      });
      
      testProcess.stderr.on('data', (data) => {
        event.reply('test-output', {
          type: 'stderr',
          test: testName,
          message: data.toString()
        });
      });
      
      testProcess.on('close', (code) => {
        completed++;
        const status = code === 0 ? 'success' : 'error';
        
        event.reply('test-output', {
          type: status,
          test: testName,
          message: `Test "${testName}" finished with exit code: ${code}`
        });
        
        if (completed === testFiles.length) {
          event.reply('test-output', {
            type: 'info',
            message: `All tests completed (${testFiles.length}/${testFiles.length}).`
          });
        }
        
        const index = testProcesses.indexOf(testProcess);
        if (index > -1) {
          testProcesses.splice(index, 1);
        }
      });
    });
  });
}

// Save test results to file
function saveResults(results, event) {
  const options = {
    title: 'Save Test Results',
    defaultPath: path.join(os.homedir(), 'Desktop', 'benedictaitor-test-results.json'),
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  };
  
  dialog.showSaveDialog(mainWindow, options).then(result => {
    if (!result.canceled && result.filePath) {
      fs.writeFile(result.filePath, JSON.stringify(results, null, 2), (err) => {
        if (err) {
          event.reply('save-results-response', {
            success: false,
            message: `Error saving results: ${err.message}`
          });
        } else {
          event.reply('save-results-response', {
            success: true,
            message: `Results saved to ${result.filePath}`
          });
        }
      });
    }
  }).catch(err => {
    event.reply('save-results-response', {
      success: false,
      message: `Error showing save dialog: ${err.message}`
    });
  });
}