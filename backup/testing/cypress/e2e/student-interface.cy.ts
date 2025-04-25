describe('Student Interface', () => {
  beforeEach(() => {
    // Mock the WebSocket connection before visiting the page
    cy.mockWebSocket();
    
    // Visit the student page
    cy.visit('/student');
    
    // Wait for the page to be fully loaded
    cy.findByText('Select your language').should('be.visible');
  });

  it('should display the language selector', () => {
    cy.findByText('Select your language').should('be.visible');
    cy.get('select').should('be.visible');
  });

  it('should show welcome message', () => {
    cy.findByText(/welcome to the classroom/i).should('be.visible');
  });

  it('should display the teacher status', () => {
    cy.findByText(/waiting for teacher/i).should('be.visible');
  });
});