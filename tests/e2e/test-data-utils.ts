import { db } from '../../server/db';
import { sessions, translations, type InsertSession, type InsertTranslation, users } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Clears session and translation data from the test database.
 */
export async function clearDiagnosticData() {
  // Note: User data is not cleared here. Assumes users required by tests exist.
  await db.delete(translations).execute();
  await db.delete(sessions).execute();
  // If your DB uses sequences and tests depend on specific IDs, you might need to reset them:
  // await db.execute(sql`ALTER SEQUENCE sessions_id_seq RESTART WITH 1;`);
  // await db.execute(sql`ALTER SEQUENCE translations_id_seq RESTART WITH 1;`);
  console.log('Cleared diagnostic data (sessions, translations).');
}

/**
 * Seeds session data into the test database.
 * @param sessionData An array of session objects to insert.
 * @returns The inserted session records.
 */
export async function seedSessions(sessionData: InsertSession[]) {
  if (sessionData.length === 0) return [];
  return db.insert(sessions).values(sessionData).returning();
}

/**
 * Seeds translation data into the test database.
 * @param translationData An array of translation objects to insert.
 * @returns The inserted translation records.
 */
export async function seedTranslations(translationData: InsertTranslation[]) {
  if (translationData.length === 0) return [];
  return db.insert(translations).values(translationData).returning();
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

  // Ensure prerequisite users exist or handle their creation.
  // For this example, we assume user IDs 1 and 2 are available.
  // You might want to add a user seeding step if necessary:
  // await db.insert(users).values([{ id: 1, username: 'testuser1', email: 'user1@example.com', role: 'teacher' }, { id: 2, username: 'testuser2', email: 'user2@example.com', role: 'teacher' }]).onConflictDoNothing();


  const sessionsToSeed: InsertSession[] = [
    // Recent sessions (within last 7 days)
    // Corrected: InsertSession in schema.ts does not directly take userId, ipAddress, userAgent, startTime, endTime.
    // These are part of the main 'sessions' table but not all are in 'InsertSession' Zod schema.
    // For seeding, we need to align with what `db.insert(sessions).values()` expects, which is based on the table definition.
    // The Drizzle `sessions` table itself does not have a `userId` column. It has `sessionId`, `teacherLanguage`, etc.
    // Assuming `userId` was intended to be linked via a separate mechanism or is a conceptual link not directly in this table schema for insertion.
    // For now, I will remove `userId`, `ipAddress`, `userAgent` as they are not in `InsertSession` or the `sessions` table schema directly for insertion via the Zod schema.
    // startTime and endTime are part of the main table, but `InsertSession` from Zod might be more restrictive.
    // Let's assume for seeding we can provide them if the table columns allow it (which they do).
    { sessionId: 'e2e-session-1', startTime: getDateRelativeToNow(-1), endTime: getDateRelativeToNow(-1, 2), isActive: false, teacherLanguage: 'en' }, // Ended yesterday
    { sessionId: 'e2e-session-2', startTime: getDateRelativeToNow(-3), endTime: getDateRelativeToNow(-3, 1), isActive: false, teacherLanguage: 'es' }, // Ended 3 days ago
    { sessionId: 'e2e-session-3', startTime: getDateRelativeToNow(0, -1), isActive: true, teacherLanguage: 'de' }, // Active, started 1 hour ago

    // Older sessions (between 8 and 30 days ago)
    { sessionId: 'e2e-session-4', startTime: getDateRelativeToNow(-10), endTime: getDateRelativeToNow(-10, 2), isActive: false, teacherLanguage: 'fr' },
    { sessionId: 'e2e-session-5', startTime: getDateRelativeToNow(-25), endTime: getDateRelativeToNow(-25, 1), isActive: false, teacherLanguage: 'en' },
  ];
  const seededSessions = await seedSessions(sessionsToSeed);
  
  // Ensure seededSessions returned IDs. If not, the DB driver might not support `returning()` or it's configured differently.
  if (!seededSessions || seededSessions.length === 0 || !seededSessions[0].id) {
    console.error("Failed to seed sessions or retrieve their IDs. Translations might not be linked correctly.");
    // Fallback or re-fetch if necessary, though ideally `returning()` works.
    // For now, we'll proceed, but this is a critical point for data integrity.
  }


  const translationsToSeed: InsertTranslation[] = [
    // Translations in recent sessions (last 7 days) - ensure session IDs are valid
    // Corrected: 'inputText' to 'originalText' based on the 'translations' table schema.
    { sessionId: seededSessions[0]?.sessionId, sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hello', translatedText: 'Hola', latency: 100, timestamp: getDateRelativeToNow(-1, 1) },
    { sessionId: seededSessions[0]?.sessionId, sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'World', translatedText: 'Monde', latency: 150, timestamp: getDateRelativeToNow(-1, 1) },
    { sessionId: seededSessions[1]?.sessionId, sourceLanguage: 'es', targetLanguage: 'en', originalText: 'Hola', translatedText: 'Hello', latency: 120, timestamp: getDateRelativeToNow(-3) },
    { sessionId: seededSessions[2]?.sessionId, sourceLanguage: 'de', targetLanguage: 'en', originalText: 'Guten Tag', translatedText: 'Good day', latency: 200, timestamp: getDateRelativeToNow(0, -0.5) }, // Active session

    // Translations in older sessions
    { sessionId: seededSessions[3]?.sessionId, sourceLanguage: 'en', targetLanguage: 'de', originalText: 'Test', translatedText: 'Test', latency: 80, timestamp: getDateRelativeToNow(-10,1) },
    { sessionId: seededSessions[4]?.sessionId, sourceLanguage: 'fr', targetLanguage: 'en', originalText: 'Bonjour', translatedText: 'Hello', latency: 180, timestamp: getDateRelativeToNow(-25) },
  ];
  
  // Filter out any translations where sessionId might be undefined due to seeding issues
  const validTranslationsToSeed = translationsToSeed.filter(t => t.sessionId !== undefined);
  await seedTranslations(validTranslationsToSeed);

  console.log(`Seeded ${seededSessions.length} sessions and ${validTranslationsToSeed.length} translations for E2E tests.`);
}
