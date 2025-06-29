#!/usr/bin/env node

import { DatabaseConnection } from '../dist/server/storage/DatabaseConnection.js';

async function cleanDatabase() {
  const db = new DatabaseConnection();
  
  try {
    await db.init();
    console.log('Connected to database...');
    
    // Check what data exists
    console.log('\n=== CHECKING CURRENT DATA ===');
    
    const sessionsCount = await db.query('SELECT COUNT(*) FROM classroom_sessions');
    const translationsCount = await db.query('SELECT COUNT(*) FROM translations');
    const transcriptsCount = await db.query('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${sessionsCount.rows[0].count}`);
    console.log(`Translations: ${translationsCount.rows[0].count}`);
    console.log(`Transcripts: ${transcriptsCount.rows[0].count}`);
    
    // Show sample data
    if (parseInt(translationsCount.rows[0].count) > 0) {
      console.log('\n=== SAMPLE TRANSLATIONS ===');
      const sampleTranslations = await db.query('SELECT source_language, target_language, source_text, target_text, created_at FROM translations LIMIT 5');
      console.log(sampleTranslations.rows);
    }
    
    if (parseInt(sessionsCount.rows[0].count) > 0) {
      console.log('\n=== SAMPLE SESSIONS ===');
      const sampleSessions = await db.query('SELECT session_id, class_code, created_at FROM classroom_sessions LIMIT 5');
      console.log(sampleSessions.rows);
    }
    
    // Ask user if they want to clean
    console.log('\n=== CLEANING DATABASE ===');
    console.log('This will delete ALL data from the following tables:');
    console.log('- translations');
    console.log('- transcripts');
    console.log('- classroom_sessions');
    console.log('\nProceed? (This script will automatically clean...)');
    
    // Clean the database
    await db.query('DELETE FROM transcripts');
    console.log('✅ Cleaned transcripts table');
    
    await db.query('DELETE FROM translations');
    console.log('✅ Cleaned translations table');
    
    await db.query('DELETE FROM classroom_sessions');
    console.log('✅ Cleaned classroom_sessions table');
    
    // Verify cleanup
    console.log('\n=== VERIFICATION ===');
    const finalSessionsCount = await db.query('SELECT COUNT(*) FROM classroom_sessions');
    const finalTranslationsCount = await db.query('SELECT COUNT(*) FROM translations');
    const finalTranscriptsCount = await db.query('SELECT COUNT(*) FROM transcripts');
    
    console.log(`Sessions: ${finalSessionsCount.rows[0].count}`);
    console.log(`Translations: ${finalTranslationsCount.rows[0].count}`);
    console.log(`Transcripts: ${finalTranscriptsCount.rows[0].count}`);
    
    console.log('\n✅ Database cleaned successfully!');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  } finally {
    await db.close();
  }
}

cleanDatabase();
