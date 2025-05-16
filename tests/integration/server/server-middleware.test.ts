/**
 * Server Middleware Integration Test
 * 
 * Tests the server middleware functionality without mocking Express
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import { configureCorsMiddleware } from '../../../server/server';
import supertest from 'supertest';

// Create a properly typed version of supertest
const request = supertest;

describe('Server Middleware Integration', () => {
  it('should properly set up CORS middleware', async () => {
    // Arrange - Create a real Express app
    const app = express();
    
    // Apply the middleware we want to test
    configureCorsMiddleware(app);
    
    // Add a test endpoint
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });
    
    // Act & Assert
    const response = await request(app)
      .get('/test')
      .expect(200);
    
    // Check that CORS headers are set
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should handle OPTIONS requests correctly', async () => {
    // Arrange - Create a real Express app
    const app = express();
    
    // Apply the middleware we want to test
    configureCorsMiddleware(app);
    
    // Act & Assert
    await request(app)
      .options('/any-path')
      .expect(200);
  });
});