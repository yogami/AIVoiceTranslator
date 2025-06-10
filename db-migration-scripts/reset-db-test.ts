import dotenv from 'dotenv';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

// Explicitly load .env.test
const envTestPath = path.resolve(process.cwd(), '.env.test');
const result = dotenv.config({ path: envTestPath });

if (result.error) {
  console.warn(`🟠 Warning: Could not load .env.test file from ${envTestPath}. Ensure it exists. Error: ${result.error.message}`);
} else {
  console.log(`🟢 Successfully loaded .env.test from ${envTestPath}`);
}

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tableNames = [
  'translations',
  'transcripts',
  'sessions',
  'languages',
  'users',
  'drizzle.__drizzle_migrations' // Drizzle's internal migration tracking table
];

const resetTestDatabase = async () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('🔴 DATABASE_URL environment variable is not set. Ensure it is present in your .env.test file.');
    process.exit(1);
  }

  const urlParts = dbUrl.split('@');
  const safeLogUrl = urlParts.length > 1 ? `${urlParts[0].substring(0, urlParts[0].lastIndexOf(':') + 1)}[PASSWORD_REDACTED]@${urlParts[1]}` : dbUrl;
  console.log(`🟠 Attempting to reset TEST database: ${safeLogUrl}`);
  console.log('   This will DROP the following tables if they exist:');
  tableNames.forEach(name => console.log(`     - ${name}`));

  let sql;
  try {
    sql = postgres(dbUrl, { max: 1 });

    console.log('🟠 Dropping tables from TEST database...');
    for (const tableName of tableNames) {
      await sql.unsafe(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      console.log(`   ✓ Table ${tableName} dropped from TEST database (if existed).`);
    }

    console.log('🟢 TEST Database reset successfully (tables dropped).');
  } catch (error) {
    console.error('🔴 Error resetting TEST database:', error);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log('🔵 TEST Database connection closed.');
    }
  }
};

resetTestDatabase();
