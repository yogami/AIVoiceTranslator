import { db as prodDb } from '../server/db';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env.test' });

async function applyMigration() {
  const migrationFile = '0007_remove_lastactivityat_default.sql';
  const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Applying migration: ${migrationFile}`);
    console.log(`SQL: ${sql}`);
    
    // Apply to production DB
    console.log('Applying to production database...');
    await prodDb.execute(sql);
    console.log('✅ Migration applied to production database');
    
    // Apply to test DB
    console.log('Applying to test database...');
    const testDbUrl = process.env.DATABASE_URL;
    if (!testDbUrl) {
      throw new Error('DATABASE_URL not found in test environment');
    }
    const testConnection = postgres(testDbUrl);
    const testDb = drizzle(testConnection);
    await testDb.execute(sql);
    await testConnection.end();
    console.log('✅ Migration applied to test database');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('Migration completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
