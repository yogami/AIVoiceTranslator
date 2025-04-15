/**
 * Real Hardware End-to-End Test for Benedictaitor
 * 
 * This test:
 * 1. Opens a browser and navigates to the teacher interface
 * 2. Plays an actual audio file through system speakers
 * 3. Waits for the microphone to pick up the audio
 * 4. Verifies the transcription appears correctly
 * 
 * This test requires:
 * - Working speakers
 * - Working microphone
 * - Audio routing that allows the microphone to pick up speaker output
 */

import { Builder, By, until } from 'selenium-webdriver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_AUDIO_PATH = path.join(__dirname, 'test-message.wav');

// Play audio through system speakers
async function playAudioFile() {
  return new Promise((resolve, reject) => {
    console.log('Playing test audio through system speakers...');
    
    try {
      // Try to determine the OS to use the appropriate audio player
      const platform = process.platform;
      let command;
      
      if (platform === 'darwin') {
        // macOS
        command = `afplay "${TEST_AUDIO_PATH}"`;
      } else if (platform === 'win32') {
        // Windows
        command = `powershell -c (New-Object Media.SoundPlayer '${TEST_AUDIO_PATH}').PlaySync()`;
      } else {
        // Linux and others - try to use play from sox package
        command = `play "${TEST_AUDIO_PATH}"`;
      }
      
      console.log(`Executing command: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error playing audio: ${error.message}`);
          console.error(`You may need to install: 
            - On Linux: sudo apt-get install sox
            - On macOS: brew install sox
            - On Windows: No additional software needed
          `);
          
          // Still resolve as we don't want to fail the test just because
          // we couldn't play the audio through one method
          resolve(false);
        } else {
          console.log('Audio played successfully');
          resolve(true);
        }
      });
    } catch (error) {
      console.error('Error attempting to play audio:', error);
      resolve(false);
    }
  });
}

