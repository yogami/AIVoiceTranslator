import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sessions, translations, transcripts, users, languages } from '../shared/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function clearProductionData() {
    console.log('🔧 Clearing all data from production database...');
    
    try {
        // Delete all data from all tables
        await db.delete(translations);
        console.log('✅ Cleared translations table');
        
        await db.delete(transcripts);
        console.log('✅ Cleared transcripts table');
        
        await db.delete(sessions);
        console.log('✅ Cleared sessions table');
        
        await db.delete(users);
        console.log('✅ Cleared users table');
        
        await db.delete(languages);
        console.log('✅ Cleared languages table');
        
        console.log('🎉 Production database cleared successfully!');
        console.log('📊 All tables are now empty and ready for fresh data');
        
    } catch (error) {
        console.error('❌ Error clearing production data:', error);
        throw error;
    }
}

// Run the clearing
clearProductionData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
