// Import commands.js using ES2015 syntax:
import './commands';

// Add testing-library commands
import '@testing-library/cypress/add-commands';

// Mock MediaStream API
Cypress.on('window:before:load', (win) => {
  // Create a mock MediaStream
  class MockMediaStream {
    getTracks() {
      return [
        { stop: cy.stub().as('stopTrack') }
      ];
    }
  }

  // Mock getUserMedia
  cy.stub(win.navigator.mediaDevices, 'getUserMedia').resolves(new MockMediaStream() as unknown as MediaStream);
  
  // Mock enumerateDevices
  cy.stub(win.navigator.mediaDevices, 'enumerateDevices').resolves([
    {
      deviceId: 'default',
      kind: 'audioinput',
      label: 'Default - Built-in Microphone',
      groupId: 'default'
    }
  ]);
  
  // Mock MediaRecorder
  win.MediaRecorder = class MockMediaRecorder {
    static isTypeSupported() {
      return true;
    }
    
    ondataavailable: ((e: any) => void) | null = null;
    onstart: (() => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    
    constructor(stream: MediaStream) {
      this.stream = stream;
    }
    
    stream: MediaStream;
    
    start(timeslice?: number) {
      this.state = 'recording';
      if (this.onstart) this.onstart();
      
      // Simulate sending data periodically
      this.interval = setInterval(() => {
        if (this.ondataavailable) {
          this.ondataavailable({
            data: new Blob(['audio data'], { type: 'audio/webm' })
          });
        }
      }, timeslice || 1000);
    }
    
    stop() {
      this.state = 'inactive';
      clearInterval(this.interval);
      if (this.onstop) this.onstop();
      cy.log('MediaRecorder stopped');
    }
    
    requestData() {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob(['audio data'], { type: 'audio/webm' })
        });
      }
    }
    
    private interval: number | null = null;
  };
});