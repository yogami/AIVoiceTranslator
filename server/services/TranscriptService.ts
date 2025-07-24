/**
 * Transcript Service
 * 
 * Business logic for transcript management
 */

import { IStorage } from '../storage.interface.js';

export interface TranscriptData {
  sessionId: string;
  language: string;
  text: string;
}

export class TranscriptService {
  constructor(private storage: IStorage) {}

  /**
   * Save a new transcript
   */
  async saveTranscript(data: TranscriptData) {
    if (data.text.trim().length === 0) {
      throw new Error('text cannot be empty');
    }

    const transcript = await this.storage.addTranscript({
      sessionId: data.sessionId,
      language: data.language,
      text: data.text.trim()
    });

    return transcript;
  }

  /**
   * Get transcripts by session and language
   */
  async getTranscriptsBySession(sessionId: string, language: string) {
    return await this.storage.getTranscriptsBySession(sessionId, language);
  }
}
