/**
 * React Hook for WebSocket functionality
 * 
 * Provides a clean interface for components to interact with the WebSocket service
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketService, WebSocketMessage, UserRole } from '@/services/WebSocketService';

export interface UseWebSocketOptions {
  role: UserRole;
  languageCode: string;
  classroomCode?: string;
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (message: WebSocketMessage) => void;
  updateLanguage: (languageCode: string) => void;
  on: (messageType: string, handler: (message: WebSocketMessage) => void) => () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { role, languageCode: initialLanguage, classroomCode, autoConnect = true } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [languageCode, setLanguageCode] = useState(initialLanguage);
  const wsRef = useRef<WebSocketService | null>(null);

  // Initialize WebSocket service
  useEffect(() => {
    wsRef.current = new WebSocketService(role, languageCode, classroomCode);
    
    // Set up connection state listener
    const checkConnection = setInterval(() => {
      if (wsRef.current) {
        setIsConnected(wsRef.current.isConnected());
      }
    }, 1000);

    // Auto-connect if enabled
    if (autoConnect) {
      wsRef.current.connect().catch(console.error);
    }

    // Cleanup
    return () => {
      clearInterval(checkConnection);
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [role, classroomCode]); // Don't include languageCode to avoid reconnects

  const connect = useCallback(async () => {
    if (wsRef.current) {
      await wsRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current) {
      wsRef.current.send(message);
    }
  }, []);

  const updateLanguage = useCallback((newLanguageCode: string) => {
    setLanguageCode(newLanguageCode);
    if (wsRef.current) {
      wsRef.current.updateLanguage(newLanguageCode);
    }
  }, []);

  const on = useCallback((messageType: string, handler: (message: WebSocketMessage) => void) => {
    if (wsRef.current) {
      return wsRef.current.on(messageType, handler);
    }
    return () => {}; // Return no-op unsubscribe if no WebSocket
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    send,
    updateLanguage,
    on
  };
} 