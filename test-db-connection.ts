import { pool, db } from './server/db';
import * as schema from './shared/schema';
import { sql } from 'drizzle-orm';

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW()');
    console.log('Connection successful:', result.rows[0]);
    
    // List existing tables
    const tablesQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\nExisting tables:');
    if (tablesQuery.rows.length === 0) {
      console.log('No tables found.');
    } else {
      tablesQuery.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }
    
    // Check if our schema tables exist
    console.log('\nChecking if our schema tables exist:');
    const tables = ['users', 'languages', 'translations', 'transcripts'];
    for (const table of tables) {
      try {
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`- Table ${table} exists with ${count.rows[0].count} rows`);
      } catch (error) {
        console.log(`- Table ${table} does not exist or cannot be accessed`);
      }
    }
    
    console.log('\nTest completed.');
  } catch (error) {
    console.error('Database connection test failed:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

testDatabaseConnection().catch(console.error);