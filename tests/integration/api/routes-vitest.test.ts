/**
 * API Routes Integration Tests
 * 
 * This file tests the API routes of the application by making HTTP requests
 * to a test instance of the Express app.
 * 
 * Converted from Jest to Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { apiRoutes } from '../../../server/routes';
import { storage } from '../../../server/storage';

// Simple wrapper function to wait for promises
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('API Routes', () => {
  let app: Express;
  
  beforeEach(() => {
    // IMPORTANT: Use the actual Express app and routes
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
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
    
    // Verify we get an array of languages
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Verify language structure
    const language = response.body[0];
    expect(language).toHaveProperty('id');
    expect(language).toHaveProperty('code');
    expect(language).toHaveProperty('name');
    expect(language).toHaveProperty('isActive');
  });
  
  it('should get only active languages', async () => {
    const response = await request(app)
      .get('/api/languages/active')
      .expect('Content-Type', /json/)
      .expect(200);
    
    // Verify we get an array of languages
    expect(Array.isArray(response.body)).toBe(true);
    
    // Verify all returned languages are active
    response.body.forEach((lang: any) => {
      expect(lang.isActive).toBe(true);
    });
  });
  
  it('should handle errors gracefully', async () => {
    // Mock an error in the storage
    const originalGetLanguages = storage.getLanguages;
    storage.getLanguages = vi.fn().mockRejectedValue(new Error('Test error'));
    
    // Make the request
    const response = await request(app)
      .get('/api/languages')
      .expect('Content-Type', /json/)
      .expect(500);
    
    // Verify error response structure
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Error fetching languages');
    
    // Restore the original method
    storage.getLanguages = originalGetLanguages;
  });
  
  it('should get user information', async () => {
    // Seed a test user if needed
    let userId: number;
    try {
      const user = await storage.createUser({
        username: 'testuser',
        password: 'password123'
      });
      userId = user.id;
    } catch (err) {
      // If user already exists, get their ID
      const existingUser = await storage.getUserByUsername('testuser');
      userId = existingUser?.id || 1;
    }
    
    // Make the request
    const response = await request(app)
      .get('/api/user')
      .expect('Content-Type', /json/)
      .expect(200);
    
    // Verify user data
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('username');
  });
});