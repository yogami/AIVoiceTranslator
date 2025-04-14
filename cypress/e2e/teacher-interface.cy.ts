describe('Teacher Interface', () => {
  beforeEach(() => {
    // Mock the WebSocket connection before visiting the page
    cy.mockWebSocket();
    
    // Visit the teacher page
    cy.visit('/teacher');
    
    // Wait for the page to be fully loaded
    cy.findByText('Audio Input').should('be.visible');
  });

  it('should show proper initial state', () => {
    // Check initial UI elements
    cy.findByText('Audio Input').should('be.visible');
    cy.findByText('Translation Output').should('be.visible');
    cy.findByText('Not recording').should('be.visible');
    cy.findByRole('button', { name: /record/i }).should('be.visible');
  });

  it('should handle the Record and Stop button cycle', () => {
    // Test basic recording cycle
    cy.testRecordingCycle();
  });

  it('should update UI elements when recording is active', () => {
    // Start recording
    cy.findByRole('button', { name: /record/i }).click();
    
    // Verify recording state is reflected in UI
    cy.findByText('Recording').should('be.visible');
    cy.findByRole('button', { name: /stop/i }).should('be.visible');
    
    // Microphone selector should be disabled during recording
    cy.get('select').should('be.disabled');
    
    // Stop recording
    cy.findByRole('button', { name: /stop/i }).click();
    
    // Verify recording has stopped and UI is updated
    cy.findByText('Enabled').should('be.visible');
    cy.findByRole('button', { name: /record/i }).should('be.visible');
    
    // Verify microphone selector is enabled again
    cy.get('select').should('not.be.disabled');
  });

  it('should handle multiple Record/Stop cycles without getting stuck', () => {
    // First cycle
    cy.testRecordingCycle();
    
    // Second cycle
    cy.testRecordingCycle();
    
    // Third cycle
    cy.testRecordingCycle();
  });

  it('should properly visualize audio with waveform', () => {
    // Check that waveform is initially in inactive state
    cy.get('[aria-hidden="true"]').find('.bar').should('have.class', 'bg-gray-300');
    
    // Start recording
    cy.findByRole('button', { name: /record/i }).click();
    
    // Check that waveform is now active
    cy.get('[aria-hidden="true"]').find('.bar').should('have.class', 'bg-primary');
    
    // Stop recording
    cy.findByRole('button', { name: /stop/i }).click();
    
    // Check that waveform returns to inactive state
    cy.get('[aria-hidden="true"]').find('.bar').should('have.class', 'bg-gray-300');
  });
});