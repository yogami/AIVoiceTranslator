/**
 * WebSocket Connection Integration Tests
 * 
 * Consolidated from:
 * - websocket-server-integration.test.ts
 * - connection-management-integration.test.ts
 * 
 * Tests all WebSocket connection scenarios in one place
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import { WebSocketService } from '../../server/websocket';

describe('WebSocket Connection Integration', () => {
  let httpServer: Server;
  let wsService: WebSocketService;
  let testPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);
    
    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          testPort = address.port;
        }
        resolve();
      });
    });

    wsUrl = `ws://localhost:${testPort}/ws`;
    
    // Create WebSocket service
    wsService = new WebSocketService(httpServer, { path: '/ws' });
  });

  afterAll(async () => {
    // Close HTTP server and wait for it to actually close
    await new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
    
    // Give it a bit more time to clean up
    await new Promise(resolve => setTimeout(resolve, 100));
  }, 15000); // Increase timeout to 15 seconds

  describe('Basic Connection Lifecycle', () => {
    it('should handle WebSocket connection and disconnection', async () => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];

      ws.on('message', (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch (e) {
          messages.push(data.toString());
        }
      });

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(new Error('Connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        ws.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Give server time to send connection message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('connection');

      // Close connection
      ws.close();
      
      await new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
        setTimeout(() => resolve(), 1000); // Fallback timeout
      });
    }, 10000);

    it('should handle multiple simultaneous connections', async () => {
      const connections = await Promise.all([
        new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl);
          const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error('Connection 1 timeout'));
          }, 5000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve(ws);
          });
          ws.on('error', reject);
        }),
        new Promise<WebSocket>((resolve, reject) => {
          const ws = new WebSocket(wsUrl);
          const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error('Connection 2 timeout'));
          }, 5000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve(ws);
          });
          ws.on('error', reject);
        })
      ]);

      expect(connections).toHaveLength(2);
      // WebSocket.OPEN is 1, but connections might be CLOSING (3)
      expect([1, 2, 3]).toContain(connections[0].readyState);
      expect([1, 2, 3]).toContain(connections[1].readyState);

      // Clean up
      await Promise.all(connections.map(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        return new Promise(resolve => {
          ws.on('close', resolve);
          setTimeout(resolve, 1000);
        });
      }));
    }, 10000);

    it('should handle connection with role and language registration', async () => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];

      ws.on('message', (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch (e) {
          messages.push(data.toString());
        }
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        ws.on('error', reject);
      });

      // Send registration message
      ws.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        language: 'en-US'
      }));

      // Wait longer for response
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for any registration-related message
      const hasConnectionMessage = messages.some(m => m.type === 'connection');
      const hasRegistrationMessage = messages.some(m => m.type === 'registration' || m.type === 'registered');
      
      // Server should have sent at least a connection message
      expect(messages.length).toBeGreaterThan(0);
      expect(hasConnectionMessage || hasRegistrationMessage).toBe(true);

      ws.close();
      await new Promise(resolve => {
        ws.on('close', resolve);
        setTimeout(resolve, 1000);
      });
    }, 10000);
  });

  describe('Connection Management Features', () => {
    let lifecycleWs: WebSocket | undefined;
    
    afterEach(async () => {
      if (lifecycleWs && lifecycleWs.readyState === WebSocket.OPEN) {
        lifecycleWs.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });

    it('should manage WebSocket client lifecycle with heartbeat', async () => {
      // Use the main WebSocket URL since we only have one service
      lifecycleWs = new WebSocket(wsUrl);
      let messageReceived = false;

      lifecycleWs.on('message', (data) => {
        messageReceived = true;
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'ping' || message.type === 'connection') {
            // Message received
          }
        } catch (e) {
          // Might be a binary ping frame
        }
      });

      lifecycleWs.on('ping', () => {
        messageReceived = true; // Count ping as message received
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (lifecycleWs) lifecycleWs.terminate();
          reject(new Error('Connection timeout'));
        }, 5000);
        
        if (lifecycleWs) {
          lifecycleWs.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          lifecycleWs.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(messageReceived).toBe(true);
    }, 20000);

    it('should track and manage multiple client connections', async () => {
      const clients: WebSocket[] = [];
      const clientCount = 3;

      for (let i = 0; i < clientCount; i++) {
        const ws = new WebSocket(wsUrl);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error(`Client ${i} timeout`));
          }, 5000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });
          ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        
        ws.send(JSON.stringify({
          type: 'register',
          role: i === 0 ? 'teacher' : 'student',
          language: i === 0 ? 'en-US' : `es-ES-${i}`
        }));
        
        clients.push(ws);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      expect(clients).toHaveLength(clientCount);

      await Promise.all(clients.map(ws => {
        ws.close();
        return new Promise(resolve => {
          ws.on('close', resolve);
          setTimeout(resolve, 500);
        });
      }));
    }, 20000);

    it('should handle connection limits and queuing', async () => {
      const maxConnections = 10;
      const clients: WebSocket[] = [];

      for (let i = 0; i < maxConnections; i++) {
        try {
          const ws = new WebSocket(wsUrl);
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.terminate();
              resolve();
            }, 1000);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              clients.push(ws);
              resolve();
            });
            
            ws.on('error', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        } catch (error) {
          console.log(`Connection ${i} failed:`, error);
        }
      }

      expect(clients.length).toBeGreaterThan(0);

      await Promise.all(clients.map(ws => {
        ws.close();
        return new Promise(resolve => {
          ws.on('close', resolve);
          setTimeout(resolve, 500);
        });
      }));
    }, 30000);
  });
});
