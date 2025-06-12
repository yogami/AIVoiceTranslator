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
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
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
    
    await migrate(db, { migrationsFolder });

    console.log('🟢 TEST Database migrations applied successfully!');
  } catch (error) {
    console.error('🔴 Error applying TEST database migrations:', error);
    process.exit(1);
  } finally {
    if (migrationClient) {
      await migrationClient.end();
      console.log('🔵 TEST Database connection closed.');
    }
  }
};

runMigrations();
