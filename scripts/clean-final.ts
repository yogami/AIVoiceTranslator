import { db } from '../server/db';

async function cleanDatabase() {
  try {
    console.log('🔧 Connected to database...');
    
    // Check current data
    console.log('\n=== CURRENT DATA BEFORE CLEANUP ===');
    const translationsResult = await db.execute('SELECT COUNT(*) FROM translations');
    const sessionsResult = await db.execute('SELECT COUNT(*) FROM sessions');
    const transcriptsResult = await db.execute('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${sessionsResult.rows[0].count}`);
    console.log(`Translations: ${translationsResult.rows[0].count}`);
    console.log(`Transcripts: ${transcriptsResult.rows[0].count}`);
    
    if (parseInt(translationsResult.rows[0].count as string) > 0) {
      console.log('\n=== TRANSLATIONS TO BE DELETED ===');
      const sampleTranslations = await db.execute('SELECT * FROM translations');
      console.table(sampleTranslations.rows);
    }
    
    // Clean the database
    console.log('\n=== CLEANING DATABASE ===');
    
    await db.execute('DELETE FROM transcripts');
    console.log('✅ Cleaned transcripts table');
    
    await db.execute('DELETE FROM translations');
    console.log('✅ Cleaned translations table');
    
    await db.execute('DELETE FROM sessions');
    console.log('✅ Cleaned sessions table');
    
    // Verify cleanup
    console.log('\n=== VERIFICATION AFTER CLEANUP ===');
    const finalTranslationsResult = await db.execute('SELECT COUNT(*) FROM translations');
    const finalSessionsResult = await db.execute('SELECT COUNT(*) FROM sessions');
    const finalTranscriptsResult = await db.execute('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${finalSessionsResult.rows[0].count}`);
    console.log(`Translations: ${finalTranslationsResult.rows[0].count}`);
    console.log(`Transcripts: ${finalTranscriptsResult.rows[0].count}`);
    
    console.log('\n🎉 Database cleaned successfully!');
    console.log('🔄 Now test the diagnostics page - it should show all zero values.');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  }
}

cleanDatabase();
