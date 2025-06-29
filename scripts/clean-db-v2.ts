import { db } from '../server/db';

async function cleanDatabase() {
  try {
    console.log('🔧 Connected to database...');
    
    // Check what data exists
    console.log('\n=== CHECKING CURRENT DATA ===');
    
    const sessionsResult = await db.execute('SELECT COUNT(*) FROM classroom_sessions');
    const translationsResult = await db.execute('SELECT COUNT(*) FROM translations');
    const transcriptsResult = await db.execute('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${sessionsResult.rows[0].count}`);
    console.log(`Translations: ${translationsResult.rows[0].count}`);
    console.log(`Transcripts: ${transcriptsResult.rows[0].count}`);
    
    // Show sample data if it exists
    if (parseInt(translationsResult.rows[0].count as string) > 0) {
      console.log('\n=== SAMPLE TRANSLATIONS (that will be deleted) ===');
      const sampleTranslations = await db.execute('SELECT source_language, target_language, source_text, target_text, created_at FROM translations LIMIT 3');
      console.table(sampleTranslations.rows);
    }
    
    if (parseInt(sessionsResult.rows[0].count as string) > 0) {
      console.log('\n=== SAMPLE SESSIONS (that will be deleted) ===');
      const sampleSessions = await db.execute('SELECT session_id, class_code, created_at FROM classroom_sessions LIMIT 3');
      console.table(sampleSessions.rows);
    }
    
    // Clean the database
    console.log('\n=== CLEANING DATABASE ===');
    console.log('Deleting all test data...');
    
    await db.execute('DELETE FROM transcripts');
    console.log('✅ Cleaned transcripts table');
    
    await db.execute('DELETE FROM translations');
    console.log('✅ Cleaned translations table');
    
    await db.execute('DELETE FROM classroom_sessions');
    console.log('✅ Cleaned classroom_sessions table');
    
    // Verify cleanup
    console.log('\n=== VERIFICATION ===');
    const finalSessionsResult = await db.execute('SELECT COUNT(*) FROM classroom_sessions');
    const finalTranslationsResult = await db.execute('SELECT COUNT(*) FROM translations');
    const finalTranscriptsResult = await db.execute('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${finalSessionsResult.rows[0].count}`);
    console.log(`Translations: ${finalTranslationsResult.rows[0].count}`);
    console.log(`Transcripts: ${finalTranscriptsResult.rows[0].count}`);
    
    console.log('\n🎉 Database cleaned successfully!');
    console.log('The diagnostics page should now show zero values for all metrics.');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  }
}

cleanDatabase();
