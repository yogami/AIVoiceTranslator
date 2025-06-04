/**
 * Database Connection Module
 * 
 * Manages database connections and provides a configured Drizzle ORM instance.
 * Uses Neon serverless PostgreSQL with WebSocket support.
 */

import { Pool, neonConfig, PoolConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

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
 * Creates a database pool with the provided configuration
 */
function createDatabasePool(config: DatabaseConfig): Pool {
  const poolConfig: PoolConfig = {
    connectionString: config.connectionString,
    max: config.maxConnections,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };

  return new Pool(poolConfig);
}

// Conditional database initialization - only initialize if DATABASE_URL is present
let pool: Pool;
let db: ReturnType<typeof drizzle>;

if (process.env.DATABASE_URL) {
  // Initialize database configuration
  const dbConfig = validateDatabaseConfig();
  
  // Create database pool
  pool = createDatabasePool(dbConfig);
  
  // Create Drizzle ORM instance
  db = drizzle({ client: pool, schema });
} else {
  // Create placeholder objects for when no database is configured
  // These will only be used by DatabaseStorage which won't be instantiated without DATABASE_URL
  pool = null as any;
  db = null as any;
}

export { pool, db };

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