// Cypress E2E test for teacher-student flow

describe('Teacher-Student Session Flow', () => {
  let studentUrl;
  let classroomCode;

  before(() => {
    cy.visit('/teacher?e2e=true');
    cy.get('#classroom-code-display').should('not.have.text', 'LIVE').then($code => {
      classroomCode = $code.text();
      cy.get('#studentUrl').should('not.contain', 'Waiting for connection...').then($url => {
        studentUrl = $url.text();
      });
    });
  });

  it('Teacher page loads and shows classroom code', () => {
    cy.visit('/teacher?e2e=true');
    cy.document().then(doc => {
      // Log the teacher page HTML for inspection
      // eslint-disable-next-line no-console
      console.log('TEACHER PAGE HTML:', doc.documentElement.outerHTML);
    });
    cy.get('#classroom-code-display').should('not.have.text', 'LIVE');
    cy.get('#studentUrl').should('not.contain', 'Waiting for connection...');
  });

  it('Student page loads before connecting', () => {
    cy.visit(studentUrl + '&e2e=true', {
      onBeforeLoad(win) {
        win.VITE_WS_URL = 'ws://localhost:5000';
      }
    });
    cy.document().then(doc => {
      // Log the student page HTML for inspection
      // eslint-disable-next-line no-console
      console.log('STUDENT PAGE HTML:', doc.documentElement.outerHTML);
    });
    cy.get('#language-dropdown').should('exist');
    cy.get('#connect-btn').should('exist');
    cy.get('#connection-status').should('exist');
  });

  it('Student connects and teacher starts recording', () => {
    cy.visit(studentUrl + '&e2e=true', {
      onBeforeLoad(win) {
        win.VITE_WS_URL = 'ws://localhost:5000';
      }
    });
    cy.get('#language-dropdown').select('en-US');
    cy.get('#connect-btn').click();
    cy.get('#connection-status').should('contain.text', 'Connected');
    cy.document().then(doc => {
      // Log the student page HTML after connecting
      // eslint-disable-next-line no-console
      console.log('STUDENT PAGE HTML AFTER CONNECT:', doc.documentElement.outerHTML);
    });
    cy.visit('/teacher?e2e=true');
    cy.get('#recordButton').click();
    cy.document().then(doc => {
      // Log the teacher page HTML after starting recording
      // eslint-disable-next-line no-console
      console.log('TEACHER PAGE HTML AFTER RECORD:', doc.documentElement.outerHTML);
    });
  });

  it('Teacher creates a session and receives a classroom code', () => {
    expect(classroomCode).to.not.equal('LIVE');
    expect(studentUrl).to.include('/student?code=');
  });

  it('Student joins using the classroom code', () => {
    cy.visit(studentUrl + '&e2e=true', {
      onBeforeLoad(win) {
        win.VITE_WS_URL = 'ws://localhost:5000'; // Set backend WebSocket URL for test
      }
    });
    cy.get('#language-dropdown').select('en-US');
    cy.get('#connect-btn').click();
    cy.get('#connection-status').should('contain.text', 'Connected');
  });

  it('Teacher sends transcriptions; students receive translations', () => {
    cy.visit('/teacher?e2e=true');
    cy.get('#recordButton').click();
    cy.get('#transcription', { timeout: 10000 }).should(($el) => {
      expect($el.text()).not.to.contain('Transcribed speech will appear here...');
    });
    cy.visit(studentUrl + '&e2e=true', {
      onBeforeLoad(win) {
        win.VITE_WS_URL = 'ws://localhost:5000';
      }
    });
    cy.get('#translation-display', { timeout: 10000 }).should(($el) => {
      expect($el.text()).not.to.contain('Waiting for teacher to start speaking...');
    });
  });

  it('Session lifecycle: join, disconnect, reconnect, end session', () => {
    cy.visit(studentUrl + '&e2e=true', {
      onBeforeLoad(win) {
        win.VITE_WS_URL = 'ws://localhost:5000';
      }
    });
    cy.get('#connect-btn').click();
    cy.get('#connection-status').should('contain.text', 'Connected');
    cy.get('#connect-btn').click(); // Disconnect
    cy.get('#connection-status').should('contain.text', 'Disconnected');
    cy.get('#connect-btn').click(); // Reconnect
    cy.get('#connection-status').should('contain.text', 'Connected');
    cy.visit('/teacher?e2e=true');
    cy.get('#logout-btn').click();
    cy.get('body').should('contain.text', 'Teacher Login');
  });
});
