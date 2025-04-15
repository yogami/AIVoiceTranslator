/**
 * This script generates a larger test audio file by repeating the content 
 * of our existing test audio file several times.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_AUDIO_PATH = path.join(__dirname, 'test-message.wav');
const NEW_AUDIO_PATH = path.join(__dirname, 'test-message-larger.wav');

// Function to read the WAV header (first 44 bytes)
function readWavHeader(buffer) {
  return buffer.slice(0, 44);
}

// Function to read the WAV data (everything after the header)
function readWavData(buffer) {
  return buffer.slice(44);
}

// Function to get WAV file size from header
function getWavFileSize(header) {
  // File size minus 8 bytes is stored at bytes 4-7 (little-endian)
  return header.readUInt32LE(4) + 8;
}

// Function to get WAV data size from header
function getWavDataSize(header) {
  // Data size is stored at bytes 40-43 (little-endian)
  return header.readUInt32LE(40);
}

// Function to update WAV header with new data size
function updateWavHeader(header, newDataSize) {
  const newHeader = Buffer.from(header);
  // Update file size (bytes 4-7)
  newHeader.writeUInt32LE(newDataSize + 36, 4);
  // Update data size (bytes 40-43)
  newHeader.writeUInt32LE(newDataSize, 40);
  return newHeader;
}

// Main function to create a larger WAV file
async function createLargerWavFile(repetitions = 10) {
  try {
    console.log(`Reading original WAV file: ${ORIGINAL_AUDIO_PATH}`);
    if (!fs.existsSync(ORIGINAL_AUDIO_PATH)) {
      console.error('Original WAV file not found!');
      return;
    }
    
    const originalBuffer = fs.readFileSync(ORIGINAL_AUDIO_PATH);
    const originalHeader = readWavHeader(originalBuffer);
    const originalData = readWavData(originalBuffer);
    
    const originalDataSize = getWavDataSize(originalHeader);
    console.log(`Original file size: ${originalBuffer.length} bytes`);
    console.log(`Original data size: ${originalDataSize} bytes`);
    
    // Create new data by repeating the original data
    const newDataBuffers = [];
    for (let i = 0; i < repetitions; i++) {
      newDataBuffers.push(originalData);
    }
    
    const newData = Buffer.concat(newDataBuffers);
    const newDataSize = newData.length;
    
    // Update header with new data size
    const newHeader = updateWavHeader(originalHeader, newDataSize);
    
    // Combine new header with new data
    const newWavFile = Buffer.concat([newHeader, newData]);
    
    // Write new WAV file
    fs.writeFileSync(NEW_AUDIO_PATH, newWavFile);
    
    console.log(`Created larger WAV file: ${NEW_AUDIO_PATH}`);
    console.log(`New file size: ${newWavFile.length} bytes`);
    console.log(`New data size: ${newDataSize} bytes`);
    console.log(`Original file repeated ${repetitions} times`);
    
    // Read file as base64 for test usage
    const base64Audio = newWavFile.toString('base64');
    console.log(`Base64 encoded size: ${base64Audio.length} characters`);
    
    return {
      filePath: NEW_AUDIO_PATH,
      fileSize: newWavFile.length,
      base64Size: base64Audio.length
    };
  } catch (error) {
    console.error('Error creating larger WAV file:', error);
  }
}

// Run with 10 repetitions to create a file approximately 10x larger
createLargerWavFile(10)
  .then(result => {
    if (result) {
      console.log('Success!');
    } else {
      console.log('Failed to create larger WAV file');
    }
  })
  .catch(err => {
    console.error('Fatal error:', err);
  });