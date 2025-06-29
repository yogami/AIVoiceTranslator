import { db } from '../server/db';

async function checkDatabase() {
  try {
    console.log('🔧 Connected to database...');
    
    // Check what tables exist
    console.log('\n=== CHECKING WHAT TABLES EXIST ===');
    
    const tablesResult = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    console.table(tablesResult.rows);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found! The database schema may not be initialized.');
      console.log('Try running: npm run db:migrate or npm run db:schema:push');
      return;
    }
    
    // Check data in each table
    for (const row of tablesResult.rows) {
      const tableName = row.table_name as string;
      console.log(`\n=== TABLE: ${tableName} ===`);
      
      try {
        const countResult = await db.execute(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`Count: ${countResult.rows[0].count}`);
        
        if (parseInt(countResult.rows[0].count as string) > 0) {
          const sampleResult = await db.execute(`SELECT * FROM ${tableName} LIMIT 3`);
          console.log('Sample data:');
          console.table(sampleResult.rows);
        }
      } catch (error) {
        console.log(`Error querying ${tableName}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkDatabase();
