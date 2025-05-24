import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisify file system operations
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Constants for configuration
const TEMP_DIR = '/home/runner/workspace';

/**
 * Audio file handler for temporary file operations
 * Following Single Responsibility Principle
 */
export class AudioFileHandler {
  private readonly tempDir: string;

  constructor(tempDir: string = TEMP_DIR) {
    this.tempDir = tempDir;
  }

  /**
   * Create a temporary file from an audio buffer
   */
  async createTempFile(audioBuffer: Buffer): Promise<string> {
    const filePath = path.join(this.tempDir, `temp-audio-${Date.now()}.wav`);

    try {
      await writeFile(filePath, audioBuffer);
      console.log(`Saved audio buffer to temporary file: ${filePath}`);

      const fileStats = await stat(filePath);
      console.log(`Audio file size: ${fileStats.size} bytes, created: ${fileStats.mtime}`);
      console.log(`Audio duration estimate: ~${Math.round(fileStats.size / 16000 / 2)} seconds`);

      return filePath;
    } catch (error) {
      console.error('Error creating temporary audio file:', error);
      throw new Error('Failed to create temporary audio file');
    }
  }

  /**
   * Delete a temporary file
   */
  async deleteTempFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (error) {
      console.error('Error cleaning up temporary file:', error);
      // Don't throw here - cleaning up is a best effort
    }
  }
}