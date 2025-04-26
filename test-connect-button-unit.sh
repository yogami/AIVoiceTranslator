#!/bin/bash

# Run Connect Button Unit Tests following London School TDD principles
echo "Running Connect Button Unit Tests..."

# Create temporary test runner file with ESM format
cat > connect-button-runner.cjs << 'EOF'
const { JSDOM } = require('jsdom');
const assert = require('assert');

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CLOSED = 3;
    
    // Auto-connect after a delay to simulate network
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 50);
  }
  
  send(data) {
    this.lastSentData = data;
    console.log(`Mock WebSocket sent: ${data}`);
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
}

// Setup test DOM
function setupTestDOM() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div class="status">
          <span id="connection-indicator" class="indicator disconnected"></span>
          <span id="connection-status">Disconnected</span>
        </div>
        <button id="connect-btn">Connect</button>
        <button id="disconnect-btn" disabled>Disconnect</button>
        <div id="log"></div>
        <div id="current-tts-service"></div>
        <select id="language-select">
          <option value="es-ES">Spanish</option>
        </select>
      </body>
    </html>
  `, { 
    url: "https://example.org/",
    runScripts: "dangerously",
    resources: "usable"
  });
  
  return dom;
}

// Test: Connect button should call connectWebSocket when clicked
function testConnectButtonClick() {
  const dom = setupTestDOM();
  const window = dom.window;
  const document = window.document;
  
  // Mock functions
  let connectWebSocketCalled = false;
  window.connectWebSocket = function() {
    connectWebSocketCalled = true;
    window.socket = new MockWebSocket('ws://localhost:3000/ws');
    return window.socket;
  };
  
  window.log = function(msg) {
    console.log(`[LOG]: ${msg}`);
  };
  
  window.showSuccess = function(msg) {
    console.log(`[SUCCESS]: ${msg}`);
  };
  
  window.updateConnectionUI = function(connected) {
    const indicator = document.getElementById('connection-indicator');
    const status = document.getElementById('connection-status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    if (connected) {
      indicator.className = 'indicator connected';
      status.textContent = 'Connected to Classroom';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      indicator.className = 'indicator disconnected';
      status.textContent = 'Disconnected';
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  };
  
  // Get DOM elements
  const connectBtn = document.getElementById('connect-btn');
  
  // Initial state check
  assert.strictEqual(connectBtn.disabled, false, "Connect button should be enabled initially");
  
  // Act: Click connect button
  connectBtn.click();
  
  // Assert
  assert.strictEqual(connectWebSocketCalled, true, "connectWebSocket should be called when Connect button is clicked");
  console.log("✓ Connect button click test passed");
}

// Test: Connection status should update when WebSocket connects
function testConnectionStatusUpdate() {
  const dom = setupTestDOM();
  const window = dom.window;
  const document = window.document;
  
  // Mock functions
  window.isConnected = false;
  window.log = function(msg) {
    console.log(`[LOG]: ${msg}`);
  };
  
  window.showSuccess = function(msg) {
    console.log(`[SUCCESS]: ${msg}`);
  };
  
  window.registerAsStudent = function(lang) {
    console.log(`[REGISTER]: Language ${lang}`);
  };
  
  window.updateConnectionUI = function(connected) {
    const indicator = document.getElementById('connection-indicator');
    const status = document.getElementById('connection-status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    if (connected) {
      indicator.className = 'indicator connected';
      status.textContent = 'Connected to Classroom';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      indicator.className = 'indicator disconnected';
      status.textContent = 'Disconnected';
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  };
  
  window.connectWebSocket = function() {
    window.socket = new MockWebSocket('ws://localhost:3000/ws');
    
    window.socket.onopen = function() {
      window.isConnected = true;
      window.updateConnectionUI(true);
    };
    
    return window.socket;
  };
  
  // Get DOM elements
  const connectBtn = document.getElementById('connect-btn');
  const statusElement = document.getElementById('connection-status');
  
  // Initial state check
  assert.strictEqual(statusElement.textContent, 'Disconnected', "Status should be 'Disconnected' initially");
  
  // Act: Connect
  connectBtn.click();
  window.socket.onopen();
  
  // Assert
  assert.strictEqual(statusElement.textContent, 'Connected to Classroom', "Status should update to 'Connected to Classroom'");
  assert.strictEqual(connectBtn.disabled, true, "Connect button should be disabled after connection");
  console.log("✓ Connection status update test passed");
}

// Test: Disconnect button should work
function testDisconnectButton() {
  const dom = setupTestDOM();
  const window = dom.window;
  const document = window.document;
  
  // Mock functions
  window.isConnected = false;
  let disconnectCalled = false;
  
  window.log = function(msg) {
    console.log(`[LOG]: ${msg}`);
  };
  
  window.showSuccess = function(msg) {
    console.log(`[SUCCESS]: ${msg}`);
  };
  
  window.connectWebSocket = function() {
    window.socket = new MockWebSocket('ws://localhost:3000/ws');
    
    window.socket.onopen = function() {
      window.isConnected = true;
      window.updateConnectionUI(true);
    };
    
    window.socket.onclose = function() {
      window.isConnected = false;
      window.updateConnectionUI(false);
    };
    
    return window.socket;
  };
  
  window.disconnectWebSocket = function() {
    disconnectCalled = true;
    if (window.socket) {
      window.socket.close();
    }
  };
  
  window.updateConnectionUI = function(connected) {
    const indicator = document.getElementById('connection-indicator');
    const status = document.getElementById('connection-status');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    if (connected) {
      indicator.className = 'indicator connected';
      status.textContent = 'Connected to Classroom';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      indicator.className = 'indicator disconnected';
      status.textContent = 'Disconnected';
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  };
  
  // Get DOM elements
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const statusElement = document.getElementById('connection-status');
  
  // Act: First connect
  connectBtn.click();
  window.socket.onopen();
  
  // Assert: Connected state
  assert.strictEqual(window.isConnected, true, "Should be connected after WebSocket open");
  assert.strictEqual(disconnectBtn.disabled, false, "Disconnect button should be enabled after connection");
  
  // Act: Now disconnect
  disconnectBtn.click();
  
  // Assert: Disconnected state
  assert.strictEqual(disconnectCalled, true, "disconnectWebSocket should be called when Disconnect button is clicked");
  assert.strictEqual(disconnectBtn.disabled, true, "Disconnect button should be disabled after disconnection");
  assert.strictEqual(statusElement.textContent, 'Disconnected', "Status should be 'Disconnected' after disconnection");
  console.log("✓ Disconnect button test passed");
}

// Run all tests
try {
  console.log("\n========= Connect Button Unit Tests =========\n");
  testConnectButtonClick();
  testConnectionStatusUpdate();
  testDisconnectButton();
  console.log("\n✅ All tests passed!");
} catch (error) {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
}
EOF

# Run the test runner
node connect-button-runner.cjs

# Clean up
rm connect-button-runner.cjs