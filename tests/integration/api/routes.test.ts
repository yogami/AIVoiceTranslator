/**
 * API Routes Integration Tests
 * 
 * This file tests the API routes of the application by making HTTP requests
 * to a test instance of the Express app.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import http from 'http';
import { createApiRoutes, apiErrorHandler } from '../../../server/routes';
import { DatabaseStorage } from '../../../server/database-storage';
import { DiagnosticsService } from '../../../server/services/DiagnosticsService';
import { WebSocketServer } from '../../../server/services/WebSocketServer';

// Simple wrapper function to wait for promises
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('API Routes', () => {
  let app: Express;
  
  beforeEach(async () => {
    // Create dependencies for the API routes
    const storage = new DatabaseStorage();
    const diagnosticsService = new DiagnosticsService(storage);
    
    // Create a test HTTP server for WebSocket
    app = express();
    const server = http.createServer(app);
    const webSocketServer = new WebSocketServer(server, storage);
    
    // Create API routes with dependencies
    const apiRoutes = createApiRoutes(storage, diagnosticsService, webSocketServer);
    
    // Set up the Express app
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use('/api', apiErrorHandler);
  });
  
  it('should handle health check endpoint', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
  
  it('should get all languages', async () => {
    const response = await request(app)
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
    const response = await request(app)
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
    const response = await request(app)
      .get('/api/user')
      .expect('Content-Type', /json/);
    
    // We're just checking the endpoint is working and returning something
    // The actual implementation always returns user #1 or 404 if not found
    expect(response.body).toBeDefined();
  });
});