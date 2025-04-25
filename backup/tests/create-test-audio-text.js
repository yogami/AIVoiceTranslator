/**
 * This script creates a text file with a test message that we can use 
 * to simulate speech for testing purposes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_MESSAGE = "This is a test message for the Benedictaitor speech transcription system.";
const TEST_TEXT_PATH = path.join(__dirname, 'test-message.txt');

try {
  fs.writeFileSync(TEST_TEXT_PATH, TEST_MESSAGE);
  console.log(`Created test text file at ${TEST_TEXT_PATH}`);
  console.log(`Test message: "${TEST_MESSAGE}"`);
} catch (error) {
  console.error('Error creating test text file:', error);
}