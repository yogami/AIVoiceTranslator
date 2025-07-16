// Import environment setup FIRST, before any other imports
import './setup-env';

import { db } from '../../server/db';
import { sessions, translations, transcripts, type InsertSession, type InsertTranslation, users } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Clears session, translation, and transcript data from the test database, and resets sequences.
 */
export async function clearDiagnosticData() {
  // Delete in order: transcripts -> translations -> sessions -> users
  await db.delete(transcripts).execute();
  await db.delete(translations).execute();
  await db.delete(sessions).execute();
  await db.delete(users).execute();
  // Reset sequences for predictable IDs (ignore if sequence doesn't exist)
  try { await db.execute(sql`ALTER SEQUENCE sessions_id_seq RESTART WITH 1;`); } catch {}
  try { await db.execute(sql`ALTER SEQUENCE translations_id_seq RESTART WITH 1;`); } catch {}
  try { await db.execute(sql`ALTER SEQUENCE transcripts_id_seq RESTART WITH 1;`); } catch {}
  try { await db.execute(sql`ALTER SEQUENCE users_id_seq RESTART WITH 1;`); } catch {}
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
 * Note: According to new business logic, sessions only exist when students have joined.
 */
export async function seedRealisticTestData() {
  await clearDiagnosticData();

  // Create timestamps for sessions to ensure they're within query ranges
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Sessions represent classroom codes where students have joined
  const sessionsToSeed: InsertSession[] = [
    // Recent sessions (within last 7 days) - these exist because students joined
    { 
      sessionId: 'e2e-session-1', 
      isActive: false, 
      teacherLanguage: 'en-US', 
      studentLanguage: 'es-ES',
      classCode: 'ABC123',
      startTime: twoDaysAgo, 
      endTime: new Date(twoDaysAgo.getTime() + 60 * 60 * 1000),
      studentsCount: 3,
      totalTranslations: 15
    },
    { 
      sessionId: 'e2e-session-2', 
      isActive: false, 
      teacherLanguage: 'de-DE', 
      studentLanguage: 'fr-FR',
      classCode: 'XYZ789',
      startTime: threeDaysAgo, 
      endTime: new Date(threeDaysAgo.getTime() + 90 * 60 * 1000),
      studentsCount: 5,
      totalTranslations: 28
    },
    { 
      sessionId: 'e2e-session-3', 
      isActive: true, 
      teacherLanguage: 'de-DE', 
      studentLanguage: 'en-US',
      classCode: 'DEF456',
      startTime: oneHourAgo,
      studentsCount: 2,
      totalTranslations: 8
    }, // Still active - student still connected
    // Older sessions (between 8 and 30 days ago) - historical student activity
    { 
      sessionId: 'e2e-session-4', 
      isActive: false, 
      teacherLanguage: 'fr-FR', 
      studentLanguage: 'de-DE',
      classCode: 'GHI101',
      startTime: tenDaysAgo, 
      endTime: new Date(tenDaysAgo.getTime() + 45 * 60 * 1000),
      studentsCount: 1,
      totalTranslations: 5
    },
    { 
      sessionId: 'e2e-session-5', 
      isActive: false, 
      teacherLanguage: 'en-US', 
      studentLanguage: 'zh-CN',
      classCode: 'JKL202',
      startTime: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), 
      endTime: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      studentsCount: 4,
      totalTranslations: 22
    },
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

/**
 * Creates realistic classroom session data with actual teacher-student interactions
 * This simulates what would happen during real classroom usage according to new business logic:
 * - Sessions only exist when students have joined with classroom codes
 * - Each session represents a classroom where at least one student connected
 */
export async function seedRealisticClassroomData() {
  await clearDiagnosticData();

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Create realistic classroom sessions with proper codes
  const classroomSessions: InsertSession[] = [
    // Active Spanish class
    { 
      sessionId: 'SPN-101-FALL2024', 
      isActive: true, 
      teacherLanguage: 'en-US', 
      studentLanguage: 'es-ES',
      classCode: 'SPAN101',
      startTime: oneHourAgo,
      studentsCount: 12,
      totalTranslations: 35
    },
    // Completed French class (45 minutes)
    { 
      sessionId: 'FRN-201-SPRING2024', 
      isActive: false, 
      teacherLanguage: 'en-US', 
      studentLanguage: 'fr-FR',
      classCode: 'FREN201',
      startTime: twoHoursAgo, 
      endTime: new Date(twoHoursAgo.getTime() + 45 * 60 * 1000),
      studentsCount: 8,
      totalTranslations: 42
    },
    // German conversation practice (completed)
    { 
      sessionId: 'GER-CONV-2024', 
      isActive: false, 
      teacherLanguage: 'de-DE', 
      studentLanguage: 'en-US',
      classCode: 'GERM01',
      startTime: threeDaysAgo, 
      endTime: new Date(threeDaysAgo.getTime() + 60 * 60 * 1000),
      studentsCount: 6,
      totalTranslations: 28
    },
    // International Business Meeting (completed)
    { 
      sessionId: 'BIZ-INTL-2024', 
      isActive: false, 
      teacherLanguage: 'en-US', 
      studentLanguage: 'zh-CN',
      classCode: 'BIZ123',
      startTime: oneWeekAgo, 
      endTime: new Date(oneWeekAgo.getTime() + 30 * 60 * 1000),
      studentsCount: 15,
      totalTranslations: 67
    },
  ];

  const seededSessions = await seedSessions(classroomSessions);
  const sessionIds = seededSessions.map((s: any) => s.sessionId);

  // Create realistic translation patterns that would occur during actual classes
  const classroomTranslations: InsertTranslation[] = [
    // Spanish class - basic vocabulary
    { sessionId: sessionIds[0], sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Hello class', translatedText: 'Hola clase', latency: 150, timestamp: new Date(oneHourAgo.getTime() + 5 * 60 * 1000) },
    { sessionId: sessionIds[0], sourceLanguage: 'en', targetLanguage: 'es', originalText: 'How are you today?', translatedText: '¿Cómo están hoy?', latency: 180, timestamp: new Date(oneHourAgo.getTime() + 10 * 60 * 1000) },
    { sessionId: sessionIds[0], sourceLanguage: 'es', targetLanguage: 'en', originalText: 'Muy bien, gracias', translatedText: 'Very well, thank you', latency: 120, timestamp: new Date(oneHourAgo.getTime() + 15 * 60 * 1000) },
    { sessionId: sessionIds[0], sourceLanguage: 'en', targetLanguage: 'es', originalText: 'Please open your books', translatedText: 'Por favor abran sus libros', latency: 200, timestamp: new Date(oneHourAgo.getTime() + 20 * 60 * 1000) },
    
    // French class - intermediate conversation
    { sessionId: sessionIds[1], sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'Welcome to our French lesson', translatedText: 'Bienvenue à notre leçon de français', latency: 170, timestamp: new Date(twoHoursAgo.getTime() + 2 * 60 * 1000) },
    { sessionId: sessionIds[1], sourceLanguage: 'fr', targetLanguage: 'en', originalText: 'Pouvez-vous répéter?', translatedText: 'Can you repeat?', latency: 140, timestamp: new Date(twoHoursAgo.getTime() + 8 * 60 * 1000) },
    { sessionId: sessionIds[1], sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'Let\'s practice pronunciation', translatedText: 'Pratiquons la prononciation', latency: 190, timestamp: new Date(twoHoursAgo.getTime() + 15 * 60 * 1000) },
    { sessionId: sessionIds[1], sourceLanguage: 'fr', targetLanguage: 'en', originalText: 'C\'est très difficile', translatedText: 'It\'s very difficult', latency: 110, timestamp: new Date(twoHoursAgo.getTime() + 25 * 60 * 1000) },
    { sessionId: sessionIds[1], sourceLanguage: 'en', targetLanguage: 'fr', originalText: 'You\'re doing great!', translatedText: 'Vous vous débrouillez très bien!', latency: 160, timestamp: new Date(twoHoursAgo.getTime() + 30 * 60 * 1000) },
    
    // German immersion - complex sentences
    { sessionId: sessionIds[2], sourceLanguage: 'de', targetLanguage: 'en', originalText: 'Guten Morgen, wie geht es Ihnen?', translatedText: 'Good morning, how are you?', latency: 180, timestamp: new Date(threeDaysAgo.getTime() + 5 * 60 * 1000) },
    { sessionId: sessionIds[2], sourceLanguage: 'en', targetLanguage: 'de', originalText: 'I need help with this exercise', translatedText: 'Ich brauche Hilfe bei dieser Übung', latency: 220, timestamp: new Date(threeDaysAgo.getTime() + 12 * 60 * 1000) },
    { sessionId: sessionIds[2], sourceLanguage: 'de', targetLanguage: 'en', originalText: 'Das ist eine sehr gute Frage', translatedText: 'That is a very good question', latency: 195, timestamp: new Date(threeDaysAgo.getTime() + 20 * 60 * 1000) },
    
    // Japanese conversation - greetings and basics
    { sessionId: sessionIds[3], sourceLanguage: 'en', targetLanguage: 'ja', originalText: 'Good morning everyone', translatedText: 'おはようございます、皆さん', latency: 250, timestamp: new Date(oneWeekAgo.getTime() + 3 * 60 * 1000) },
    { sessionId: sessionIds[3], sourceLanguage: 'ja', targetLanguage: 'en', originalText: 'はじめまして', translatedText: 'Nice to meet you', latency: 180, timestamp: new Date(oneWeekAgo.getTime() + 8 * 60 * 1000) },
    { sessionId: sessionIds[3], sourceLanguage: 'en', targetLanguage: 'ja', originalText: 'Let\'s learn together', translatedText: '一緒に学びましょう', latency: 230, timestamp: new Date(oneWeekAgo.getTime() + 15 * 60 * 1000) },
    
    // Italian cultural studies - advanced topics
    { sessionId: sessionIds[4], sourceLanguage: 'it', targetLanguage: 'en', originalText: 'La cultura italiana è molto ricca', translatedText: 'Italian culture is very rich', latency: 165, timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000) },
    { sessionId: sessionIds[4], sourceLanguage: 'en', targetLanguage: 'it', originalText: 'Tell us about Renaissance art', translatedText: 'Raccontaci dell\'arte rinascimentale', latency: 210, timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000) },
    { sessionId: sessionIds[4], sourceLanguage: 'it', targetLanguage: 'en', originalText: 'Michelangelo era un genio', translatedText: 'Michelangelo was a genius', latency: 140, timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000) },
    { sessionId: sessionIds[4], sourceLanguage: 'en', targetLanguage: 'it', originalText: 'This is fascinating', translatedText: 'Questo è affascinante', latency: 175, timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 55 * 60 * 1000) }
  ];

  await seedTranslations(classroomTranslations);
  
  console.log(`✅ Seeded ${sessionIds.length} realistic classroom sessions with ${classroomTranslations.length} translations`);
  return { sessions: seededSessions, translations: classroomTranslations };
}
