#!/usr/bin/env node

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

async function testDatabaseConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('neon') ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('Testing database connection...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')); // Hide password
        
        await client.connect();
        console.log('✅ Successfully connected to database');
        
        // Test a simple query
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        console.log('✅ Query successful:', result.rows[0]);
        
        // Test if our tables exist
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sessions', 'participants', 'messages')
            ORDER BY table_name
        `);
        
        console.log('✅ Available tables:', tableCheck.rows.map(row => row.table_name));
        
        if (tableCheck.rows.length < 3) {
            console.log('⚠️  Warning: Some tables are missing. You may need to run migrations.');
        }
        
    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            console.error('🔍 This appears to be a timeout/connectivity issue');
        }
        if (error.message.includes('authentication') || error.code === '28P01') {
            console.error('🔍 This appears to be an authentication issue');
        }
        if (error.message.includes('database') && error.message.includes('does not exist')) {
            console.error('🔍 The database does not exist');
        }
        if (error.message.includes('compute time')) {
            console.error('🔍 This appears to be a NeonDB compute time limit issue');
        }
        
        return false;
    } finally {
        await client.end();
    }
    
    return true;
}

testDatabaseConnection()
    .then((success) => {
        if (success) {
            console.log('\n✅ Database connection test passed');
        } else {
            console.log('\n❌ Database connection test failed');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('\n💥 Unexpected error:', error);
        process.exit(1);
    });
