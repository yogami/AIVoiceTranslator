const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');

// Set up application URL - use environment variable or default
const APP_URL = process.env.APP_URL || 'https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev';
console.log(`Running tests against: ${APP_URL}`);

// Set up Chrome options for headless mode
const options = new chrome.Options();
options.addArguments('--headless');
options.addArguments('--no-sandbox');
options.addArguments('--disable-dev-shm-usage');

describe('AIVoiceTranslator UI Tests', function() {
  let driver;

  before(async function() {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Set implicit wait to make tests more robust
    await driver.manage().setTimeouts({ implicit: 5000 });
  });

  after(async function() {
    if (driver) {
      await driver.quit();
    }
  });

  it('should load the teacher interface correctly', async function() {
    await driver.get(`${APP_URL}/simple-speech-test.html`);
    
    // Check page title
    const title = await driver.getTitle();
    assert.ok(title.includes('AIVoiceTranslator'));
    
    // Verify key elements are present
    const startButton = await driver.findElement(By.id('startButton'));
    const stopButton = await driver.findElement(By.id('stopButton'));
    const languageSelect = await driver.findElement(By.id('languageSelect'));
    
    // Verify UI text
    const headerText = await driver.findElement(By.tagName('h1')).getText();
    assert.ok(headerText.includes('AIVoiceTranslator'));
    
    console.log('✅ Teacher interface loaded correctly');
  });

  it('should load the student interface correctly', async function() {
    await driver.get(`${APP_URL}/simple-student.html`);
    
    // Check page title
    const title = await driver.getTitle();
    assert.ok(title.includes('AIVoiceTranslator'));
    
    // Verify key elements are present
    const languageSelect = await driver.findElement(By.id('studentLanguageSelect'));
    const transcriptArea = await driver.findElement(By.id('translationOutput'));
    
    // Verify UI text
    const headerText = await driver.findElement(By.tagName('h1')).getText();
    assert.ok(headerText.includes('AIVoiceTranslator'));
    
    console.log('✅ Student interface loaded correctly');
  });

  it('should load the metrics dashboard correctly', async function() {
    await driver.get(`${APP_URL}/code-metrics.html`);
    
    // Check page title
    const title = await driver.getTitle();
    assert.ok(title.includes('Code Metrics'));
    
    // Verify key dashboard elements are present
    const coverageCard = await driver.findElement(By.id('coverageCard'));
    const complexityCard = await driver.findElement(By.id('complexityCard'));
    const codeSmellsCard = await driver.findElement(By.id('codeSmellsCard'));
    
    // Verify at least one metric is loaded
    await driver.wait(until.elementLocated(By.css('.metric-value')), 10000);
    const metricValues = await driver.findElements(By.css('.metric-value'));
    assert.ok(metricValues.length > 0);
    
    console.log('✅ Metrics dashboard loaded correctly');
  });

  it('should establish WebSocket connection on teacher page', async function() {
    await driver.get(`${APP_URL}/simple-speech-test.html`);
    
    // Wait for connection status to update
    await driver.wait(async function() {
      const statusElement = await driver.findElement(By.id('connectionStatus'));
      const statusText = await statusElement.getText();
      return statusText.includes('Connected');
    }, 10000, 'WebSocket connection failed to establish');
    
    // Verify connection established text
    const statusElement = await driver.findElement(By.id('connectionStatus'));
    const statusText = await statusElement.getText();
    assert.ok(statusText.includes('Connected'));
    
    console.log('✅ WebSocket connection established successfully');
  });

  it('should update test coverage metrics in the dashboard', async function() {
    await driver.get(`${APP_URL}/code-metrics.html`);
    
    // Wait for coverage metrics to load
    await driver.wait(until.elementLocated(By.css('#coverageOverall .metric-value')), 10000);
    
    // Get the coverage percentage
    const coverageElement = await driver.findElement(By.css('#coverageOverall .metric-value'));
    const coverageText = await coverageElement.getText();
    
    // Verify it's a valid percentage
    const coverageValue = parseFloat(coverageText);
    assert.ok(!isNaN(coverageValue) && coverageValue >= 0 && coverageValue <= 100);
    
    console.log(`✅ Test coverage loaded: ${coverageText}`);
  });
});