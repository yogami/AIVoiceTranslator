import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketClient, WebSocketStatus, UserRole } from '@/lib/websocket';

interface WebSocketHookProps {
  autoConnect?: boolean;
  initialRole?: UserRole;
  initialLanguage?: string;
}

export function useWebSocket({
  autoConnect = false,
  initialRole = 'student',
  initialLanguage = 'en-US'
}: WebSocketHookProps = {}) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [languageCode, setLanguageCode] = useState<string>(initialLanguage);
  
  // Use a ref to maintain a single instance of the WebSocketClient
  const clientRef = useRef<WebSocketClient | null>(null);
  
  // Create the client instance if it doesn't exist
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new WebSocketClient();
      
      // Set initial values
      if (initialRole) {
        clientRef.current.register(initialRole, initialLanguage);
      }
    }
    
    return () => {
      // Clean up on component unmount
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [initialRole, initialLanguage]);
  
  // Set up event listeners
  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    
    // Status change handler
    const handleStatusChange = (newStatus: WebSocketStatus) => {
      setStatus(newStatus);
    };
    
    // Session ID handler
    const handleSessionId = (id: string) => {
      setSessionId(id);
    };
    
    // Register event listeners
    client.addEventListener('status', handleStatusChange);
    client.addEventListener('sessionId', handleSessionId);
    
    // Auto-connect if specified
    if (autoConnect && status === 'disconnected') {
      client.connect();
    }
    
    return () => {
      // Clean up event listeners
      client.removeEventListener('status', handleStatusChange);
      client.removeEventListener('sessionId', handleSessionId);
    };
  }, [autoConnect, status]);
  
  // Connect method
  const connect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.connect();
    }
  }, []);
  
  // Disconnect method
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);
  
  // Send audio data
  const sendAudio = useCallback((audioData: string): boolean => {
    if (clientRef.current) {
      return clientRef.current.sendAudio(audioData);
    }
    return false;
  }, []);
  
  // Update role
  const updateRole = useCallback((newRole: UserRole) => {
    if (clientRef.current) {
      clientRef.current.register(newRole, languageCode);
      setRole(newRole);
    }
  }, [languageCode]);
  
  // Update language
  const updateLanguage = useCallback((newLanguageCode: string) => {
    if (clientRef.current) {
      clientRef.current.register(role, newLanguageCode);
      setLanguageCode(newLanguageCode);
    }
  }, [role]);
  
  // Request transcript history
  const requestTranscripts = useCallback((language: string): boolean => {
    if (clientRef.current && sessionId) {
      return clientRef.current.send({
        type: 'transcript_request',
        payload: {
          sessionId,
          languageCode: language
        }
      });
    }
    return false;
  }, [sessionId]);
  
  // Generic method to add event listeners
  const addEventListener = useCallback((eventType: string, callback: (data: any) => void) => {
    if (clientRef.current) {
      clientRef.current.addEventListener(eventType, callback);
    }
  }, []);
  
  // Generic method to remove event listeners
  const removeEventListener = useCallback((eventType: string, callback: (data: any) => void) => {
    if (clientRef.current) {
      clientRef.current.removeEventListener(eventType, callback);
    }
  }, []);
  
  // Get the WebSocket instance for direct use
  const getSocket = useCallback((): WebSocket | null => {
    if (clientRef.current) {
      return clientRef.current.getSocket();
    }
    return null;
  }, []);
  
  return {
    status,
    sessionId,
    role,
    languageCode,
    connect,
    disconnect,
    sendAudio,
    updateRole,
    updateLanguage,
    requestTranscripts,
    addEventListener,
    removeEventListener,
    socket: getSocket()
  };
}