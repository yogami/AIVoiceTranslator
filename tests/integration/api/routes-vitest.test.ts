/**
 * API Routes Integration Tests
 * 
 * This file tests the API routes of the application by making HTTP requests
 * to a test instance of the Express app.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  
  // Test getting user information from the API
  it('should get user information', async () => {
    // Test the API endpoint
    const response = await request(app)
      .get('/api/user')
      .expect('Content-Type', /json/)
      .expect(200);
    
    // Verify we get a valid user object with expected properties
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('username');
    
    // Security check: Password should never be returned in the response
    expect(response.body).not.toHaveProperty('password');
    
    // Additional validation to ensure the user data is properly structured
    expect(typeof response.body.id).toBe('number');
    expect(typeof response.body.username).toBe('string');
  });
});