/**
 * Database Test Script
 * 
 * Tests the database connection and storage implementation
 */
import { storage } from '../server/storage';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test retrieving languages
    const languages = await storage.getLanguages();
    console.log(`Found ${languages.length} languages in the database`);
    console.log('First few languages:', languages.slice(0, 3));
    
    // Test creating a user
    const testUsername = `test_user_${Date.now()}`;
    const user = await storage.createUser({
      username: testUsername,
      password: 'test_password'
    });
    console.log('Created test user:', user);
    
    // Test retrieving the user
    const retrievedUser = await storage.getUserByUsername(testUsername);
    console.log('Retrieved user by username:', retrievedUser);
    
    // Test creating a translation
    const translation = await storage.addTranslation({
      sourceLanguage: 'en-US',
      targetLanguage: 'es',
      originalText: 'Hello world',
      translatedText: 'Hola mundo',
      latency: 150
    });
    console.log('Added translation:', translation);
    
    // Test retrieving translations by language
    const translations = await storage.getTranslationsByLanguage('es', 5);
    console.log(`Found ${translations.length} Spanish translations`);
    
    // Test creating a transcript
    const sessionId = `test_session_${Date.now()}`;
    const transcript = await storage.addTranscript({
      sessionId,
      language: 'en-US',
      text: 'This is a test transcript'
    });
    console.log('Added transcript:', transcript);
    
    // Test retrieving transcripts by session
    const transcripts = await storage.getTranscriptsBySession(sessionId, 'en-US');
    console.log(`Found ${transcripts.length} transcripts for session ${sessionId}`);
    
    console.log('All database tests completed successfully!');
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDatabase();