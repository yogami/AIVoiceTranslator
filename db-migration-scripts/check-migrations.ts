import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const checkMigrations = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable must be set.');
  }

  let client;
  try {
    client = postgres(dbUrl, { max: 1 });
    const db = drizzle(client);

    // Check if drizzle migrations table exists
    const migrationsTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      )
    `);

    const migrationTableResult = migrationsTableExists[0] as { exists: boolean };
    if (!migrationTableResult?.exists) {
      console.log('Migrations table does not exist - migrations need to be applied');
      process.exit(1);
    }

    // Check if core tables exist
    const coreTablesExist = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'languages') as languages_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'sessions') as sessions_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'translations') as translations_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'transcripts') as transcripts_exists,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users') as users_exists
    `);

    const tables = coreTablesExist[0] as any;
    const allTablesExist = tables && 
      tables.languages_exists > 0 && 
      tables.sessions_exists > 0 && 
      tables.translations_exists > 0 && 
      tables.transcripts_exists > 0 && 
      tables.users_exists > 0;

    if (allTablesExist) {
      console.log('✅ All core tables exist - database schema appears to be up to date');
      process.exit(0);
    } else {
      console.log('❌ Some core tables are missing - migrations need to be applied');
      console.log('Table status:', tables);
      process.exit(1);
    }

  } catch (error) {
    console.error('🔴 Error checking migrations:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
};

checkMigrations();
