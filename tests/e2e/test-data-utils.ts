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
  
  console.log(`🔧 About to seed ${translationData.length} translations`);
  console.log('🔧 First translation sample:', JSON.stringify(translationData[0], null, 2));
  
  try {
    const result = await db.insert(translations).values(translationData).returning();
    console.log(`✅ Successfully inserted ${result.length} translations`);
    
    // Force any pending transactions to be committed by performing a simple read operation
    const verifyCount = await db.select().from(translations).execute();
    console.log(`✅ Seeded ${result.length} translations, verified ${verifyCount.length} total in database`);
    
    return result;
  } catch (error) {
    console.error('❌ Error seeding translations:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Error details:', error);
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
  
  // Ensure seededSessions returned IDs. If not, use the sessionIds we defined
  let sessionIdsToUse: string[];
  if (!seededSessions || seededSessions.length === 0 || !seededSessions[0].sessionId) {
    console.warn("Database didn't return session data. Using predefined session IDs for translations.");
    sessionIdsToUse = sessionsToSeed.map(s => s.sessionId);
  } else {
    sessionIdsToUse = seededSessions.map((s: any) => s.sessionId);
  }

  const translationsToSeed: InsertTranslation[] = [
    // Simplified translations with basic data to ensure compatibility
    { sessionId: sessionIdsToUse[0], sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hello', translatedText: 'Hola', latency: 100 },
    { sessionId: sessionIdsToUse[0], sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'World', translatedText: 'Monde', latency: 150 },
    { sessionId: sessionIdsToUse[1], sourceLanguage: 'es', targetLanguage: 'en', originalText: 'Hola', translatedText: 'Hello', latency: 120 },
    { sessionId: sessionIdsToUse[2], sourceLanguage: 'de', targetLanguage: 'en', originalText: 'Guten Tag', translatedText: 'Good day', latency: 200 },
    { sessionId: sessionIdsToUse[3], sourceLanguage: 'en', targetLanguage: 'de', originalText: 'Test', translatedText: 'Test', latency: 80 },
    { sessionId: sessionIdsToUse[4], sourceLanguage: 'fr', targetLanguage: 'en', originalText: 'Bonjour', translatedText: 'Hello', latency: 180 },
  ];
  
  // Filter out any translations where sessionId might be undefined due to seeding issues
  const validTranslationsToSeed = translationsToSeed.filter(t => t.sessionId !== undefined);
  const seededTranslations = await seedTranslations(validTranslationsToSeed);

  console.log(`Seeded ${seededSessions.length} sessions and ${validTranslationsToSeed.length} translations for E2E tests.`);
  
  // Final verification to ensure data is committed and visible
  await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
  const finalVerification = await db.select().from(translations).execute();
  
  if (finalVerification.length !== validTranslationsToSeed.length) {
    console.error(`❌ ERROR: Seeded ${validTranslationsToSeed.length} translations but only ${finalVerification.length} are visible!`);
    throw new Error('Translation seeding failed - database transaction issue detected');
  }
}
