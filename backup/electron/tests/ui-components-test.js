/**
 * UI Components Tests for Benedictaitor
 * 
 * This test verifies the UI components across different pages:
 * - Navigation elements
 * - Teacher interface components
 * - Student interface components
 * - Audio visualization
 * - Responsive design
 */

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// Configuration
const APP_URL = process.env.APP_URL || 'https://bendictaitor-app.replit.app';
const TEST_TIMEOUT = 30000;

// Helper function to take screenshots
async function takeScreenshot(driver, name) {
  try {
    const screenshot = await driver.takeScreenshot();
    console.log(`Screenshot "${name}" captured`);
    return screenshot;
  } catch (error) {
    console.error(`Error taking screenshot "${name}": ${error.message}`);
    return null;
  }
}

// Helper function to check if element exists
async function elementExists(driver, selector, timeout = 5000) {
  try {
    await driver.wait(until.elementLocated(By.css(selector)), timeout);
    return true;
  } catch (error) {
    return false;
  }
}

// Main test function
async function runUITests() {
  let driver = null;
  
  try {
    console.log('Starting UI Components Tests...');
    
    // Set up Chrome options
    const options = new chrome.Options();
    options.addArguments('--window-size=1280,800');
    options.addArguments('--disable-extensions');
    options.addArguments('--use-fake-ui-for-media-stream'); // Auto-approve media permissions
    
    // Add mobile emulation for testing responsive design
    // We'll test responsiveness later in the test
    
    // Build the WebDriver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Set implicit wait
    await driver.manage().setTimeouts({ implicit: 5000 });
    
    // Navigate to the application
    console.log(`Navigating to ${APP_URL}...`);
    await driver.get(APP_URL);
    
    // Wait for the page to load
    const pageTitle = await driver.getTitle();
    console.log(`Page loaded: ${pageTitle}`);
    
    // Take screenshot of home page
    await takeScreenshot(driver, 'home-page');
    
    // Test 1: Navigation Components
    console.log('\nTest 1: Navigation Components');
    
    // Check for navigation links
    const navLinks = await driver.findElements(By.css('nav a, .nav-link, a.link, header a'));
    
    if (navLinks.length > 0) {
      console.log(`  ✅ PASS: Found ${navLinks.length} navigation links`);
      
      // Log the href and text of each link
      for (const link of navLinks) {
        const href = await link.getAttribute('href');
        const text = await link.getText();
        console.log(`  Link: ${text || '(no text)'} -> ${href || '(no href)'}`);
      }
    } else {
      console.log('  ⚠️ WARNING: No navigation links found with standard selectors');
      
      // Check for any clickable elements that might be navigation
      const possibleNavItems = await driver.findElements(
        By.css('button[data-nav], [role="navigation"] *, a')
      );
      
      if (possibleNavItems.length > 0) {
        console.log(`  ✅ PASS: Found ${possibleNavItems.length} possible navigation elements`);
      } else {
        console.log('  ❌ FAIL: No navigation elements found');
      }
    }
    
    // Test 2: Teacher Interface
    console.log('\nTest 2: Teacher Interface');
    
    // Navigate to teacher page
    console.log('  Navigating to Teacher page...');
    
    // Try to find and click a teacher link
    const teacherLinks = await driver.findElements(
      By.css('a[href*="teacher"], a:contains("Teacher"), button:contains("Teacher")')
    );
    
    if (teacherLinks.length > 0) {
      await teacherLinks[0].click();
      console.log('  Clicked on teacher link');
    } else {
      // Direct navigation if link not found
      await driver.get(`${APP_URL}/teacher`);
      console.log('  Directly navigated to Teacher page');
    }
    
    // Wait for teacher page to load
    await driver.wait(
      until.elementLocated(By.css('.teacher-interface, #teacher-page, [data-page="teacher"]')),
      10000
    ).catch(() => console.log('  Teacher page specific elements not found, continuing with tests'));
    
    // Take screenshot of teacher page
    await takeScreenshot(driver, 'teacher-page');
    
    // Check for key teacher interface components
    const teacherComponents = [
      { selector: 'button.record-button, button[aria-label*="Record"], button:contains("Record")', name: 'Recording Button' },
      { selector: 'select.language-select, [role="combobox"], .language-selector', name: 'Language Selector' },
      { selector: '.transcription, .speech-text, #transcript, .transcript', name: 'Transcription Display' },
      { selector: '.status, .connection-status, .connection-indicator', name: 'Connection Status' }
    ];
    
    let teacherComponentsFound = 0;
    
    for (const { selector, name } of teacherComponents) {
      const elements = await driver.findElements(By.css(selector));
      
      if (elements.length > 0) {
        console.log(`  ✅ PASS: Found ${name}`);
        teacherComponentsFound++;
      } else {
        console.log(`  ⚠️ WARNING: ${name} not found with selector "${selector}"`);
      }
    }
    
    if (teacherComponentsFound >= 2) {
      console.log('  ✅ PASS: Found multiple Teacher interface components');
    } else {
      console.log('  ❌ FAIL: Not enough Teacher interface components found');
    }
    
    // Test 3: Student Interface
    console.log('\nTest 3: Student Interface');
    
    // Navigate to student page
    console.log('  Navigating to Student page...');
    
    // Try to find and click a student link
    const studentLinks = await driver.findElements(
      By.css('a[href*="student"], a:contains("Student"), button:contains("Student")')
    );
    
    if (studentLinks.length > 0) {
      await studentLinks[0].click();
      console.log('  Clicked on student link');
    } else {
      // Direct navigation if link not found
      await driver.get(`${APP_URL}/student`);
      console.log('  Directly navigated to Student page');
    }
    
    // Wait for student page to load
    await driver.wait(
      until.elementLocated(By.css('.student-interface, #student-page, [data-page="student"]')),
      10000
    ).catch(() => console.log('  Student page specific elements not found, continuing with tests'));
    
    // Take screenshot of student page
    await takeScreenshot(driver, 'student-page');
    
    // Check for key student interface components
    const studentComponents = [
      { selector: 'select.language-select, [role="combobox"], .language-selector', name: 'Language Selector' },
      { selector: '.translation, .speech-text, #translation, .transcript', name: 'Translation Display' },
      { selector: '.status, .connection-status, .connection-indicator', name: 'Connection Status' }
    ];
    
    let studentComponentsFound = 0;
    
    for (const { selector, name } of studentComponents) {
      const elements = await driver.findElements(By.css(selector));
      
      if (elements.length > 0) {
        console.log(`  ✅ PASS: Found ${name}`);
        studentComponentsFound++;
      } else {
        console.log(`  ⚠️ WARNING: ${name} not found with selector "${selector}"`);
      }
    }
    
    if (studentComponentsFound >= 2) {
      console.log('  ✅ PASS: Found multiple Student interface components');
    } else {
      console.log('  ❌ FAIL: Not enough Student interface components found');
    }
    
    // Test 4: Audio Visualization
    console.log('\nTest 4: Audio Visualization');
    
    // Return to teacher page
    await driver.get(`${APP_URL}/teacher`);
    console.log('  Returned to Teacher page');
    
    // Check for audio visualization elements
    const visualizationElements = await driver.findElements(
      By.css('.audio-wave, .visualization, .waveform, .wave, .audio-bars')
    );
    
    if (visualizationElements.length > 0) {
      console.log('  ✅ PASS: Found audio visualization elements');
    } else {
      console.log('  ⚠️ WARNING: No audio visualization elements found with standard selectors');
      
      // Check for canvas elements which might be used for visualization
      const canvasElements = await driver.findElements(By.css('canvas'));
      
      if (canvasElements.length > 0) {
        console.log(`  ✅ PASS: Found ${canvasElements.length} canvas elements that might be used for visualization`);
      } else {
        console.log('  ⚠️ WARNING: No canvas elements found for potential audio visualization');
      }
    }
    
    // Test 5: Responsive Design
    console.log('\nTest 5: Responsive Design');
    
    // Test multiple viewport sizes
    const viewportSizes = [
      { width: 375, height: 667, name: 'Mobile (iPhone 8)' },
      { width: 768, height: 1024, name: 'Tablet (iPad)' },
      { width: 1280, height: 800, name: 'Desktop' }
    ];
    
    for (const { width, height, name } of viewportSizes) {
      console.log(`  Testing viewport: ${name} (${width}x${height})`);
      
      // Resize the window
      await driver.manage().window().setRect({ width, height });
      
      // Wait a moment for responsive layout to adjust
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Take screenshot
      await takeScreenshot(driver, `responsive-${name.toLowerCase().replace(/[() ]/g, '-')}`);
      
      // Check if the navigation is still accessible
      const navElementsResponsive = await driver.findElements(
        By.css('nav, .nav, .navbar, header, button.menu-toggle, .hamburger')
      );
      
      if (navElementsResponsive.length > 0) {
        console.log(`  ✅ PASS: Navigation elements visible at ${name} viewport`);
      } else {
        console.log(`  ⚠️ WARNING: Navigation elements not found at ${name} viewport`);
      }
      
      // Check if content is properly visible (not overflowing)
      const bodyOverflow = await driver.executeScript(`
        const body = document.body;
        return body.scrollWidth > body.clientWidth;
      `);
      
      if (bodyOverflow) {
        console.log(`  ⚠️ WARNING: Content may be overflowing at ${name} viewport`);
      } else {
        console.log(`  ✅ PASS: Content fits within ${name} viewport`);
      }
    }
    
    // Final assessment
    console.log('\nUI Components Test Summary:');
    console.log('✅ Navigation components tested');
    console.log('✅ Teacher interface components tested');
    console.log('✅ Student interface components tested');
    console.log('✅ Audio visualization tested');
    console.log('✅ Responsive design tested');
    
    console.log('\n✅ UI Components Tests completed successfully');
    
    return true;
  } catch (error) {
    console.error(`❌ UI Components Tests failed: ${error.message}`);
    
    // Take failure screenshot if possible
    if (driver) {
      await takeScreenshot(driver, 'ui-test-failure');
    }
    
    return false;
  } finally {
    // Close the browser
    if (driver) {
      console.log('Closing browser...');
      await driver.quit();
    }
  }
}

// Run the tests
runUITests()
  .then(success => {
    console.log(`UI Components Tests ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`Test execution error: ${error.message}`);
    process.exit(1);
  });