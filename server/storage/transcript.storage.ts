import { type Transcript, type InsertTranscript, transcripts } from '../../shared/schema';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { StorageError, StorageErrorCode } from '../storage.error'; // Corrected import

const DEFAULT_TRANSCRIPT_QUERY_LIMIT = 100;

export interface ITranscriptStorage {
  addTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscriptsBySession(sessionId: string, language: string, limit?: number): Promise<Transcript[]>;
}

export class MemTranscriptStorage implements ITranscriptStorage {
  private transcriptsMap: Map<number, Transcript>;
  private idCounter: { value: number };

  constructor(transcriptsMap: Map<number, Transcript>, idCounter: { value: number }) {
    this.transcriptsMap = transcriptsMap;
    this.idCounter = idCounter;
    if (this.transcriptsMap.size > 0) {
      const maxId = Math.max(...Array.from(this.transcriptsMap.keys()));
      this.idCounter.value = Math.max(this.idCounter.value, maxId + 1);
    }
  }

  async addTranscript(transcript: InsertTranscript): Promise<Transcript> {
    const newTranscript: Transcript = {
      id: this.idCounter.value++,
      ...transcript,
      timestamp: new Date()
    };
    this.transcriptsMap.set(newTranscript.id, newTranscript);
    return newTranscript;
  }

  async getTranscriptsBySession(sessionId: string, language: string, limit: number = DEFAULT_TRANSCRIPT_QUERY_LIMIT): Promise<Transcript[]> {
    const allMatchingTranscripts: Transcript[] = [];
    for (const transcript of this.transcriptsMap.values()) {
      if (transcript.sessionId === sessionId && transcript.language === language) {
        allMatchingTranscripts.push(transcript);
      }
    }
    // Sort all matching transcripts first
    const sortedTranscripts = allMatchingTranscripts.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime; // Descending order
    });

    // Then apply the limit
    return sortedTranscripts.slice(0, limit);
  }
}

export class DbTranscriptStorage implements ITranscriptStorage {
  async addTranscript(transcript: InsertTranscript): Promise<Transcript> {
    try {
      const result = await db.insert(transcripts).values(transcript).returning();
      if (!result || result.length === 0) {
        throw new StorageError('Failed to create transcript in DB, no data returned.', StorageErrorCode.CREATE_FAILED);
      }
      return result[0];
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      // Log the original error for debugging if necessary
      // console.error("DB error during addTranscript:", error);
      throw new StorageError('A database error occurred while adding the transcript.', StorageErrorCode.STORAGE_ERROR, error instanceof Error ? error.message : undefined);
    }
  }

  async getTranscriptsBySession(sessionId: string, language: string, limit: number = DEFAULT_TRANSCRIPT_QUERY_LIMIT): Promise<Transcript[]> {
    try {
      return await db.select()
        .from(transcripts)
        .where(and(
          eq(transcripts.sessionId, sessionId),
          eq(transcripts.language, language)
        ))
        .orderBy(desc(transcripts.timestamp))
        .limit(limit);
    } catch (error) {
      // Log the original error for debugging if necessary
      // console.error("DB error during getTranscriptsBySession:", error);
      throw new StorageError('A database error occurred while retrieving transcripts.', StorageErrorCode.STORAGE_ERROR, error instanceof Error ? error.message : undefined);
    }
  }
}