/**
 * Simplified routes test that focuses on proper exports and structure
 * rather than trying to test the internal implementation
 */
import { describe, it, expect, vi } from 'vitest';
import { apiRoutes } from '../../server/routes';

vi.mock('../../server/storage', () => ({
  storage: {
    getLanguages: vi.fn(),
    getActiveLanguages: vi.fn(),
    getUser: vi.fn()
  }
}));

describe('API Routes Module', () => {
  it('should export apiRoutes as a Router object', () => {
    expect(apiRoutes).toBeDefined();
    expect(apiRoutes.stack).toBeDefined(); // Router has a stack property
    expect(Array.isArray(apiRoutes.stack)).toBe(true);
  });

  it('should define routes for languages', () => {
    const routes = apiRoutes.stack.map(layer => layer.route?.path).filter(Boolean);
    expect(routes).toContain('/languages');
    expect(routes).toContain('/languages/active');
  });

  it('should define a health check route', () => {
    const routes = apiRoutes.stack.map(layer => layer.route?.path).filter(Boolean);
    expect(routes).toContain('/health');
  });

  it('should define a user route', () => {
    const routes = apiRoutes.stack.map(layer => layer.route?.path).filter(Boolean);
    expect(routes).toContain('/user');
  });
});