/**
 * Database Connection Module
 * 
 * Manages database connections and provides a configured Drizzle ORM instance.
 * Supports PostgreSQL with different providers:
 * - Local/Test: Aiven
 * - Dev/CI/CD: Supabase
 * - Production: Railway
 */

import * as schema from '../shared/schema';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm/sql';

// --- Driver selection logic ---
let pool: any;
let db: any;

const isValidDatabaseUrl = process.env.DATABASE_URL && 
  process.env.DATABASE_URL !== 'your_database_url_here' && 
  (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'));

if (isValidDatabaseUrl) {
  // Standard Postgres (Aiven/Supabase/Railway)
  console.log('🔍 DEBUG: All environment variables with DATABASE:', Object.keys(process.env).filter(k => k.includes('DATABASE')).map(k => `${k}=${process.env[k]}`));
  console.log('🔍 DEBUG: process.env.DATABASE_URL:', process.env.DATABASE_URL);
  console.log('🔍 DEBUG: process.env object has DATABASE_URL:', 'DATABASE_URL' in process.env);
  const databaseUrl = process.env.DATABASE_URL;
  console.log('🔍 DB MODULE: DATABASE_URL from env:', databaseUrl);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required but not provided');
  }
  
  // Detect provider and environment for optimal connection settings
  const isAivenFree = databaseUrl.includes('aivencloud.com');
  const isSupabase = databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com');
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  
  // Force max connections to 1 for all environments to avoid pool exhaustion in tests
  const connectionConfig: any = {
    max: 1,
    connect_timeout: isSupabase ? 30 : 10,
    idle_timeout: 5,
    max_lifetime: 60 * 5,
    ...(isSupabase && {
      retry: true,
      retry_delay: 1000,
      max_retries: 3,
      keepalive: true,
      keepalive_idle: 30000,
    })
  };
  pool = postgres(databaseUrl, connectionConfig);
  db = pgDrizzle(pool, { schema });
} else {
  pool = null;
  db = null;
}

export { pool, db, sql };

/**
 * Tests database connectivity with retry logic
 * @returns Promise that resolves if connection is successful
 */
export async function testDatabaseConnection(): Promise<void> {
  if (!pool) {
    throw new Error('Database not configured - DATABASE_URL not set');
  }
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool`SELECT 1`;
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Database connection attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(
    `Failed to connect to database after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
  );
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
      connected: false,
    };
  }
  
  return {
    totalCount: pool.options?.max || 10,
    connected: true,
  };
}

/**
 * Performs a health check on the database connection
 * @returns Promise with connection status and details
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  provider?: string;
}> {
  if (!pool) {
    return {
      connected: false,
      error: 'Database not configured',
    };
  }
  
  const databaseUrl = process.env.DATABASE_URL || '';
  let provider = 'unknown';
  if (databaseUrl.includes('supabase')) provider = 'supabase';
  else if (databaseUrl.includes('aivencloud')) provider = 'aiven';
  else if (databaseUrl.includes('railway')) provider = 'railway';
  
  try {
    const start = Date.now();
    await pool`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      connected: true,
      latency,
      provider,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}