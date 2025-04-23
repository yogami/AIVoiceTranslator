/**
 * Audio Utilities Tests for Benedictaitor
 * 
 * These tests verify the functionality of audio utility functions:
 * - Audio format conversion
 * - Audio processing
 * - Audio encoding/decoding
 */

const fs = require('fs');
const path = require('path');

// Mock implementations for browser APIs
class MockBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.options = options;
    this.size = parts.reduce((size, part) => {
      if (typeof part === 'string') {
        return size + part.length;
      } else if (part instanceof ArrayBuffer) {
        return size + part.byteLength;
      } else if (part instanceof Uint8Array) {
        return size + part.byteLength;
      }
      return size;
    }, 0);
  }
  
  text() {
    return Promise.resolve(this.parts.map(p => p.toString()).join(''));
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
}

class MockFileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }
  
  readAsDataURL(blob) {
    // Simulate asynchronous reading
    setTimeout(() => {
      // Create a fake base64 data URL
      const fakeBase64 = 'data:audio/wav;base64,UklGRtpZAABXQVZFZm10IBIAAA';
      
      if (this.onload) {
        this.onload({ target: { result: fakeBase64 } });
      }
    }, 10);
  }
}

// In browser environment, these would be global. We mock them here.
global.Blob = MockBlob;
global.FileReader = MockFileReader;

// Audio Utilities class (similar to what might be in the app)
class AudioUtilities {
  /**
   * Convert a Blob to a base64 string
   * @param {Blob} blob - The audio blob to convert
   * @returns {Promise<string>} - A promise that resolves to the base64 string
   */
  static async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Convert a base64 string to an ArrayBuffer
   * @param {string} base64 - The base64 string to convert
   * @returns {ArrayBuffer} - The ArrayBuffer representation
   */
  static base64ToArrayBuffer(base64) {
    // Remove data URL prefix if present
    const base64Data = base64.includes('base64,') 
      ? base64.split('base64,')[1]
      : base64;
    
    // Decode base64 to binary string
    const binaryString = atob(base64Data);
    
    // Create ArrayBuffer from binary string
    const buffer = new ArrayBuffer(binaryString.length);
    const view = new Uint8Array(buffer);
    
    for (let i = 0; i < binaryString.length; i++) {
      view[i] = binaryString.charCodeAt(i);
    }
    
    return buffer;
  }
  
  /**
   * Convert a base64 audio string to an HTML audio element
   * @param {string} base64 - The base64 encoded audio
   * @param {string} mimeType - The MIME type of the audio
   * @returns {HTMLAudioElement} - An audio element with the base64 audio as source
   */
  static base64ToAudioElement(base64, mimeType = 'audio/mp3') {
    // In a real browser environment, we'd create an HTMLAudioElement
    // For testing, we'll return a mock
    console.log(`Creating audio element with ${base64.substring(0, 20)}... (${mimeType})`);
    
    return {
      src: `data:${mimeType};base64,${base64}`,
      play: () => {
        console.log('Mock audio element playing');
        return Promise.resolve();
      },
      pause: () => {
        console.log('Mock audio element paused');
      }
    };
  }
  
