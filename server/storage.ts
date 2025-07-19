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
} from '../shared/schema'; // Corrected path
import { db } from './db'; // Corrected path
import { config } from './config'; // Corrected path, import config directly

// Import sub-storage interfaces
import { IUserStorage } from './storage/user.storage';
import { ILanguageStorage } from './storage/language.storage';
import { ITranslationStorage } from './storage/translation.storage';
import { ITranscriptStorage } from './storage/transcript.storage';
import { ISessionStorage } from './storage/session.storage';
import { StorageError } from './storage.error'; // Updated import
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
