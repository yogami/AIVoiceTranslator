/**
 * Database Connection Module
 * 
 * Manages database connections and provides a configured Drizzle ORM instance.
 * Uses Neon serverless PostgreSQL with WebSocket support.
 */

// Environment variables are loaded by the npm script (dotenv -e .env)
// Removed dotenv import to prevent conflicts

// Prefer IPv6 for DNS resolution (for Supabase free tier) - but only in production
// Test environments should use default DNS resolution to avoid localhost issues
// TEMPORARILY DISABLED: Force IPv4 for pooler connection
// if (process.env.NODE_ENV !== 'test' && process.env.DATABASE_URL?.includes('supabase.com')) {
//   dns.setDefaultResultOrder('ipv6first');
// }

// Environment variables are loaded by the npm script (dotenv -e .env)
// No need to load them again here

import * as schema from "../shared/schema";
import { Pool, neonConfig, PoolConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm/sql'; // Add this import

// --- Driver selection logic ---
// Explicitly type pool and db as any to avoid TypeScript implicit any errors due to dynamic driver switching
let pool: any;
let db: any;

const isNeon = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech');
const isValidDatabaseUrl = process.env.DATABASE_URL && 
  process.env.DATABASE_URL !== 'your_neondb_url_here' && 
  (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'));

if (isValidDatabaseUrl) {
  if (isNeon) {
    // Neon (production/dev)
    neonConfig.webSocketConstructor = ws;
    const dbConfig = validateDatabaseConfig();
    const poolConfig = {
      connectionString: dbConfig.connectionString,
      max: dbConfig.maxConnections,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
    };
    pool = new Pool(poolConfig);
    db = neonDrizzle({ client: pool, schema });
  } else {
    // Standard Postgres (testcontainers/tests/local/Supabase)
    console.log('🔍 DEBUG: All environment variables with DATABASE:', Object.keys(process.env).filter(k => k.includes('DATABASE')).map(k => `${k}=${process.env[k]}`));
    console.log('🔍 DEBUG: process.env.DATABASE_URL:', process.env.DATABASE_URL);
    console.log('🔍 DEBUG: process.env object has DATABASE_URL:', 'DATABASE_URL' in process.env);
    const databaseUrl = process.env.DATABASE_URL;
    console.log('🔍 DB MODULE: DATABASE_URL from env:', databaseUrl);
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required but not provided');
    }
    // Detect if we're using Aiven free tier (which has connection limits)
    const isAivenFree = databaseUrl.includes('aivencloud.com');
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    
    pool = postgres(databaseUrl, { 
      max: isAivenFree || isTestEnvironment ? 1 : 10,  // Single connection for Aiven free tier
      connect_timeout: 10, // 10 seconds connection timeout
      idle_timeout: isAivenFree || isTestEnvironment ? 5 : 20,    // Shorter timeout for free tier
      max_lifetime: isAivenFree || isTestEnvironment ? 60 * 5 : 60 * 30 // Shorter lifetime for free tier
    });
    db = pgDrizzle(pool, { schema });
  }
} else {
  pool = null;
  db = null;
}

export { pool, db, sql }; // Add sql to exports

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Validates database configuration
 * @throws Error if configuration is invalid
 */
function validateDatabaseConfig(): DatabaseConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Basic validation of connection string format
  try {
    new URL(connectionString);
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return {
    connectionString,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
  };
}

/**
 * Tests database connectivity
 * @returns Promise that resolves if connection is successful
 */
export async function testDatabaseConnection(): Promise<void> {
  if (!pool) {
    throw new Error('Database not configured - DATABASE_URL not set');
  }
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (error) {
    throw new Error(
      `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Gracefully closes all database connections
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (!pool) {
    return; // No database to close
  }
  
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
}

/**
 * Gets current pool statistics
 */
export function getPoolStats() {
  if (!pool) {
    return {
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}