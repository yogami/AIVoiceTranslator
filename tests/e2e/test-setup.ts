/**
 * E2E Test Setup
 * 
 * This file provides setup and utility functions for E2E tests.
 */

import { execSync } from 'child_process';
import { createServer } from 'http';
import express from 'express';
import { apiRoutes } from '../../server/routes';
import { WebSocketServer } from '../../server/services/WebSocketServer';

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
  
  // Set up API routes
  app.use('/api', apiRoutes);
  
  // Set up WebSocket server
  const wsService = new WebSocketServer(server);
  
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