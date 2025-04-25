describe('Navigation and Routing', () => {
  beforeEach(() => {
    // Visit the home page
    cy.visit('/');
  });

  it('should have working navigation links on home page', () => {
    // Check home page content
    cy.findByText(/real-time voice translation/i).should('be.visible');
    
    // Check for teacher interface link
    cy.findByRole('link', { name: /teacher interface/i }).should('be.visible');
    
    // Check for student interface link
    cy.findByRole('link', { name: /student interface/i }).should('be.visible');
  });

  it('should navigate to teacher interface', () => {
    cy.findByRole('link', { name: /teacher interface/i }).click();
    cy.url().should('include', '/teacher');
    cy.findByText('Audio Input').should('be.visible');
  });

  it('should navigate to student interface', () => {
    cy.findByRole('link', { name: /student interface/i }).click();
    cy.url().should('include', '/student');
    cy.findByText('Select your language').should('be.visible');
  });

  it('should navigate to QR code page', () => {
    cy.findByRole('link', { name: /qr code/i }).click();
    cy.url().should('include', '/qrcode');
    cy.findByText(/scan this qr code/i).should('be.visible');
  });
});