import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

// Explicitly load .env.test
const envTestPath = path.resolve(process.cwd(), '.env.test');
const result = dotenv.config({ path: envTestPath });

if (result.error) {
  console.warn(`🟠 Warning: Could not load .env.test file from ${envTestPath}. Ensure it exists if test-specific DB URL is needed. Error: ${result.error.message}`);
} else {
  console.log(`🟢 Successfully loaded .env.test from ${envTestPath}`);
}


// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigrations = async () => {
  console.log('🟠 Starting test database migration...');
  console.log('🟠 NODE_ENV:', process.env.NODE_ENV);
  console.log('🟠 Current working directory:', process.cwd());
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable must be set.');
    throw new Error('DATABASE_URL environment variable must be set.');
  }

  // Mask credentials for logging
  const urlParts = dbUrl.split('@');
  const safeLogUrl = urlParts.length > 1 ? `${urlParts[0].substring(0, urlParts[0].lastIndexOf(':') + 1)}[PASSWORD_REDACTED]@${urlParts[1]}` : dbUrl;
  console.log('🟠 Connecting to TEST database for migration...');
  console.log(`   DB URL (from .env.test): ${safeLogUrl}`);

  let migrationClient;
  try {
    migrationClient = postgres(dbUrl, { max: 1 });
    const db = drizzle(migrationClient);

    const migrationsFolder = path.resolve(__dirname, '../migrations');
    console.log(`🟠 Looking for migrations in: ${migrationsFolder}`);
    
    console.log('🟠 Running migrations...');
    
    try {
      await migrate(db, { migrationsFolder });
      console.log('🟢 TEST Database migrations applied successfully!');
    } catch (migrationError: any) {
      // Handle the case where tables already exist
      if (migrationError.message?.includes('already exists')) {
        console.log('🟡 Some tables already exist, checking if schema is complete...');
        
        // Verify that key tables exist
        const result = await migrationClient`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('sessions', 'translations', 'languages', 'users')`;
        const existingTables = result.map(r => r.table_name);
        
        console.log('🟡 Existing tables:', existingTables);
        
        if (existingTables.includes('sessions') && existingTables.includes('translations')) {
          console.log('🟢 Required tables exist, schema is ready for testing');
        } else {
          console.error('🔴 Missing required tables:', ['sessions', 'translations'].filter(t => !existingTables.includes(t)));
          throw new Error('Test database schema is incomplete');
        }
      } else {
        // Re-throw other migration errors
        throw migrationError;
      }
    }
    
    // Verify the tables were created/exist
    const result = await migrationClient`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('sessions', 'translations')`;
    console.log('🟢 Verified tables exist:', result.map(r => r.table_name));
    
  } catch (error) {
    console.error('🔴 Error applying TEST database migrations:');
    console.error('🔴 Error message:', error.message);
    console.error('🔴 Error stack:', error.stack);
    throw error;
  } finally {
    if (migrationClient) {
      await migrationClient.end();
      console.log('🔵 TEST Database connection closed.');
    }
  }
};

runMigrations();
