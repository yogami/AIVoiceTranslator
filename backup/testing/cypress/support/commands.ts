/// <reference types="cypress" />

// Custom command to test the recording functionality
Cypress.Commands.add('testRecordingCycle', () => {
  // Start recording
  cy.findByRole('button', { name: /record/i }).click();
  
  // Verify recording state is active
  cy.findByText('Recording').should('be.visible');
  
  // Wait for some recording time
  cy.wait(3000);
  
  // Stop recording
  cy.findByRole('button', { name: /stop/i }).click();
  
  // Verify recording has stopped
  cy.findByText('Not recording').should('be.visible');
});

// Mock WebSocket for testing
Cypress.Commands.add('mockWebSocket', () => {
  cy.window().then((win) => {
    // Create a mock WebSocket class
    class MockWebSocket extends EventTarget {
      url: string;
      readyState: number = WebSocket.CONNECTING;
      
      constructor(url: string) {
        super();
        this.url = url;
        
        // Simulate connection after small delay
        setTimeout(() => {
          this.readyState = WebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        }, 100);
      }
      
      close() {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
      
      send(data: string) {
        // Simulate receiving a response
        setTimeout(() => {
          // Parse the sent data
          const parsedData = JSON.parse(data);
          
          // If it's an audio message, send back a translation
          if (parsedData.type === 'audio') {
            this.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({
                type: 'translation',
                payload: {
                  sessionId: 'test-session',
                  sourceLanguage: 'en-US',
                  targetLanguage: 'es-ES',
                  originalText: 'This is a sample translation',
                  translatedText: 'Esta es una traducción de ejemplo',
                  audio: 'base64audiodata',
                  timestamp: new Date().toISOString(),
                  latency: 500
                }
              })
            }));
          }
        }, 300);
      }
    }
    
    // Override the WebSocket constructor
    win.WebSocket = MockWebSocket as any;
    
    cy.log('WebSocket mocked');
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to test the recording cycle (start and stop)
       * @example cy.testRecordingCycle()
       */
      testRecordingCycle(): Chainable<void>
      
      /**
       * Mocks the WebSocket connection for testing
       * @example cy.mockWebSocket()
       */
      mockWebSocket(): Chainable<void>
    }
  }
}