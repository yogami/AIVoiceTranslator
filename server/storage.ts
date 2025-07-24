/**
 * Storage Service
 * 
 * Provides an abstraction layer for data persistence with both
 * in-memory and database implementations.
 */

import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type User, type InsertUser, // eslint-disable-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Language, type InsertLanguage, // eslint-disable-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Translation, type InsertTranslation, // eslint-disable-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Transcript, type InsertTranscript, // eslint-disable-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type Session, type InsertSession, // eslint-disable-line @typescript-eslint/no-unused-vars
} from '../shared/schema'; // Corrected path
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db } from './db'; // Corrected path
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { config } from './config'; // Corrected path, import config directly

// Import sub-storage interfaces
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IUserStorage } from './storage/user.storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ILanguageStorage } from './storage/language.storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ITranslationStorage } from './storage/translation.storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ITranscriptStorage } from './storage/transcript.storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ISessionStorage } from './storage/session.storage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { StorageError } from './storage.error'; // Updated import
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { IStorage } from './storage.interface'; // Added IStorage import

// Import main storage implementations
import { DatabaseStorage } from './database-storage';

// Export storage instance - always use database storage
export const storage = (() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }
  // Using DatabaseStorage
  return new DatabaseStorage();
})();
