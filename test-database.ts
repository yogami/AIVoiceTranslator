/**
 * Test Database Connection
 * 
 * This script tests the database connection and storage implementation
 */
import { storage } from './server/storage';

// Simple function to log the results
const logResult = (title: string, data: any) => {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  try {
    // Test getting languages
    const languages = await storage.getLanguages();
    logResult('All Languages', languages);
    
    // Test getting active languages
    const activeLanguages = await storage.getActiveLanguages();
    logResult('Active Languages', activeLanguages);
    
    // Test getting a specific language
    const english = await storage.getLanguageByCode('en-US');
    logResult('English Language', english);
    
    console.log('\nDatabase connection test completed successfully!');
  } catch (error) {
    console.error('Database connection test failed:', error);
  }
}

// Run the test
testDatabaseConnection();