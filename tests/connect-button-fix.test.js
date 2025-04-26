/**
 * Connect Button Fix Test
 * 
 * This test verifies that the fix for the Connect button 
 * on the student interface works correctly.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Student Interface Connect Button', () => {
  let dom;
  let document;
  let window;
  let connectBtn;
  let disconnectBtn;
  
  // Mock WebSocket implementation
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0; // CONNECTING
      this.OPEN = 1;
      
      // Simulate connection after small delay
      setTimeout(() => {
        this.readyState = 1; // OPEN
        if (this.onopen) this.onopen();
      }, 50);
    }
    
    send(data) {
      this.lastSentData = data;
      return true;
    }
    
    close() {
      this.readyState = 3; // CLOSED
      if (this.onclose) this.onclose();
    }
  }
  
  beforeEach(() => {
    // Read the HTML file
    const htmlPath = path.resolve(__dirname, '../client/public/simple-student.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Create a DOM environment
    dom = new JSDOM(html, {
      url: 'http://localhost/',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true
    });
    
    // Set up window and document
    window = dom.window;
    document = window.document;
    
    // Mock WebSocket
    window.WebSocket = MockWebSocket;
    
    // Mock other necessary browser APIs
    window.speechSynthesis = {
      speak: jest.fn(),
      cancel: jest.fn()
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    window.Audio = class {
      constructor() {
        this.play = jest.fn().mockResolvedValue();
      }
    };
    
    // Trigger DOMContentLoaded
    const event = new window.Event('DOMContentLoaded');
    window.document.dispatchEvent(event);
    
    // Get connect and disconnect buttons
    connectBtn = document.getElementById('connect-btn');
    disconnectBtn = document.getElementById('disconnect-btn');
  });
  
  test('Connect button should exist in the DOM', () => {
    expect(connectBtn).not.toBeNull();
  });
  
  test('Disconnect button should initially be disabled', () => {
    expect(disconnectBtn.disabled).toBe(true);
  });
  
  test('Clicking connect button should establish WebSocket connection', done => {
    // Mock the connectWebSocket function to spy on it
    let wasConnectCalled = false;
    const originalConnectFn = window.connectWebSocket;
    
    window.connectWebSocket = function() {
      wasConnectCalled = true;
      originalConnectFn.call(window);
    };
    
    // Click the connect button
    connectBtn.click();
    
    // Check that function was called
    expect(wasConnectCalled).toBe(true);
    
    // Wait for "connection"
    setTimeout(() => {
      // Connect button should be disabled
      expect(connectBtn.disabled).toBe(true);
      
      // Disconnect button should be enabled
      expect(disconnectBtn.disabled).toBe(false);
      
      // Connection status should be updated
      const statusEl = document.querySelector('.status');
      expect(statusEl.classList.contains('connected')).toBe(true);
      
      done();
    }, 100);
  });
});