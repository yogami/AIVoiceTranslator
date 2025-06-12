/**
 * Storage Service
 * 
 * Provides an abstraction layer for data persistence with both
 * in-memory and database implementations.
 */

import {
  type User, type InsertUser,
  type Language, type InsertLanguage,
  type Translation, type InsertTranslation,
  type Transcript, type InsertTranscript,
  type Session, type InsertSession,
} from "../shared/schema"; // Corrected path
import { db } from "./db"; // Corrected path
import { config } from "./config"; // Corrected path, import config directly

// Import sub-storage interfaces
import { IUserStorage } from "./storage/user.storage";
import { ILanguageStorage } from "./storage/language.storage";
import { ITranslationStorage } from "./storage/translation.storage";
import { ITranscriptStorage } from "./storage/transcript.storage";
import { ISessionStorage } from "./storage/session.storage";
import { StorageError } from "./storage.error"; // Updated import
import { IStorage } from "./storage.interface"; // Added IStorage import

// Import main storage implementations
import { MemStorage } from "./mem-storage";
import { DatabaseStorage } from "./database-storage";

// Constants (some might be moved to respective storage files if only used there)
// const DEFAULT_QUERY_LIMIT = 10; // Now in specific storage files as needed

// Export storage instance - use configuration to determine which storage to use
export const storage = (() => {
  const storageType = config.storage.type; // Use config.storage.type
  
  if (storageType === 'database') {
    if (!process.env.DATABASE_URL) { // This check is now also in config.ts, but good for safety here too
      throw new Error('DATABASE_URL must be set when storage type is database');
    }
    console.log('[Storage] Using DatabaseStorage');
    return new DatabaseStorage();
  } else {
    console.log('[Storage] Using MemStorage');
    return new MemStorage();
  }
})();
