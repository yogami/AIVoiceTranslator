#!/usr/bin/env npx tsx

import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

async function addTeacherIdColumn() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false,
    });

    try {
        await client.connect();
        console.log("Connected to test database successfully");

        // Check if teacher_id column already exists
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sessions' 
            AND column_name = 'teacher_id'
        `);

        if (checkResult.rows.length > 0) {
            console.log("✅ teacher_id column already exists");
            return;
        }

        // Add teacher_id column
        await client.query(`
            ALTER TABLE sessions 
            ADD COLUMN teacher_id VARCHAR(255)
        `);
        
        console.log("✅ Added teacher_id column to sessions table");

        // Verify the column was added
        const verifyResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sessions' 
            AND column_name = 'teacher_id'
        `);

        if (verifyResult.rows.length > 0) {
            console.log("✅ teacher_id column verified:", verifyResult.rows[0]);
        } else {
            console.error("❌ teacher_id column not found after creation");
        }

    } catch (error) {
        console.error("Migration error:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    addTeacherIdColumn()
        .then(() => {
            console.log("Migration completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
}