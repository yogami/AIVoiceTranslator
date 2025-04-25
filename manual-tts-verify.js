/**
 * Manual TTS Service Consistency Verification Script
 * 
 * This script simulates the key assertions from the Selenium tests
 * to verify that our student interface maintains TTS service consistency.
 */

import puppeteer from 'puppeteer';

// Configuration
const APP_URL = 'http://localhost:5000';
const STUDENT_URL = `${APP_URL}/client/public/simple-student.html`;
const TEACHER_URL = `${APP_URL}/client/public/websocket-diagnostics.html`;
const TIMEOUT = 10000;

// Helper for logging with timestamps
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function runTest() {
  log('Starting TTS service consistency test');
  
  // Launch browser instances
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  
  try {
    // Create teacher page
    log('Opening teacher interface');
    const teacherPage = await browser.newPage();
    await teacherPage.goto(TEACHER_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    
    // Create student page
    log('Opening student interface');
    const studentPage = await browser.newPage();
    await studentPage.goto(STUDENT_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    
    // Connect teacher
    log('Connecting teacher');
    await teacherPage.click('#teacher-connect-btn');
    await teacherPage.waitForSelector('.status.connected', { timeout: TIMEOUT });
    
    // Connect student
    log('Connecting student');
    await studentPage.click('#connect-btn');
    await studentPage.waitForSelector('.connection-status.connected', { timeout: TIMEOUT });
    
    // Test 1: Verify student initially shows Browser TTS as active
    log('Test 1: Verifying initial TTS service is Browser');
    const initialTtsService = await studentPage.$eval('#current-tts-service', el => el.textContent);
    log(`  Student shows TTS service: ${initialTtsService}`);
    if (initialTtsService.includes('browser')) {
      log('  ✓ Test 1 passed: Student interface initially shows Browser TTS');
    } else {
      log('  ✗ Test 1 failed: Student interface should initially show Browser TTS');
    }
    
    // Test 2: Change to OpenAI TTS on teacher side and check student UI updates
    log('Test 2: Changing TTS service to OpenAI');
    await teacherPage.click('#teacher-tts-openai-btn');
    await teacherPage.waitForTimeout(1000);
    
    // Send test message from teacher
    log('  Sending test message from teacher');
    await teacherPage.type('#teacher-message', 'This is a test message for OpenAI TTS');
    await teacherPage.click('#teacher-send-btn');
    
    // Wait for translation to appear on student side
    await studentPage.waitForSelector('.translation', { timeout: TIMEOUT });
    
    // Check student display of TTS service after teacher changes it
    const updatedTtsService = await studentPage.$eval('#current-tts-service', el => el.textContent);
    log(`  Student now shows TTS service: ${updatedTtsService}`);
    
    if (updatedTtsService.includes('openai')) {
      log('  ✓ Test 2 passed: Student interface shows OpenAI TTS after teacher change');
    } else {
      log('  ✗ Test 2 failed: Student interface should show OpenAI TTS after teacher change');
    }
    
    // Test 3: Verify Play button label shows OpenAI service
    log('Test 3: Checking Play button label shows correct TTS service');
    const playButtonText = await studentPage.$eval('#play-button', el => el.textContent);
    log(`  Play button text: ${playButtonText}`);
    
    if (playButtonText.includes('OpenAI')) {
      log('  ✓ Test 3 passed: Play button shows OpenAI TTS service');
    } else {
      log('  ✗ Test 3 failed: Play button should indicate OpenAI TTS service');
    }
    
    log('All tests completed');
  } catch (error) {
    log(`ERROR: ${error.message}`);
  } finally {
    await browser.close();
    log('Test browser closed');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});