/**
 * Unit tests for CommunicationProtocolFactory
 * 
 * Tests the environment-based protocol creation and switching capability.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommunicationProtocolFactory } from '../../server/services/communication/CommunicationProtocolFactory';

describe('CommunicationProtocolFactory', () => {
  let originalProtocol: string | undefined;

  beforeEach(() => {
    // Save original environment variable
    originalProtocol = process.env.COMMUNICATION_PROTOCOL;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalProtocol !== undefined) {
      process.env.COMMUNICATION_PROTOCOL = originalProtocol;
    } else {
      delete process.env.COMMUNICATION_PROTOCOL;
    }
  });

  describe('Protocol Creation', () => {
    it('should create WebSocket protocol by default', () => {
      delete process.env.COMMUNICATION_PROTOCOL;
      
      const protocol = CommunicationProtocolFactory.createFromEnvironment();
      
      expect(protocol).toBeDefined();
      expect(protocol.name).toBe('websocket');
    });

    it('should create WebSocket protocol when explicitly set', () => {
      process.env.COMMUNICATION_PROTOCOL = 'websocket';
      
      const protocol = CommunicationProtocolFactory.createFromEnvironment();
      
      expect(protocol).toBeDefined();
      expect(protocol.name).toBe('websocket');
    });

    it('should create WebRTC protocol when set in environment', () => {
      process.env.COMMUNICATION_PROTOCOL = 'webrtc';
      
      const protocol = CommunicationProtocolFactory.createFromEnvironment();
      
      expect(protocol).toBeDefined();
      expect(protocol.name).toBe('webrtc');
    });

    it('should create specific protocol types directly', () => {
      const websocketProtocol = CommunicationProtocolFactory.create('websocket');
      const webrtcProtocol = CommunicationProtocolFactory.create('webrtc');
      
      expect(websocketProtocol.name).toBe('websocket');
      expect(webrtcProtocol.name).toBe('webrtc');
    });

    it('should throw error for unsupported protocol', () => {
      expect(() => {
        CommunicationProtocolFactory.create('invalid' as any);
      }).toThrow('Unsupported protocol type: invalid');
    });
  });

  describe('Protocol Registration', () => {
    it('should support registering custom protocols', () => {
      const mockProtocol = {
        name: 'custom',
        createServer: () => ({
          getConnections: () => [],
          getConnection: () => undefined,
          getConnectionCount: () => 0,
          getTeacherConnections: () => [],
          getStudentConnections: () => [],
          getConnectionsByRole: () => [],
          getConnectionsBySession: () => [],
          broadcast: async () => {},
          broadcastToRole: async () => {},
          broadcastToSession: async () => {},
          start: async () => {},
          stop: async () => {},
          onConnection: () => {},
          onDisconnection: () => {},
        }),
        createClient: async () => ({
          id: 'test',
          isConnected: true,
          getRemoteAddress: () => '127.0.0.1',
          getUserRole: () => 'student',
          getSessionId: () => 'test-session',
          setSessionId: () => {},
          setUserRole: () => {},
          send: async () => {},
          close: async () => {},
          onMessage: () => {},
          onClose: () => {},
          onError: () => {},
        })
      };

      CommunicationProtocolFactory.registerProtocol('custom' as any, () => mockProtocol);
      const protocol = CommunicationProtocolFactory.create('custom' as any);
      
      expect(protocol.name).toBe('custom');
    });

    it('should list supported protocols', () => {
      const protocols = CommunicationProtocolFactory.getSupportedProtocols();
      
      expect(protocols).toContain('websocket');
      expect(protocols).toContain('webrtc');
      expect(protocols.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Environment Variable Validation', () => {
    it('should handle invalid environment values gracefully', () => {
      process.env.COMMUNICATION_PROTOCOL = 'invalid';
      
      expect(() => {
        CommunicationProtocolFactory.createFromEnvironment();
      }).toThrow('Unsupported protocol type: invalid');
    });

    it('should be case sensitive', () => {
      process.env.COMMUNICATION_PROTOCOL = 'WEBSOCKET';
      
      expect(() => {
        CommunicationProtocolFactory.createFromEnvironment();
      }).toThrow('Unsupported protocol type: WEBSOCKET');
    });

    it('should handle empty string as default', () => {
      process.env.COMMUNICATION_PROTOCOL = '';
      
      const protocol = CommunicationProtocolFactory.createFromEnvironment();
      expect(protocol.name).toBe('websocket');
    });
  });
});
