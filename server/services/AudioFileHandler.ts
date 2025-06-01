import fs from 'fs';
import path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink); // Keep unlink here if OpenAITranscriptionService also needs it directly
const stat = promisify(fs.stat);

const TEMP_DIR = os.tmpdir();

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
      // Logs removed in previous step
      
      // const fileStats = await stat(filePath); // stat is available
      // Logs removed in previous step
      
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
      await unlink(filePath); // unlink is available
      // Logs removed in previous step
    } catch (error) {
      console.error('Error cleaning up temporary file:', error);
      // Don't throw here - cleaning up is a best effort
    }
  }
} 