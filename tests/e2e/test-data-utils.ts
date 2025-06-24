import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env.test to ensure we're using the test database
const envTestPath = path.resolve(process.cwd(), '.env.test');
dotenv.config({ path: envTestPath, override: true });

import { db } from '../../server/db';
import { sessions, translations, transcripts, type InsertSession, type InsertTranslation, users } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Clears session, translation, and transcript data from the test database, and resets sequences.
 */
export async function clearDiagnosticData() {
  // Delete in order: transcripts -> translations -> sessions
  await db.delete(transcripts).execute();
  await db.delete(translations).execute();
  await db.delete(sessions).execute();
  // Reset sequences for predictable IDs (ignore if sequence doesn't exist)
  try { await db.execute(sql`ALTER SEQUENCE sessions_id_seq RESTART WITH 1;`); } catch {}
  try { await db.execute(sql`ALTER SEQUENCE translations_id_seq RESTART WITH 1;`); } catch {}
  try { await db.execute(sql`ALTER SEQUENCE transcripts_id_seq RESTART WITH 1;`); } catch {}
}

/**
 * Seeds session data into the test database.
 * @param sessionData An array of session objects to insert.
 * @returns The inserted session records.
 */
export async function seedSessions(sessionData: InsertSession[]) {
  if (sessionData.length === 0) return [];
  
  try {
    const result = await db.insert(sessions).values(sessionData).returning();
    return result;
  } catch (error) {
    console.error('Error seeding sessions:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Seeds translation data into the test database.
 * @param translationData An array of translation objects to insert.
 * @returns The inserted translation records.
 */
export async function seedTranslations(translationData: InsertTranslation[]) {
  if (translationData.length === 0) return [];
  
  try {
    const result = await db.insert(translations).values(translationData).returning();
    return result;
  } catch (error) {
    console.error('Error seeding translations:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Helper function to create a Date object relative to the current time.
 * @param daysOffset Number of days to offset from today (negative for past, positive for future).
 * @param hoursOffset Number of hours to offset from the current hour.
 * @returns A Date object.
 */
export function getDateRelativeToNow(daysOffset: number, hoursOffset: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(date.getHours() + hoursOffset);
  return date;
}

/**
 * Seeds a realistic set of test data for the diagnostics page.
 * This includes sessions and translations across different time ranges.
 * Assumes that user IDs 1 and 2 exist in the 'users' table.
 */
export async function seedRealisticTestData() {
  await clearDiagnosticData();

  // Create timestamps for sessions to ensure they're within query ranges
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const sessionsToSeed: InsertSession[] = [
    // Recent sessions (within last 7 days) with explicit timestamps
    { sessionId: 'e2e-session-1', isActive: false, teacherLanguage: 'en', startTime: twoDaysAgo, endTime: new Date(twoDaysAgo.getTime() + 60 * 60 * 1000) },
    { sessionId: 'e2e-session-2', isActive: false, teacherLanguage: 'es', startTime: threeDaysAgo, endTime: new Date(threeDaysAgo.getTime() + 90 * 60 * 1000) },
    { sessionId: 'e2e-session-3', isActive: true, teacherLanguage: 'de', startTime: oneHourAgo },
    // Older sessions (between 8 and 30 days ago)
    { sessionId: 'e2e-session-4', isActive: false, teacherLanguage: 'fr', startTime: tenDaysAgo, endTime: new Date(tenDaysAgo.getTime() + 45 * 60 * 1000) },
    { sessionId: 'e2e-session-5', isActive: false, teacherLanguage: 'en', startTime: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), endTime: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000) },
  ];
  
  const seededSessions = await seedSessions(sessionsToSeed);
  
  // Use seeded session IDs or fallback to predefined ones
  const sessionIdsToUse = seededSessions.length > 0 && seededSessions[0].sessionId
    ? seededSessions.map((s: any) => s.sessionId)
    : sessionsToSeed.map(s => s.sessionId);

  // Create timestamps that are within the last 24 hours for reliable E2E tests
  const translationOneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const translationTwoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const translationThreeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const translationsToSeed: InsertTranslation[] = [
    { sessionId: sessionIdsToUse[0], sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hello', translatedText: 'Hola', latency: 100, timestamp: translationOneHourAgo },
    { sessionId: sessionIdsToUse[0], sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'World', translatedText: 'Monde', latency: 150, timestamp: translationOneHourAgo },
    { sessionId: sessionIdsToUse[1], sourceLanguage: 'es', targetLanguage: 'en', originalText: 'Hola', translatedText: 'Hello', latency: 120, timestamp: translationTwoHoursAgo },
    { sessionId: sessionIdsToUse[2], sourceLanguage: 'de', targetLanguage: 'en', originalText: 'Guten Tag', translatedText: 'Good day', latency: 200, timestamp: translationTwoHoursAgo },
    { sessionId: sessionIdsToUse[3], sourceLanguage: 'en', targetLanguage: 'de', originalText: 'Test', translatedText: 'Test', latency: 80, timestamp: translationThreeHoursAgo },
    { sessionId: sessionIdsToUse[4], sourceLanguage: 'fr', targetLanguage: 'en', originalText: 'Bonjour', translatedText: 'Hello', latency: 180, timestamp: translationThreeHoursAgo },
  ];
  
  // Filter out any translations where sessionId might be undefined
  const validTranslationsToSeed = translationsToSeed.filter(t => t.sessionId !== undefined);
  await seedTranslations(validTranslationsToSeed);
}
