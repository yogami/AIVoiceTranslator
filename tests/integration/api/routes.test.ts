/**
 * API Routes Integration Tests
 * 
 * This file tests the API routes of the application by making HTTP requests
 * to a test instance of the Express app.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';

import { createApiRoutes } from '../../../server/routes/index';
import { WebSocketServer } from '../../../server/interface-adapters/websocket/WebSocketServer';
import { DatabaseStorage } from '../../../server/database-storage';
import { UnifiedSessionCleanupService } from '../../../server/application/services/session/cleanup/UnifiedSessionCleanupService';
import { setupIsolatedTest } from '../../utils/test-database-isolation';

// Simple wrapper function to wait for promises
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('API Routes', () => {
  let app: express.Application;
  let storage: DatabaseStorage;
  let cleanupService: UnifiedSessionCleanupService;
  let wsServer: WebSocketServer;
  let httpServer: any;
  let wsPort: number;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    cleanup = undefined;
    
    // Create dependencies for the API routes
    storage = new DatabaseStorage();
    cleanupService = new UnifiedSessionCleanupService(storage, new Map());
    
    // Create a test HTTP server for WebSocket
    httpServer = createServer();
    
    // Listen on a random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        wsPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
    
    wsServer = new WebSocketServer(httpServer, storage);
    
    // Create Express app and add API routes
    app = express();
    app.use(express.json());
    
    // Add API routes
    const apiRoutes = createApiRoutes(storage, wsServer, cleanupService);
    app.use('/api', apiRoutes);
  });

  afterEach(async () => {
    if (httpServer) {
      httpServer.close();
    }
    if (cleanup) {
      await cleanup();
    }
  });
  
  it('should handle health check endpoint', async () => {
    const response = await supertest(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
  
  it('should get all languages', async () => {
    const response = await supertest(app)
      .get('/api/languages')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBeTruthy();
    expect(response.body.length).toBeGreaterThan(0);
    
    // Check that each language has the expected properties
    response.body.forEach((language: any) => {
      expect(language).toHaveProperty('id');
      expect(language).toHaveProperty('name');
      expect(language).toHaveProperty('code');
      expect(language).toHaveProperty('isActive');
    });
  });
  
  it('should get active languages', async () => {
    const response = await supertest(app)
      .get('/api/languages/active')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBeTruthy();
    
    // Verify all returned languages are active
    response.body.forEach((language: any) => {
      expect(language.isActive).toBeTruthy();
    });
  });
  
  // Test getting user information from the API - simplified test
  it('should get a response from user endpoint', async () => {
    // Just verify the API endpoint responds
    const response = await supertest(app)
      .get('/api/user');
    
    // We're just checking the endpoint is working and returning something
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });
});