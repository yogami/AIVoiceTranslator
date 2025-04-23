const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const selenium = require('selenium-standalone');

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;

// Status of Selenium installation
let seleniumInstalled = false;
let seleniumServer = null;

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Make sure to stop Selenium server when app closes
    if (seleniumServer) {
      seleniumServer.kill();
      seleniumServer = null;
    }
  });
}

// Initialize app when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // Make sure to stop Selenium server
  if (seleniumServer) {
    seleniumServer.kill();
    seleniumServer = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Install Selenium when requested
ipcMain.handle('install-selenium', async () => {
  try {
    mainWindow.webContents.send('log', 'Installing Selenium and WebDrivers...');
    
    await new Promise((resolve, reject) => {
      selenium.install({
        logger: (message) => {
          mainWindow.webContents.send('log', message);
        }
      }, (err) => {
        if (err) {
          mainWindow.webContents.send('log', `Selenium installation error: ${err.message}`);
          reject(err);
        } else {
          mainWindow.webContents.send('log', 'Selenium and WebDrivers installed successfully');
          seleniumInstalled = true;
          resolve();
        }
      });
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start Selenium server
ipcMain.handle('start-selenium', async () => {
  try {
    if (!seleniumInstalled) {
      return { success: false, error: 'Selenium not installed yet' };
    }
    
    mainWindow.webContents.send('log', 'Starting Selenium server...');
    
    // Start the Selenium server
    await new Promise((resolve, reject) => {
      selenium.start((err, child) => {
        if (err) {
          mainWindow.webContents.send('log', `Failed to start Selenium: ${err.message}`);
          reject(err);
        } else {
          seleniumServer = child;
          mainWindow.webContents.send('log', 'Selenium server started');
          
          // Log Selenium output
          child.stdout.on('data', (data) => {
            mainWindow.webContents.send('log', `Selenium: ${data}`);
          });
          
          child.stderr.on('data', (data) => {
            mainWindow.webContents.send('log', `Selenium error: ${data}`);
          });
          
          resolve();
        }
      });
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Run a specific test
ipcMain.handle('run-test', async (event, testName) => {
  try {
    mainWindow.webContents.send('log', `Running test: ${testName}`);
    
    const testProcess = spawn('node', [path.join(__dirname, 'tests', `${testName}.js`)], {
      env: { ...process.env, ELECTRON_RUN: '1' }
    });
    
    let output = '';
    
    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      mainWindow.webContents.send('log', text);
    });
    
    testProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      mainWindow.webContents.send('log', `Error: ${text}`);
    });
    
    return new Promise((resolve) => {
      testProcess.on('close', (code) => {
        const result = {
          success: code === 0,
          output,
          code
        };
        mainWindow.webContents.send('test-finished', result);
        resolve(result);
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Run all tests
ipcMain.handle('run-all-tests', async () => {
  try {
    mainWindow.webContents.send('log', 'Running all tests...');
    
    const testDirectory = path.join(__dirname, 'tests');
    const testFiles = fs.readdirSync(testDirectory)
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));
    
    const results = [];
    
    for (const testName of testFiles) {
      mainWindow.webContents.send('log', `Running test: ${testName}`);
      
      const testProcess = spawn('node', [path.join(testDirectory, `${testName}.js`)], {
        env: { ...process.env, ELECTRON_RUN: '1' }
      });
      
      let output = '';
      
      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        mainWindow.webContents.send('log', text);
      });
      
      testProcess.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        mainWindow.webContents.send('log', `Error: ${text}`);
      });
      
      const result = await new Promise((resolve) => {
        testProcess.on('close', (code) => {
          resolve({
            name: testName,
            success: code === 0,
            output,
            code
          });
        });
      });
      
      results.push(result);
      mainWindow.webContents.send('test-result', result);
    }
    
    mainWindow.webContents.send('all-tests-finished', {
      success: results.every(r => r.success),
      results
    });
    
    return {
      success: results.every(r => r.success),
      results
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save test results to a file
ipcMain.handle('save-results', async (event, results) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Test Results',
      defaultPath: path.join(app.getPath('documents'), 'benedictaitor-test-results.json'),
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    });
    
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
      return { success: true, filePath };
    } else {
      return { success: false, error: 'No file selected' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});