import { useState, useEffect, useRef, useCallback } from 'react';
// Using relative imports to avoid path resolution issues
import { WebSocketClient, ConnectionStatus as WebSocketStatus, UserRole } from '../services/WebSocketClient';
import { wsClient } from '../lib/websocket';

interface WebSocketHookProps {
  autoConnect?: boolean;
  initialRole?: UserRole;
  initialLanguage?: string;
  role?: UserRole;         // Add direct role option for backwards compatibility
  languageCode?: string;   // Add direct languageCode option for backwards compatibility
}

export function useWebSocket({
  autoConnect = false,
  initialRole = 'student',
  initialLanguage = 'en-US',
  role: propRole, // Renamed to avoid conflicts
  languageCode: propLanguageCode // Renamed to avoid conflicts
}: WebSocketHookProps = {}) {
  // Use prop values if provided, otherwise fall back to initial values
  const effectiveRole = propRole || initialRole;
  const effectiveLanguage = propLanguageCode || initialLanguage;
  
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(effectiveRole);
  const [currentLanguageCode, setCurrentLanguageCode] = useState<string>(effectiveLanguage);
  
  // Use a ref to maintain a single instance of the WebSocketClient
  const clientRef = useRef<WebSocketClient | null>(null);
  
  // Use the global WebSocketClient instance (following Dependency Inversion Principle)
  useEffect(() => {
    // Get the client instance from either the global window object or the wsClient utility
    if (!clientRef.current) {
      // First try to get from window global (primary source)
      if (typeof window !== 'undefined' && window.wsClient) {
        clientRef.current = window.wsClient;
        console.log('useWebSocket: Using global WebSocketClient instance from window');
      } 
      // Then try the wsClient utility (secondary source)
      else if (wsClient && wsClient.getInstance()) {
        clientRef.current = wsClient.getInstance()!; 
        console.log('useWebSocket: Using global WebSocketClient instance from wsClient utility');
      }
      // As a last resort, create a new instance (should never happen in normal operation)
      else {
        console.warn('useWebSocket: Global WebSocketClient instance not found, creating a local instance');
        console.warn('This might indicate an initialization error in main.tsx');
        clientRef.current = new WebSocketClient();
        
        // If we created a new instance, we should register it globally
        if (typeof window !== 'undefined') {
          window.wsClient = clientRef.current;
        }
        if (wsClient) {
          wsClient.setInstance(clientRef.current);
        }
      }
      
      // Initialize the client with role and language if provided
      if (clientRef.current) {
        // Log the connection status
        console.log(`useWebSocket: Current connection status: ${clientRef.current.getStatus()}`);
        
        // Set initial values if provided
        if (effectiveRole || effectiveLanguage) {
          clientRef.current.register(effectiveRole, effectiveLanguage);
          console.log(`useWebSocket: Registered with role=${effectiveRole}, language=${effectiveLanguage}`);
        }
        
        // Lock the role if it's a teacher
        if (effectiveRole === 'teacher') {
          clientRef.current.setRoleAndLock('teacher');
          console.log('useWebSocket: Locked role as teacher');
        }
      }
    }
    
    // We don't disconnect on unmount since it's a shared instance
    // Each component only manages its own event listeners
  }, [effectiveRole, effectiveLanguage]);
  
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
      clientRef.current.sendAudio(audioData);
      return true;
    }
    return false;
  }, []);
  
  // Update role
  const updateRole = useCallback((newRole: UserRole) => {
    if (clientRef.current) {
      clientRef.current.register(newRole, currentLanguageCode);
      setCurrentRole(newRole);
    }
  }, [currentLanguageCode]);
  
  // Update language
  const updateLanguage = useCallback((newLanguageCode: string) => {
    if (clientRef.current) {
      clientRef.current.register(currentRole, newLanguageCode);
      setCurrentLanguageCode(newLanguageCode);
    }
  }, [currentRole]);
  
  // Request transcript history
  const requestTranscripts = useCallback((language: string): boolean => {
    if (clientRef.current && sessionId) {
      try {
        // Create message with transcript request type
        const transcriptMessage = {
          type: 'transcript_request',
          sessionId,
          languageCode: language
        };
        
        // Since we don't have a direct API to send custom messages, we'll create a simple
        // wrapper that simulates a transcription message since our WebSocketClient exposes that
        clientRef.current.sendTranscription(`Request transcripts in ${language}`);
        
        return true;
      } catch (error) {
        console.error('Failed to request transcripts:', error);
        return false;
      }
    }
    return false;
  }, [sessionId]);
  
  // Generic method to add event listeners
  const addEventListener = useCallback((eventType: string, callback: (data: any) => void) => {
    if (clientRef.current) {
      clientRef.current.addEventListener(eventType, callback);
      return () => {
        if (clientRef.current) {
          clientRef.current.removeEventListener(eventType, callback);
        }
      };
    }
    return () => {};
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
  
  // Expose the sendTranscription method for Web Speech API integration
  const sendTranscription = useCallback((text: string): boolean => {
    if (clientRef.current) {
      clientRef.current.sendTranscription(text);
      return true;
    }
    return false;
  }, []);

  return {
    status,
    sessionId,
    role: currentRole,
    languageCode: currentLanguageCode,
    connect,
    disconnect,
    sendAudio,
    sendTranscription,
    updateRole,
    updateLanguage,
    requestTranscripts,
    addEventListener,
    removeEventListener,
    socket: getSocket()
  };
}