// Simple tests for audio utility functions
console.log('Running simple audio utility tests...');

// Mock Blob and FileReader for Node.js environment
class MockBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.options = options;
    this.size = parts.reduce((size, part) => size + part.length, 0);
    this.type = options.type || '';
  }
  
  text() {
    return Promise.resolve(this.parts.join(''));
  }
  
  arrayBuffer() {
    const text = this.parts.join('');
    const buffer = new ArrayBuffer(text.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i);
    }
    return Promise.resolve(buffer);
  }
}

// Mock FileReader
class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
  }
  
  readAsDataURL(blob) {
    // Simulate async behavior
    setTimeout(() => {
      // Create a fake base64 data URL
      const fakeBase64 = Buffer.from(blob.parts.join('')).toString('base64');
      this.result = `data:${blob.type};base64,${fakeBase64}`;
      if (this.onload) this.onload({ target: this });
    }, 10);
  }
}

// Add globals
globalThis.Blob = MockBlob;
globalThis.FileReader = MockFileReader;

// Audio utilities to test
class AudioUtilities {
  static async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  static base64ToArrayBuffer(base64) {
    const binaryString = globalThis.atob?.(base64) || 
      Buffer.from(base64, 'base64').toString('binary'); // Node.js fallback
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }
  
  static base64ToAudioElement(base64, mimeType = 'audio/mp3') {
    const mockAudio = { 
      src: `data:${mimeType};base64,${base64}`,
      play: () => console.log('Audio would play now'),
      pause: () => console.log('Audio would pause now'),
      mimeType 
    };
    return mockAudio;
  }
  
  static formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Tests
async function runTests() {
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
  
  try {
    console.log('\nTest 1: blobToBase64');
    const testData = 'Hello, audio world!';
    const blob = new MockBlob([testData], { type: 'audio/wav' });
    
    const base64 = await AudioUtilities.blobToBase64(blob);
    assert(
      base64.startsWith('data:audio/wav;base64,'),
      'Base64 data URL should have the correct prefix'
    );
    
    assert(
      base64.includes(Buffer.from(testData).toString('base64')),
      'Base64 data URL should contain the encoded content'
    );
    
    console.log('\nTest 2: base64ToArrayBuffer');
    const testBase64 = 'SGVsbG8sIGF1ZGlvIHdvcmxkIQ=='; // "Hello, audio world!"
    const arrayBuffer = AudioUtilities.base64ToArrayBuffer(testBase64);
    
    assert(
      arrayBuffer instanceof ArrayBuffer,
      'Should return an ArrayBuffer'
    );
    
    const decodedText = new TextDecoder().decode(new Uint8Array(arrayBuffer));
    assert(
      decodedText === 'Hello, audio world!',
      'ArrayBuffer should contain the correct decoded content'
    );
    
    console.log('\nTest 3: base64ToAudioElement');
    const audioElement = AudioUtilities.base64ToAudioElement(testBase64, 'audio/wav');
    
    assert(
      audioElement.src.startsWith('data:audio/wav;base64,'),
      'Audio element should have the correct data URL with mime type'
    );
    
    assert(
      audioElement.src.includes(testBase64),
      'Audio element src should contain the base64 data'
    );
    
    console.log('\nTest 4: formatDuration');
    assert(
      AudioUtilities.formatDuration(0) === '0:00',
      'Zero seconds should format to 0:00'
    );
    
    assert(
      AudioUtilities.formatDuration(61) === '1:01',
      '61 seconds should format to 1:01'
    );
    
    assert(
      AudioUtilities.formatDuration(3600) === '60:00',
      '3600 seconds should format to 60:00'
    );
    
    // Final results
    console.log(`\nTest summary: ${passCount}/${passCount + failCount} tests passed, ${failCount} failed`);
    
    if (failCount > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();