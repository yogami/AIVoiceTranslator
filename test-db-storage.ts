import { storage } from './server/storage';
import { InsertUser } from './shared/schema';

async function testDatabaseStorage() {
  try {
    console.log('Testing DatabaseStorage implementation...');
    
    // Test getLanguages
    console.log('\nTesting getLanguages()...');
    const languages = await storage.getLanguages();
    console.log(`Retrieved ${languages.length} languages:`);
    languages.forEach(lang => {
      console.log(`- ${lang.name} (${lang.code}): ${lang.isActive ? 'active' : 'inactive'}`);
    });
    
    // Test getActiveLanguages
    console.log('\nTesting getActiveLanguages()...');
    const activeLanguages = await storage.getActiveLanguages();
    console.log(`Retrieved ${activeLanguages.length} active languages:`);
    activeLanguages.forEach(lang => {
      console.log(`- ${lang.name} (${lang.code})`);
    });
    
    // Test getUserByUsername (should return undefined since we have no users yet)
    console.log('\nTesting getUserByUsername()...');
    const existingUser = await storage.getUserByUsername('testuser');
    console.log('Existing user:', existingUser || 'Not found (expected)');
    
    // Test createUser
    console.log('\nTesting createUser()...');
    const randomSuffix = Math.floor(Math.random() * 10000);
    const testUser: InsertUser = {
      username: `testuser${randomSuffix}`,
      password: 'testpassword'
    };
    
    try {
      const newUser = await storage.createUser(testUser);
      console.log('Created new user:', newUser);
      
      // Verify user was created by retrieving it
      const retrievedUser = await storage.getUserByUsername(testUser.username);
      console.log('Retrieved user:', retrievedUser);
    } catch (error) {
      console.error('Error creating user:', error);
    }
    
    console.log('\nTest completed.');
  } catch (error) {
    console.error('Database storage test failed:', error);
  }
}

testDatabaseStorage().catch(console.error);