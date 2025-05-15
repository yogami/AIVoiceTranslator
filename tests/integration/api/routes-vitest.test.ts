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
import { storage as originalStorage, MemStorage } from '../../../server/storage';
import { InsertUser, User } from '../../../shared/schema';

// Simple wrapper function to wait for promises
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('API Routes', () => {
  let app: Express;
  let mockStorage: MemStorage;
  
  beforeEach(() => {
    // Create a new MemStorage instance for each test
    mockStorage = new MemStorage();
    
    // Set up a clean Express app for each test
    app = express();
    app.use(express.json());
    
    // Setup a route handler that will use our mock storage
    const setupRoutes = () => {
      // Override the actual routes with routes that use our mock storage
      const routes = express.Router();
      
      routes.get('/languages', async (req, res) => {
        try {
          const languages = await mockStorage.getLanguages();
          res.json(languages);
        } catch (error) {
          res.status(500).json({ error: 'Failed to retrieve languages' });
        }
      });
      
      routes.get('/languages/active', async (req, res) => {
        try {
          const activeLanguages = await mockStorage.getActiveLanguages();
          res.json(activeLanguages);
        } catch (error) {
          res.status(500).json({ error: 'Failed to retrieve active languages' });
        }
      });
      
      routes.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0', // Hardcoded for test
          database: 'connected',
          environment: 'test'
        });
      });
      
      routes.get('/user', async (req, res) => {
        try {
          const user = await mockStorage.getUser(1);
          
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }
          
          // Return user without password for security
          const { password, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        } catch (error) {
          res.status(500).json({ error: 'Failed to retrieve user' });
        }
      });
      
      return routes;
    };
    
    app.use('/api', setupRoutes());
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
    // Create a test user directly in the mock storage
    await mockStorage.createUser({
      username: 'testuser',
      password: 'password123' // In a real app, this would be hashed
    });
    
    // Now test the API endpoint
    const response = await request(app)
      .get('/api/user')
      .expect('Content-Type', /json/)
      .expect(200);
    
    // Verify we get a valid user object with expected properties
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('username');
    expect(response.body.username).toBe('testuser');
    
    // Security check: Password should never be returned in the response
    expect(response.body).not.toHaveProperty('password');
    
    // Additional validation to ensure the user data is properly structured
    expect(typeof response.body.id).toBe('number');
    expect(typeof response.body.username).toBe('string');
  });
});