/**
 * E2E Test Setup
 * 
 * This file provides setup and utility functions for E2E tests.
 */

import { execSync } from 'child_process';
import { createServer } from 'http';
import express from 'express';
import { createApiRoutes } from '../../server/routes';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { DatabaseStorage } from '../../server/database-storage';
import { DiagnosticsService } from '../../server/services/DiagnosticsService';

/**
 * Start a test server for E2E tests
 * @param port Port to run the server on
 */
export async function startTestServer(port = 5001) {
  const app = express();
  const server = createServer(app);
  
  // Set up Express middleware
  app.use(express.json());
  app.use(express.static('client'));
  
  // Set up storage
  const storage = new DatabaseStorage();
  
  // Set up DiagnosticsService (initially without activeSessionProvider)
  const diagnosticsService = new DiagnosticsService(storage, null);
  
  // Set up WebSocket server
  const wsService = new WebSocketServer(server, storage);
  
  // Set the WebSocketServer as the active session provider for diagnostics
  diagnosticsService.setActiveSessionProvider(wsService);
  
  // Set up API routes  
  app.use('/api', createApiRoutes(storage, diagnosticsService, wsService));
  
  // Start server
  return new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server is running on port ${port}`);
      resolve();
    });
  });
}

/**
 * Stop a running test server
 */
export function stopTestServer(port = 5001) {
  try {
    // This is a simplistic approach - in a real setup, you'd keep a reference to the server
    execSync(`lsof -i:${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
  } catch (error) {
    console.error('Failed to stop test server:', error);
  }
}

/**
 * Wait for a specified time
 * @param ms Time to wait in milliseconds
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ensure test database schema is up to date
 */
export async function ensureTestDatabaseSchema() {
  try {
    console.log('🔧 Ensuring test database schema is current...');
    execSync('npm run db:migrations:apply:test', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Test database schema verified');
  } catch (error) {
    console.error('❌ Failed to apply test database migrations:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Test database schema setup failed. E2E tests cannot proceed.');
  }
}