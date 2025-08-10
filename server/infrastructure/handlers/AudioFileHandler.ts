/**
 * Audio File Handler Service
 * 
 * Manages temporary audio file operations with proper error handling
 * and resource cleanup.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import * as os from 'os';

// Promisify file system operations
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const mkdir = fs.mkdir ? promisify(fs.mkdir) : undefined;

// Constants
const DEFAULT_TEMP_DIR = os.tmpdir();
const AUDIO_FILE_PREFIX = 'temp-audio-';
const AUDIO_FILE_EXTENSION = '.wav';

/**
 * Custom error class for audio file operations
 */
export class AudioFileError extends Error {
  constructor(
    message: string,
    public readonly code: 'CREATE_FAILED' | 'DELETE_FAILED' | 'INVALID_BUFFER',
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AudioFileError';
  }
}

/**
 * Options for audio file creation
 */
interface CreateTempFileOptions {
  prefix?: string;
  extension?: string;
  preserveTimestamp?: boolean;
  mimeTypeHint?: string; // e.g., 'audio/webm', 'audio/ogg', 'audio/wav'
}

/**
 * Audio file handler for temporary file operations
 * Following Single Responsibility Principle
 */
export class AudioFileHandler {
  private readonly tempDir: string;
  private readonly enableLogging: boolean;

  constructor(tempDir: string = DEFAULT_TEMP_DIR, enableLogging: boolean = true) {
    this.tempDir = tempDir;
    this.enableLogging = enableLogging;
  }

  /**
   * Ensures the temporary directory exists
   */
  private async ensureTempDirectoryExists(): Promise<void> {
    // Skip directory creation if mkdir is not available (e.g., in tests)
    if (!mkdir) {
      return;
    }
    
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if ((error as any).code !== 'EEXIST') {
        throw new AudioFileError(
          `Failed to create temp directory: ${this.tempDir}`,
          'CREATE_FAILED',
          error
        );
      }
    }
  }

  /**
   * Validates audio buffer
   */
  private validateAudioBuffer(buffer: Buffer): void {
    if (!Buffer.isBuffer(buffer)) {
      throw new AudioFileError(
        'Invalid audio buffer: expected Buffer instance',
        'INVALID_BUFFER'
      );
    }

    if (buffer.length === 0) {
      throw new AudioFileError(
        'Invalid audio buffer: buffer is empty',
        'INVALID_BUFFER'
      );
    }
  }

  /**
   * Generates a unique filename
   */
  private generateFilename(options: CreateTempFileOptions = {}): string {
    const prefix = options.prefix || AUDIO_FILE_PREFIX;
    let extension = options.extension || AUDIO_FILE_EXTENSION;
    // Pick extension based on mimeTypeHint if provided
    if (!options.extension && options.mimeTypeHint) {
      const mt = options.mimeTypeHint.toLowerCase();
      if (mt.includes('webm')) extension = '.webm';
      else if (mt.includes('ogg')) extension = '.ogg';
      else if (mt.includes('wav') || mt.includes('pcm')) extension = '.wav';
      else if (mt.includes('mp3') || mt.includes('mpeg')) extension = '.mp3';
    }
    const timestamp = options.preserveTimestamp ? Date.now() : Date.now() + Math.random();
    
    return `${prefix}${timestamp}${extension}`;
  }

  /**
   * Logs a message if logging is enabled
   */
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.enableLogging) {
      if (level === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Create a temporary file from an audio buffer
   */
  async createTempFile(
    audioBuffer: Buffer,
    options: CreateTempFileOptions = {}
  ): Promise<string> {
    // Validate input
    this.validateAudioBuffer(audioBuffer);

    // Ensure directory exists before creating file
    await this.ensureTempDirectoryExists();

    const filename = this.generateFilename(options);
    const filePath = path.join(this.tempDir, filename);

    try {
      await writeFile(filePath, audioBuffer);
      this.log(`Saved audio buffer to temporary file: ${filePath}`);

      if (this.enableLogging) {
        const fileStats = await stat(filePath);
        this.log(`Audio file size: ${fileStats.size} bytes, created: ${fileStats.mtime}`);
        
        // Estimate duration (assuming 16kHz, 16-bit mono audio)
        const estimatedDuration = Math.round(fileStats.size / 16000 / 2);
        this.log(`Audio duration estimate: ~${estimatedDuration} seconds`);
      }

      return filePath;
    } catch (error) {
      const errorMessage = `Failed to create temporary audio file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      
      this.log(errorMessage, 'error');
      
      throw new AudioFileError(
        errorMessage,
        'CREATE_FAILED',
        error
      );
    }
  }

  /**
   * Delete a temporary file
   */
  async deleteTempFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      this.log(`Deleted temporary file: ${filePath}`);
    } catch (error) {
      const errorMessage = `Error cleaning up temporary file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      
      this.log(errorMessage, 'error');
      
      // Don't throw here - cleaning up is a best effort
      // But we could optionally throw based on a parameter
    }
  }

  /**
   * Delete multiple temporary files
   */
  async deleteTempFiles(filePaths: string[]): Promise<void> {
    await Promise.all(
      filePaths.map(filePath => this.deleteTempFile(filePath))
    );
  }

  /**
   * Get the configured temporary directory
   */
  getTempDir(): string {
    return this.tempDir;
  }
}