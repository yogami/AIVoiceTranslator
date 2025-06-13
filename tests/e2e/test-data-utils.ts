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
  console.log('Cleared diagnostic data (transcripts, translations, sessions) and reset sequences.');
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
    { sessionId: 'e2e-session-1', isActive: false, teacherLanguage: 'en' }, // Ended yesterday
    { sessionId: 'e2e-session-2', isActive: false, teacherLanguage: 'es' }, // Ended 3 days ago
    { sessionId: 'e2e-session-3', isActive: true, teacherLanguage: 'de' }, // Active, started 1 hour ago

    // Older sessions (between 8 and 30 days ago)
    { sessionId: 'e2e-session-4', isActive: false, teacherLanguage: 'fr' },
    { sessionId: 'e2e-session-5', isActive: false, teacherLanguage: 'en' },
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
