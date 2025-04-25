/**
 * End-to-End Test for Benedictaitor UI Functionality
 * 
 * Tests UI functionality using Selenium WebDriver
 */
import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';

// Timeout values
const LOAD_TIMEOUT = 10000;
const ASSERTION_TIMEOUT = 5000;

describe('Benedictaitor UI Functionality', () => {
  let driver: WebDriver;
  
  beforeAll(async () => {
    // Set up headless Chrome
    const chromeOptions = new ChromeOptions();
    chromeOptions.addArguments(
      '--headless',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    );
    
    // Create WebDriver instance
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
  });
  
  afterAll(async () => {
    // Quit browser
    if (driver) {
      await driver.quit();
    }
  });
  
  /**
   * Waits for an element to be visible and returns it
   */
  async function waitForElement(selector: string, timeout: number = ASSERTION_TIMEOUT) {
    const element = await driver.wait(
      until.elementLocated(By.css(selector)),
      timeout,
      `Element ${selector} not found within ${timeout}ms`
    );
    
    await driver.wait(
      until.elementIsVisible(element),
      timeout,
      `Element ${selector} not visible within ${timeout}ms`
    );
    
    return element;
  }
  
  /**
   * Test that home page loads with all components
   */
  test('Home page loads with all components', async () => {
    // Navigate to home page
    await driver.get('http://localhost:5000');
    
    // Wait for page to load
    await driver.wait(
      until.titleContains('Benedictaitor'),
      LOAD_TIMEOUT,
      'Page title did not load'
    );
    
    // Verify teacher and student cards are present
    await waitForElement('.card h2[class*="text-xl"]:nth-of-type(1)');
    const teacherCard = await driver.findElement(By.css('h2.text-xl'));
    expect(await teacherCard.getText()).toContain('Teacher Mode');
    
    await waitForElement('button[class*="w-full"]:nth-of-type(1)');
    const teacherButton = await driver.findElement(
      By.xpath('//button[contains(text(), "Open Teacher Interface")]')
    );
    expect(await teacherButton.isDisplayed()).toBe(true);
    
    // Verify student section is present
    const studentCard = await driver.findElement(
      By.xpath('//h2[contains(text(), "Student Mode")]')
    );
    expect(await studentCard.isDisplayed()).toBe(true);
    
    // Verify all-in-one mode is present
    const allInOneTitle = await driver.findElement(
      By.xpath('//h2[contains(text(), "All-In-One Mode")]')
    );
    expect(await allInOneTitle.isDisplayed()).toBe(true);
    
    // Verify tabs are present and functional
    const teacherTab = await driver.findElement(
      By.xpath('//button[contains(text(), "Teacher Mode") and contains(@class, "TabsTrigger")]')
    );
    expect(await teacherTab.isDisplayed()).toBe(true);
    
    const studentTab = await driver.findElement(
      By.xpath('//button[contains(text(), "Student Mode") and contains(@class, "TabsTrigger")]')
    );
    expect(await studentTab.isDisplayed()).toBe(true);
    
    // Verify about section
    const aboutTitle = await driver.findElement(
      By.xpath('//h3[contains(text(), "About Benedictaitor")]')
    );
    expect(await aboutTitle.isDisplayed()).toBe(true);
    
    // Verify developer tools are present in the Home page
    const devToolsSection = await driver.findElement(
      By.xpath('//h3[contains(text(), "Developer Testing Tools")]')
    );
    expect(await devToolsSection.isDisplayed()).toBe(true);
  }, 30000);
  
  /**
   * Test that teacher page loads correctly
   */
  test('Teacher page loads with microphone controls', async () => {
    // Navigate to teacher page
    await driver.get('http://localhost:5000/teacher');
    
    // Wait for page to load
    await driver.wait(
      until.elementLocated(By.css('.teacher-interface')),
      LOAD_TIMEOUT,
      'Teacher interface did not load'
    );
    
    // Verify microphone button is present
    const micButton = await waitForElement('button[aria-label="Toggle Microphone"]');
    expect(await micButton.isDisplayed()).toBe(true);
    
    // Verify language selector is present
    const languageSelector = await waitForElement('select[aria-label="Teacher Language"]');
    expect(await languageSelector.isDisplayed()).toBe(true);
    
    // Verify transcript area is present
    const transcriptArea = await waitForElement('.transcript-area');
    expect(await transcriptArea.isDisplayed()).toBe(true);
  }, 30000);
  
  /**
   * Test that student page loads correctly
   */
  test('Student page loads with language selection', async () => {
    // Navigate to student page
    await driver.get('http://localhost:5000/student');
    
    // Wait for page to load
    await driver.wait(
      until.elementLocated(By.css('.student-interface')),
      LOAD_TIMEOUT,
      'Student interface did not load'
    );
    
    // Verify language selector is present
    const languageSelector = await waitForElement('select[aria-label="Student Language"]');
    expect(await languageSelector.isDisplayed()).toBe(true);
    
    // Verify translation area is present
    const translationArea = await waitForElement('.translation-area');
    expect(await translationArea.isDisplayed()).toBe(true);
  }, 30000);
  
  /**
   * Test navigation between pages
   */
  test('Navigation works between pages', async () => {
    // Navigate to home page
    await driver.get('http://localhost:5000');
    
    // Wait for page to load
    await waitForElement('.card h2.text-xl');
    
    // Click on teacher button
    const teacherButton = await driver.findElement(
      By.xpath('//button[contains(text(), "Open Teacher Interface")]')
    );
    await teacherButton.click();
    
    // Verify we're on the teacher page
    await driver.wait(
      until.elementLocated(By.css('.teacher-interface')),
      LOAD_TIMEOUT,
      'Teacher interface did not load after navigation'
    );
    
    // Navigate back to home
    await driver.get('http://localhost:5000');
    
    // Click on student button
    const studentButton = await driver.findElement(
      By.xpath('//button[contains(text(), "Open Student Interface")]')
    );
    await studentButton.click();
    
    // Verify we're on the student page
    await driver.wait(
      until.elementLocated(By.css('.student-interface')),
      LOAD_TIMEOUT,
      'Student interface did not load after navigation'
    );
  }, 30000);
  
  /**
   * Test the All-In-One mode tabs switch content correctly
   */
  test('All-In-One mode tab switching works', async () => {
    // Navigate to home page
    await driver.get('http://localhost:5000');
    
    // Wait for page to load
    await waitForElement('.card h2.text-xl');
    
    // Find and click the Teacher tab
    const teacherTab = await driver.findElement(
      By.xpath('//button[contains(text(), "Teacher Mode") and contains(@class, "TabsTrigger")]')
    );
    await teacherTab.click();
    
    // Verify teacher content is visible
    await waitForElement('.teacher-controls');
    
    // Find and click the Student tab
    const studentTab = await driver.findElement(
      By.xpath('//button[contains(text(), "Student Mode") and contains(@class, "TabsTrigger")]')
    );
    await studentTab.click();
    
    // Verify student content is visible
    await waitForElement('.student-controls');
  }, 30000);
  
  /**
   * Test WebSocket connection status indicator
   */
  test('WebSocket connection status indicator works', async () => {
    // Navigate to home page
    await driver.get('http://localhost:5000');
    
    // Wait for page to load
    await waitForElement('.card h2.text-xl');
    
    // Verify connection status indicator is present
    const connectionStatus = await waitForElement('.connection-status');
    expect(await connectionStatus.isDisplayed()).toBe(true);
    
    // The status might be connecting or connected, both are valid
    const statusText = await connectionStatus.getText();
    expect(['Connected', 'Connecting', 'Disconnected']).toContain(statusText);
  }, 30000);
  
  /**
   * Test speech test page functionality
   */
  test('Speech test page loads with controls', async () => {
    // Navigate to speech test page
    await driver.get('http://localhost:5000/speechtest');
    
    // Wait for page to load
    await driver.wait(
      until.elementLocated(By.css('.speech-test-container')),
      LOAD_TIMEOUT,
      'Speech test page did not load'
    );
    
    // Verify start button is present
    const startButton = await waitForElement('button[aria-label="Start Speech Recognition"]');
    expect(await startButton.isDisplayed()).toBe(true);
    
    // Verify stop button is present
    const stopButton = await waitForElement('button[aria-label="Stop Speech Recognition"]');
    expect(await stopButton.isDisplayed()).toBe(true);
    
    // Verify results area is present
    const resultsArea = await waitForElement('.speech-results');
    expect(await resultsArea.isDisplayed()).toBe(true);
  }, 30000);
  
  /**
   * Test WebSocket diagnostic page
   */
  test('WebSocket diagnostic page loads', async () => {
    // Navigate to WebSocket diagnostic page
    await driver.get('http://localhost:5000/websocket-diagnostics.html');
    
    // Wait for page to load
    await driver.wait(
      until.elementLocated(By.css('#connection-status')),
      LOAD_TIMEOUT,
      'WebSocket diagnostic page did not load'
    );
    
    // Verify connection controls are present
    const connectButton = await waitForElement('#connect-button');
    expect(await connectButton.isDisplayed()).toBe(true);
    
    const disconnectButton = await waitForElement('#disconnect-button');
    expect(await disconnectButton.isDisplayed()).toBe(true);
    
    // Verify message controls are present
    const messageInput = await waitForElement('#message-input');
    expect(await messageInput.isDisplayed()).toBe(true);
    
    const sendButton = await waitForElement('#send-button');
    expect(await sendButton.isDisplayed()).toBe(true);
    
    // Verify logs area is present
    const logsArea = await waitForElement('#logs');
    expect(await logsArea.isDisplayed()).toBe(true);
  }, 30000);
});