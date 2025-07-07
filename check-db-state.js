#!/usr/bin/env node

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

async function checkDatabaseState() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('neon') ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('Connected to database:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
        
        // Get all tables
        const allTables = await client.query(`
            SELECT table_name, table_schema
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('\n📋 All tables in public schema:');
        if (allTables.rows.length === 0) {
            console.log('  (No tables found)');
        } else {
            allTables.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        }
        
        // Check if we can find session data
        if (allTables.rows.some(row => row.table_name === 'sessions')) {
            const sessionCount = await client.query('SELECT COUNT(*) as count FROM sessions');
            console.log(`\n📊 Sessions table has ${sessionCount.rows[0].count} records`);
            
            if (parseInt(sessionCount.rows[0].count) > 0) {
                const recentSessions = await client.query(`
                    SELECT id, classroom_code, created_at, updated_at, end_time 
                    FROM sessions 
                    ORDER BY created_at DESC 
                    LIMIT 3
                `);
                console.log('\n🔍 Recent sessions:');
                recentSessions.rows.forEach(session => {
                    console.log(`  - ID: ${session.id}, Code: ${session.classroom_code}, EndTime: ${session.end_time}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkDatabaseState();
