import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { log, setupVite, serveStatic } from '../../server/vite';

// Mock dependencies
vi.mock('vite', () => ({
  createServer: vi.fn().mockResolvedValue({
    middlewares: { use: vi.fn() },
    transformIndexHtml: vi.fn(),
    ssrFixStacktrace: vi.fn()
  }),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clearScreen: vi.fn()
  })
}));

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn()
  },
  existsSync: vi.fn()
}));

vi.mock('path', () => ({
  resolve: vi.fn().mockImplementation((...args) => args.join('/'))
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid')
}));

// Mock import.meta
vi.mock('import.meta', () => ({
  dirname: '/mock/dirname'
}), { virtual: true });

// Mock console.log
vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock Express and HTTP server
const mockUse = vi.fn();
const mockGet = vi.fn();
const mockApp = {
  use: mockUse,
  get: mockGet
} as unknown as express.Express;

const mockServer = {
  on: vi.fn(),
  listen: vi.fn()
} as unknown as ReturnType<typeof createServer>;

describe('Vite Server Utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should log messages with formatted time and source', () => {
      // Mock Date for consistent output
      const mockDate = new Date('2023-01-01T12:00:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      // Act
      log('Test message');
      log('Another message', 'custom-source');
      
      // Assert
      expect(console.log).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenNthCalledWith(1, '12:00:00 PM [express] Test message');
      expect(console.log).toHaveBeenNthCalledWith(2, '12:00:00 PM [custom-source] Another message');
    });
  });

  describe('setupVite', () => {
    it('should set up Vite middleware and catch-all route handler', async () => {
      // Import the mocked createServer
      const { createServer: mockCreateViteServer } = await import('vite');
      const mockVite = {
        middlewares: { use: vi.fn() },
        transformIndexHtml: vi.fn().mockResolvedValue('<html>Transformed Content</html>'),
        ssrFixStacktrace: vi.fn()
      };
      vi.mocked(mockCreateViteServer).mockResolvedValue(mockVite);
      
      // Mock readFile
      vi.mocked(fs.promises.readFile).mockResolvedValue('<html><body><script src="/src/main.tsx"></script></body></html>');
      
      // Mock the middleware handler
      const middleware = vi.fn();
      mockUse.mockImplementation((path, handler) => {
        if (path === '*') {
          // Simulate a request
          const req = { originalUrl: '/test' };
          const res = { 
            status: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            end: vi.fn()
          };
          const next = vi.fn();
          handler(req, res, next);
          middleware(req, res, next);
        }
      });
      
      // Act
      await setupVite(mockApp, mockServer);
      
      // Assert
      expect(mockCreateViteServer).toHaveBeenCalled();
      expect(mockUse).toHaveBeenCalledWith(mockVite.middlewares);
      expect(mockUse).toHaveBeenCalledWith('*', expect.any(Function));
      expect(fs.promises.readFile).toHaveBeenCalled();
      expect(mockVite.transformIndexHtml).toHaveBeenCalled();
    });

    it('should handle errors in the catch-all route handler', async () => {
      // Import the mocked createServer
      const { createServer: mockCreateViteServer } = await import('vite');
      const mockVite = {
        middlewares: { use: vi.fn() },
        transformIndexHtml: vi.fn().mockRejectedValue(new Error('Transform error')),
        ssrFixStacktrace: vi.fn()
      };
      vi.mocked(mockCreateViteServer).mockResolvedValue(mockVite);
      
      // Mock readFile
      vi.mocked(fs.promises.readFile).mockResolvedValue('<html><body><script src="/src/main.tsx"></script></body></html>');
      
      // Mock the middleware handler
      const middleware = vi.fn();
      mockUse.mockImplementation((path, handler) => {
        if (path === '*') {
          // Simulate a request
          const req = { originalUrl: '/test' };
          const res = { 
            status: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            end: vi.fn()
          };
          const next = vi.fn();
          handler(req, res, next);
          middleware(req, res, next);
        }
      });
      
      // Act
      await setupVite(mockApp, mockServer);
      
      // Assert
      expect(mockVite.ssrFixStacktrace).toHaveBeenCalled();
    });
  });

  describe('serveStatic', () => {
    it('should set up static file serving when dist path exists', () => {
      // Mock fs.existsSync to return true
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      // Mock express.static
      const mockStatic = vi.fn().mockReturnValue('static-middleware');
      vi.spyOn(express, 'static').mockImplementation(mockStatic);
      
      // Mock app.use
      const mockSendFile = vi.fn();
      mockUse.mockImplementation((path, handler) => {
        if (path === '*') {
          // Simulate a request
          const req = {};
          const res = { sendFile: mockSendFile };
          handler(req, res);
        }
      });
      
      // Act
      serveStatic(mockApp);
      
      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(express.static).toHaveBeenCalled();
      expect(mockUse).toHaveBeenCalledWith('static-middleware');
      expect(mockUse).toHaveBeenCalledWith('*', expect.any(Function));
      expect(mockSendFile).toHaveBeenCalled();
    });

    it('should throw an error when dist path does not exist', () => {
      // Mock fs.existsSync to return false
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      // Act & Assert
      expect(() => serveStatic(mockApp)).toThrow(
        /Could not find the build directory/
      );
    });
  });
});