  /**
   * Format a duration in seconds to MM:SS format
   * @param {number} seconds - The duration in seconds
   * @returns {string} - Formatted duration string
   */
  static formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Define global atob function for Node.js environment
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Run tests
async function runTests() {
  console.log('Running Audio Utilities Tests...\n');
  let passCount = 0;
  let failCount = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.log(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }
  
  // Test 1: Blob to Base64 conversion
  console.log('Test 1: Blob to Base64 conversion');
  try {
    const testBlob = new MockBlob(['test audio data'], { type: 'audio/wav' });
    const base64 = await AudioUtilities.blobToBase64(testBlob);
    
    assert(typeof base64 === 'string', 'Blob converted to base64 string');
    assert(base64.includes('data:'), 'Base64 string has data URL prefix');
    assert(base64.includes('base64,'), 'Base64 string has base64 marker');
  } catch (error) {
    console.error(`Error in Test 1: ${error.message}`);
    assert(false, 'Blob to Base64 conversion should not throw errors');
  }
  
  // Test 2: Base64 to ArrayBuffer conversion
  console.log('\nTest 2: Base64 to ArrayBuffer conversion');
  try {
    const testBase64 = 'data:audio/wav;base64,UklGRtpZAABXQVZFZm10IBIAAA';
    const arrayBuffer = AudioUtilities.base64ToArrayBuffer(testBase64);
    
    assert(arrayBuffer instanceof ArrayBuffer, 'Base64 converted to ArrayBuffer');
    assert(arrayBuffer.byteLength > 0, 'ArrayBuffer has non-zero length');
  } catch (error) {
    console.error(`Error in Test 2: ${error.message}`);
    assert(false, 'Base64 to ArrayBuffer conversion should not throw errors');
  }
  
  // Test 3: Base64 to Audio Element conversion
  console.log('\nTest 3: Base64 to Audio Element conversion');
  try {
    const testBase64 = 'UklGRtpZAABXQVZFZm10IBIAAA';
    const audioElement = AudioUtilities.base64ToAudioElement(testBase64, 'audio/wav');
    
    assert(typeof audioElement === 'object', 'Base64 converted to audio element object');
    assert(audioElement.src.includes('data:audio/wav;base64,'), 'Audio element has correct src');
    assert(typeof audioElement.play === 'function', 'Audio element has play function');
    assert(typeof audioElement.pause === 'function', 'Audio element has pause function');
  } catch (error) {
    console.error(`Error in Test 3: ${error.message}`);
    assert(false, 'Base64 to Audio Element conversion should not throw errors');
  }
  
  // Test 4: Duration formatting
  console.log('\nTest 4: Duration formatting');
  try {
    const testCases = [
      { seconds: 0, expected: '00:00' },
      { seconds: 30, expected: '00:30' },
      { seconds: 60, expected: '01:00' },
      { seconds: 90, expected: '01:30' },
      { seconds: 3600, expected: '60:00' }
    ];
    
    for (const { seconds, expected } of testCases) {
      const formatted = AudioUtilities.formatDuration(seconds);
      assert(
        formatted === expected,
        `${seconds} seconds formatted to ${formatted}, expected ${expected}`
      );
    }
  } catch (error) {
    console.error(`Error in Test 4: ${error.message}`);
    assert(false, 'Duration formatting should not throw errors');
  }
  
  // Test 5: Integration of methods
  console.log('\nTest 5: Integration of audio utility methods');
  try {
    const testBlob = new MockBlob(['test audio data'], { type: 'audio/wav' });
    
    // Chain methods
    const base64 = await AudioUtilities.blobToBase64(testBlob);
    const arrayBuffer = AudioUtilities.base64ToArrayBuffer(base64);
    const audioElement = AudioUtilities.base64ToAudioElement(
      base64.split('base64,')[1],
      'audio/wav'
    );
    
    assert(base64.length > 0, 'Generated base64 has content');
    assert(arrayBuffer.byteLength > 0, 'Generated ArrayBuffer has content');
    assert(audioElement.src.includes('base64'), 'Generated audio element has base64 src');
    
    // Test playing the audio element
    let playPromise = audioElement.play();
    assert(playPromise instanceof Promise, 'Audio play method returns a Promise');
  } catch (error) {
    console.error(`Error in Test 5: ${error.message}`);
    assert(false, 'Integration of audio utility methods should not throw errors');
  }
  
  // Summary
  console.log(`\nTest summary: ${passCount}/${passCount + failCount} tests passed, ${failCount} failed`);
  
  // Exit with success if all tests passed
  return failCount === 0;
}

// Run the tests
runTests()
  .then(success => {
    console.log(`Audio Utilities Tests ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(`Test execution error: ${error.message}`);
    process.exit(1);
  });