// Ensure test audio file exists
async function ensureTestAudioExists() {
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log('Test audio file not found, creating it...');
    
    // This is the same test audio from e2e-speech-test.js
    const TEST_AUDIO_BASE64 = `
    UklGRrAYAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YYwYAAAAADYPXh6+IHEi
    +yIgIT4gMiIvGUoOFBNwJDQVtAhPGUMZUhCmF0odURNICRwcgBXMErQjShhSFlkhkRMEBnoe
    cRONDHQOUQyoFiwXFQV3CDcbSBmcDYQJUByKFtYHeC22KvITTAmkHh0clgK5FlIbLxD+CKIY
    sRRoBkUSjCIZEGwHuyu9JNUMhSc/IwQHUhl6L7AQvwk0MRshqxrFJVIEAgAkHxIYeg1/FYYt
    GRImDnUvTRWOBeUrPyXLCPEfGyU6AmwWuyyLAS8I0CZ5GecOXRG+JV0TBA0DLt4fcwnzJFoe
    wwK4GYcsfA1CCrEkMCLeDFYMjS2QIb8ITRsHLlMLsQvYJd0WPAV9E7MlrRO/B+UkXCOICzUJ
    xS2wJC0IBxa+J4UInQUgHgMgTAaHEg8jCAyjCUwZXSWMCF8D5SC3IDwIbQmbJEYbwwHqF9go
    cQOsBdwW2xyrCxIIHCKwGx0DiQzwGFARXAVTDrUYFw+cEzAaYhTwBnIQpBmMDSgMKhpyDlIG
    +RJ2GOMNYgXMF2QQVgkfEiYY7gz7BVESMRg/B+4JdRdODo0JYRl3FTkF4QyJG+gGkAOBFQsO
    OAf6FsUVHQZzBwoX5Qv7DS4YUwpdB5oXSA0HA8ISpgqoBj8SgxTJChUJ+Rf0CpYDihF+DOwG
    +RXbFjIMbg+eF4cFNQYyHF8M/APZFWUSVwadBxwZnwyxCsEYZg0VAx0YVxXqBlQGZhleDJkB
    GRmKEqcDxgl1F+wEOAJzHXIKFAD2FaMZSwOrCA4XIgg8C/QXRQp4A08UghV/BsMJQiMGDR4C
    xROFDnUTiBDbFFICxhCJHoYHHQXhHdIMoAs2H38PFAdPGNwUnABxDCkgKwcfBS4btBAJDZwU
    Mgm9DRIVwQ5qCPQQwxZ8CN8JlBZrDCwExRVFEi0Eww9nFUAJ4Qx5EJkL3Q4XDhoOCwvaCZcQ
    hwv0ByASnQ1NBtwOrxXyBpUMaBZtCw8NQBG/Cd8IuRRZB5oEkBUrDM0D9g43ErYHjwisFhUP
    9AlkE9sMKAZHD0oQggJoC78WcwOZBZgVWgfbBUkVXwRxAGMNkw4RAlQCuxeQBMkFPxoGA2QD
    ixBGBN8KYQxXCWsMGg0EBpYLLRGWBGkKwRFyAvANnw0TAk8LshHzCTkGTRMfBkIHJRMdCBwJ
    BA8oDpIGQwm/EMoEuAf/Dx0J8wTwCXgRXgFSB5QPcQNaBW0O2QuSA/4PrBGaA2YHbRZXAgMF
    6hVCBZQDohR9CBgCow8IDJIFBRMpC2gBzgvkENr/KQT9FJoCGQL+EaMMagK3DrIN4wN0C/oR
    WAMyBb8TBwWtAvUUXgS7BKgWvAEI/7wIKAXxA0sLlAssBNEQJgw2BAgMkQvb/8EAARSuBGgC
    FRRRBLcBIQ7/BwAD0wiwCPYD0woQDhUFTQoLE7cDdwOnE/cFqAGNEtMIagAyDFENwP9+BQwJ
    zACVB7MIvQNPBykVMQMgApgNbf+XAs0OAgHdANYIFQpiBRQMIgkEAkkKFg1PAFYEVwwxBWIF
    mA4VBPkBDg8eBj0CPQx0CRcDywzECA0A0AYqDuX7JwNADbL8QwJuCHv/ZAhPDb8DKgC0CzgD
    l/49BuYFmP9tBSALuwLyAcAKOQRYAGEMRgQ+/YoO4ARk+wULsAbM+3AJJQWv/0YJTgcBAecL
    BgMz/NkJHAZF/2cNIwPS/SwK9AHs/6UJ2ACb/aQKYQC7/qUK9wR9/YAFbghb/NQDXQrH/JcF
    LAdA/bUHuwNj/gAIPwTZ/SoKGQJl/EYFQgTf/TgGJgN1AKMJsf9f/QwJmP+U/jIJ/wGc/4AE
    ngEh/88HvgHm/VUG/wX3/F4FHwcp/RIKMgN9/IwH+wE2/eYGsASx/SoDKgbf/2UEPQSp/IYG
    1AD+/NEJMv+C/2YGif/mAOgEHP8V/mAFxwHu/UUE6wKK/gUDPgOz/8gA5wLK/1UC7wGH/nsD
    uQFZ/0cCDwGHADYAvAHc/jEDrAG4/eUD2AIJ/hcC/wHU/14BUgKO/r4BNgJg/wIBiwCw/r8C
    IgGK/isAyAK6ALP/LgCLANQA6QDZ/1YAUQBFALH/cP+dAAUBaAA1AFUA/gAFAEYA9v+//67/
    fQDpAJX/t/++/5b/rgCvAFj/pf/c/07/LADQ/4b/yf8+AOz/9f9V/+f/6/9F/7D/FQCT/9T/
    LwAz/+D/+P8BAAMAAQAYAB4AEgDx/wgA3/8JAPH/xf8xAJz/5P/j/y0Ayf/u/wYAJADz/xIA
    6P/8/yEADADs/xMA+v8FAPL/5f/+/wwA5f8XAOr/CQDP/x4A5f8WAND/9f/4//L/EQDj/wUA
    8/8GAPX/FgDY/wMA+/8FAPb/9v8AAO3/+P8aANT/GwDa/w4A8P8BAA0ACgDq/xMACQDS/xgA
    2P8UANT/BQDM/xoA5f///+f/FQDO//j/6f8ZANn/CADs/xcA3f8PAOf/FQDc/wUAy/8EAOr/
    BQDa/wsA4/8QAOH/BwAJAAQA8/8AAOz/CQDT/xIA3/8KAOv/AQDk/xMA1f8VAOX/BQDs/wYA
    7v/4//X/+P/8//j/9v8DAOn/BQDv/wEA9f8CAO7///8AAAAA+/8CAPD/AQD0////+v8DAPD/
    +v/6/wAA/P/8//r//v/6//7//v/+//v////8//3//v/+//3//f/9//7//v/+//z////+//7/
    /v/+//3//v/+//7//P////7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
    /v/+//7//v/+//7//v8=
    `.trim();
    
    const audioBuffer = Buffer.from(TEST_AUDIO_BASE64, 'base64');
    fs.writeFileSync(TEST_AUDIO_PATH, audioBuffer);
    console.log('Test audio file created:', TEST_AUDIO_PATH);
  } else {
    console.log('Test audio file already exists:', TEST_AUDIO_PATH);
  }
}

