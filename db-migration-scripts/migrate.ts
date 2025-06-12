import 'dotenv/config'; // To load .env files (ensure .env or .env.test is loaded based on context)
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

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
  console.log('🟠 Connecting to database for migration...');
  console.log(`   DB URL: ${safeLogUrl}`);


  let migrationClient;
  try {
    // Ensure Neon-specific options if connecting to Neon DB
    // For Neon, you might need to pass specific options if you encounter SSL issues,
    // but typically `sslmode=require` in the URL is sufficient.
    // The `?sslmode=require` in your DATABASE_URL should handle this.
    migrationClient = postgres(dbUrl, { max: 1 });
    const db = drizzle(migrationClient);

    const migrationsFolder = path.resolve(__dirname, '../migrations');
    console.log(`🟠 Looking for migrations in: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });

    console.log('🟢 Migrations applied successfully!');
  } catch (error) {
    console.error('🔴 Error applying migrations:', error);
    process.exit(1);
  } finally {
    if (migrationClient) {
      await migrationClient.end();
      console.log('🔵 Database connection closed.');
    }
  }
};

runMigrations();
