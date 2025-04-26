/**
 * Connect Button Unit Test
 * 
 * Tests the behavior of the Connect button in the student interface
 * using London School TDD approach (with mocks and stubs).
 */

const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Connect Button Tests', () => {
  let window, document, connectBtn, disconnectBtn, socket;
  
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
    }
    
    close() {
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose();
    }
  }
  
  beforeEach(async () => {
    // Setup a mock DOM environment
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
    
    // Setup global objects
    window = dom.window;
    document = window.document;
    
    // Mock browser APIs
    window.WebSocket = MockWebSocket;
    window.showSuccess = jest.fn();
    window.showError = jest.fn();
    window.log = jest.fn();
    
    // Setup DOM elements
    connectBtn = document.getElementById('connect-btn');
    disconnectBtn = document.getElementById('disconnect-btn');
    
    // Initialize global variables
    window.isConnected = false;
    window.socket = null;
    window.selectedLanguage = 'es-ES';
    
    // Mock the connectWebSocket function
    window.connectWebSocket = jest.fn().mockImplementation(() => {
      window.socket = new MockWebSocket('ws://localhost:3000/ws');
      
      window.socket.onopen = () => {
        window.isConnected = true;
        window.updateConnectionUI(true);
      };
      
      window.socket.onclose = () => {
        window.isConnected = false;
        window.updateConnectionUI(false);
      };
      
      return window.socket;
    });
    
    // Mock the disconnectWebSocket function
    window.disconnectWebSocket = jest.fn().mockImplementation(() => {
      if (window.socket) {
        window.socket.close();
        window.socket = null;
      }
    });
    
    // Mock updateConnectionUI
    window.updateConnectionUI = jest.fn().mockImplementation((connected) => {
      const indicator = document.getElementById('connection-indicator');
      const status = document.getElementById('connection-status');
      
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
    });
    
    // Mock registerAsStudent
    window.registerAsStudent = jest.fn();
  });
  
  test('Connect button should call connectWebSocket when clicked', () => {
    // Setup
    expect(window.isConnected).toBe(false);
    expect(connectBtn.disabled).toBe(false);
    
    // Act
    connectBtn.click();
    
    // Assert
    expect(window.connectWebSocket).toHaveBeenCalled();
  });
  
  test('Disconnect button should call disconnectWebSocket when clicked', () => {
    // Setup - first connect
    connectBtn.click();
    
    // Simulate WebSocket open event
    window.socket.onopen();
    
    // Verify connection is established
    expect(window.isConnected).toBe(true);
    expect(disconnectBtn.disabled).toBe(false);
    
    // Act - now disconnect
    disconnectBtn.click();
    
    // Assert
    expect(window.disconnectWebSocket).toHaveBeenCalled();
  });
  
  test('Connection status should update when WebSocket connects', () => {
    // Setup
    const statusElement = document.getElementById('connection-status');
    expect(statusElement.textContent).toBe('Disconnected');
    
    // Act
    connectBtn.click();
    window.socket.onopen();
    
    // Assert
    expect(statusElement.textContent).toBe('Connected to Classroom');
    expect(connectBtn.disabled).toBe(true);
    expect(disconnectBtn.disabled).toBe(false);
  });
  
  test('Connection status should update when WebSocket disconnects', () => {
    // Setup - first connect
    connectBtn.click();
    window.socket.onopen();
    
    // Verify connection
    expect(window.isConnected).toBe(true);
    
    // Act - now disconnect
    disconnectBtn.click();
    
    // Assert
    const statusElement = document.getElementById('connection-status');
    expect(statusElement.textContent).toBe('Disconnected');
    expect(connectBtn.disabled).toBe(false);
    expect(disconnectBtn.disabled).toBe(true);
  });
  
  test('Should register as student after successful connection', () => {
    // Setup
    connectBtn.click();
    
    // Act - simulate connection established
    window.socket.onopen();
    
    // Assert
    expect(window.registerAsStudent).toHaveBeenCalledWith('es-ES');
  });
});