// Main test function
async function runRealHardwareTest() {
  console.log('Starting real hardware end-to-end test...');
  
  // Make sure we have the test audio file
  await ensureTestAudioExists();
  
  // Initialize the WebDriver
  let driver;
  
  try {
    // Launch browser
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().window().setRect({ width: 1200, height: 800 });
    
    // Navigate to the teacher interface
    console.log('Navigating to teacher interface...');
    const baseUrl = 'http://localhost:5000';
    await driver.get(`${baseUrl}/teacher`);
    
    // Wait for page to load fully
    await driver.sleep(3000);
    
    // Find and click the "Record" button
    console.log('Starting recording...');
    const recordButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Record")]')), 
      10000
    );
    await recordButton.click();
    
    // Give the microphone time to initialize
    await driver.sleep(2000);
    
    // Play the test audio file through system speakers
    await playAudioFile();
    
    // Give extra time for audio to be picked up and processed
    await driver.sleep(5000);
    
    // Look for the transcription element
    console.log('Checking for transcription...');
    const currentSpeechElement = await driver.wait(
      until.elementLocated(By.css('.current-speech')), 
      10000
    );
    
    // Get the transcription text
    const transcriptionText = await currentSpeechElement.getText();
    console.log('Transcription text:', transcriptionText);
    
    // Take a screenshot for evidence
    const screenshot = await driver.takeScreenshot();
    fs.writeFileSync('real-hardware-test-result.png', screenshot, 'base64');
    console.log('Screenshot saved to real-hardware-test-result.png');
    
    // Verify the transcription contains our test phrase
    if (transcriptionText.toLowerCase().includes('test')) {
      console.log('✅ TEST PASSED: Transcription contains the test message');
      console.log('Transcription:', transcriptionText);
    } else {
      console.log('❌ TEST FAILED: Transcription does not contain the test message');
      console.log('Expected to include "test"');
      console.log('Actual:', transcriptionText);
    }
    
    // Stop recording
    console.log('Stopping recording...');
    const stopButton = await driver.wait(
      until.elementLocated(By.xpath('//button[contains(text(), "Stop")]')), 
      5000
    );
    await stopButton.click();
    
    // Allow time for cleanup
    await driver.sleep(2000);
    
    console.log('Real hardware test completed!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Clean up
    if (driver) {
      await driver.quit();
    }
  }
}

// Run the test
runRealHardwareTest().catch(err => {
  console.error('Fatal error in test:', err);
});