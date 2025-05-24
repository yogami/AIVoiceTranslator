import { describe, it, expect } from 'vitest';
import { AudioFileHandler } from '../../../server/services/handlers/AudioFileHandler';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createMockAudioBuffer, setupFileSystemTestEnvironment } from '../utils/test-helpers';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

describe('AudioFileHandler', () => {
  const tempDir = path.join(__dirname, 'temp');
  const audioFileHandler = new AudioFileHandler(tempDir);

  // Use the setupFileSystemTestEnvironment helper
  setupFileSystemTestEnvironment(tempDir);

  it('should create a temporary file from an audio buffer', async () => {
    const audioBuffer = createMockAudioBuffer(100);
    const filePath = await audioFileHandler.createTempFile(audioBuffer);

    expect(fs.existsSync(filePath)).toBe(true);

    const fileStats = await stat(filePath);
    expect(fileStats.size).toBe(audioBuffer.length);

    // Clean up
    await unlink(filePath);
  });

  it('should delete a temporary file', async () => {
    const audioBuffer = createMockAudioBuffer(100);
    const filePath = path.join(tempDir, 'temp-audio-test.wav');

    await writeFile(filePath, audioBuffer);
    expect(fs.existsSync(filePath)).toBe(true);

    await audioFileHandler.deleteTempFile(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });
  
  it('should handle errors when creating temporary files', async () => {
    // Create a handler with an invalid directory to cause an error
    const invalidHandler = new AudioFileHandler('/invalid/directory');
    const audioBuffer = createMockAudioBuffer(100);
    
    await expect(invalidHandler.createTempFile(audioBuffer))
      .rejects.toThrow();
  });
  
  it('should handle errors gracefully when deleting non-existent files', async () => {
    // Attempt to delete a file that doesn't exist
    const nonExistentPath = path.join(tempDir, 'non-existent-file.wav');
    
    // Should not throw an error
    await expect(audioFileHandler.deleteTempFile(nonExistentPath))
      .resolves.not.toThrow();
  });
});