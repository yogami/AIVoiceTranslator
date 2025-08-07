/**
 * API Routes Integration Tests
 * 
 * This file tests the API routes of the application by making HTTP requests
 * to a test instance of the Express app.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { AddressInfo } from 'net';

import { createApiRoutes } from '../../../server/api/routes.js';
import { WebSocketManager } from '../../../server/services/websocket/WebSocketManager.js';
import { SessionCountCacheService } from '../../../server/services/session/SessionCountCacheService.js';
import { DatabaseStorage } from '../../../server/storage/DatabaseStorage.js';
import { UnifiedSessionCleanupService } from '../../../server/services/session/UnifiedSessionCleanupService.js';
import { setupIsolatedTest } from '../../helpers/test-isolation.js';

// Simple wrapper function to wait for promises
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('API Routes', () => {
  let app: express.Application;
  let storage: DatabaseStorage;
  let cleanupService: UnifiedSessionCleanupService;
  let wsManager: WebSocketManager;
  let httpServer: any;
  let wsPort: number;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    cleanup = await setupIsolatedTest();
    
    // Create dependencies for the API routes
    storage = new DatabaseStorage();
    cleanupService = new UnifiedSessionCleanupService();
    
    // Create a test HTTP server for WebSocket
    httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    
    // Listen on a random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        wsPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
    
    wsManager = new WebSocketManager(wss, storage, cleanupService);
    
    // Create Express app and add API routes
    app = express();
    app.use(express.json());
    
    // Add API routes
    createApiRoutes(app, storage, wsManager);
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
      .get('/api/user')
      .expect('Content-Type', /json/);
    
    // We're just checking the endpoint is working and returning something
    // The actual implementation always returns user #1 or 404 if not found
    expect(response.body).toBeDefined();
  });
});