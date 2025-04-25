/**
 * End-to-End Test for WebSocket Functionality
 * 
 * This test uses Selenium WebDriver to:
 * 1. Load the teacher and student pages
 * 2. Connect to the WebSocket server from both
 * 3. Send a test message from the teacher
 * 4. Verify the message is received by the student
 */
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { expect } = require('chai');

// Set up Chrome options
const chromeOptions = new chrome.Options();
chromeOptions.addArguments('--headless'); // Run in headless mode
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');

// Test function
async function testWebSocketFunctionality() {
  let teacherDriver, studentDriver;
  
  try {
    // Create Chrome drivers
    teacherDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    
    studentDriver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    
    // Set timeout to 10 seconds
    await teacherDriver.manage().setTimeouts({ implicit: 10000 });
    await studentDriver.manage().setTimeouts({ implicit: 10000 });
    
    // Base URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    
    // Load teacher page
    await teacherDriver.get(`${baseUrl}/simple-test.html`);
    await teacherDriver.wait(until.elementLocated(By.tagName('body')), 10000);
    
    // Load student page
    await studentDriver.get(`${baseUrl}/simple-test-student.html`);
    await studentDriver.wait(until.elementLocated(By.tagName('body')), 10000);
    
    // Connect teacher
    const teacherConnectBtn = await teacherDriver.findElement(By.id('connect-btn'));
    await teacherConnectBtn.click();
    
    // Wait for teacher connection to be established
    await teacherDriver.wait(until.elementTextContains(
      await teacherDriver.findElement(By.id('status')), 
      'Connected'
    ), 10000);
    
    // Connect student
    const studentConnectBtn = await studentDriver.findElement(By.id('connect-btn'));
    await studentConnectBtn.click();
    
    // Wait for student connection to be established
    await studentDriver.wait(until.elementTextContains(
      await studentDriver.findElement(By.id('status')), 
      'Connected'
    ), 10000);
    
    // Verify teacher role is selected
    const teacherRole = await teacherDriver.findElement(By.id('role')).getText();
    expect(teacherRole.toLowerCase()).to.include('teacher');
    
    // Verify student role is selected
    const studentRole = await studentDriver.findElement(By.id('role')).getText();
    expect(studentRole.toLowerCase()).to.include('student');
    
    // Generate a unique test message
    const testMessage = `Test message ${Date.now()}`;
    
    // Input test message on teacher page
    const messageInput = await teacherDriver.findElement(By.id('message'));
    await messageInput.clear();
    await messageInput.sendKeys(testMessage);
    
    // Send message
    const sendBtn = await teacherDriver.findElement(By.id('send-btn'));
    await sendBtn.click();
    
    // Wait for message to be sent (check logs)
    await teacherDriver.wait(until.elementTextContains(
      await teacherDriver.findElement(By.id('logs')), 
      `Sent transcription: ${testMessage}`
    ), 10000);
    
    // Wait a bit for server processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get logs from student page
    const studentLogs = await studentDriver.findElement(By.id('logs')).getText();
    
    // Verify student received a translation message
    console.log('Student logs:', studentLogs);
    expect(studentLogs).to.include('Received:');
    expect(studentLogs).to.include('translation');
    
    console.log('✓ WebSocket test passed successfully');
    
    return true;
  } catch (error) {
    console.error('Error in WebSocket functionality test:', error);
    throw error;
  } finally {
    // Close the drivers
    if (teacherDriver) {
      await teacherDriver.quit();
    }
    
    if (studentDriver) {
      await studentDriver.quit();
    }
  }
}

// Run test
describe('WebSocket Functionality Tests', function() {
  // Set timeout to 60 seconds for the entire test
  this.timeout(60000);
  
  it('should connect teacher and student clients and exchange messages', async function() {
    const result = await testWebSocketFunctionality();
    expect(result).to.be.true;
  });
});