import { useState, useEffect, useCallback } from 'react';
import { 
  WebSocketMessage, 
  UserRole, 
  ConnectionStatus, 
  WebSocketEventType, 
  IWebSocketClient,
  WebSocketService 
} from '../lib/websocket';

/**
 * Hook options for useWebSocket
 */
interface UseWebSocketOptions {
  autoConnect?: boolean;
  initialRole?: UserRole;
  initialLanguage?: string;
  client?: IWebSocketClient; // Allow dependency injection of client
}

/**
 * Custom React Hook for WebSocket connectivity
 * 
 * This hook implements the React-side of dependency injection by
 * accepting an optional WebSocket client instance. If not provided,
 * it will use the default client from WebSocketService.
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = false,
    initialRole = 'teacher',
    initialLanguage = 'en-US',
    client = WebSocketService.createClient() // Default client from service
  } = options;

  // Get initial state from provided or default client
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());
  const [sessionId, setSessionId] = useState<string | null>(client.getSessionId());
  const [role, setRole] = useState<UserRole | null>(client.getRole() || initialRole);
  const [languageCode, setLanguageCode] = useState<string>(client.getLanguageCode() || initialLanguage);
  const [latestTranslation, setLatestTranslation] = useState<WebSocketMessage | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await client.connect();
      // Register role and language after connection
      if (client.getStatus() === 'connected') {
        client.register(role as UserRole, languageCode);
      }
      return true;
    } catch (error) {
      console.error('[useWebSocket] Failed to connect:', error);
      return false;
    }
  }, [client, role, languageCode]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  // Update role
  const updateRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    if (status === 'connected') {
      client.register(newRole, languageCode);
    }
  }, [client, status, languageCode]);

  // Update language
  const updateLanguage = useCallback((newLanguageCode: string) => {
    setLanguageCode(newLanguageCode);
    if (status === 'connected' && role) {
      client.register(role, newLanguageCode);
    }
  }, [client, status, role]);

  // Register role and language
  const register = useCallback((newRole: UserRole, newLanguageCode: string) => {
    setRole(newRole);
    setLanguageCode(newLanguageCode);
    if (status === 'connected') {
      client.register(newRole, newLanguageCode);
    }
  }, [client, status]);

  // Send transcription
  const sendTranscription = useCallback((text: string) => {
    if (client.getStatus() !== 'connected') {
      console.warn('[useWebSocket] Cannot send transcription - not connected');
      return false;
    }
    // The client function returns a boolean indicating success
    return client.sendTranscription(text);
  }, [client]);

  // Add event listener
  const addEventListener = useCallback((type: WebSocketEventType, callback: (data?: any) => void) => {
    client.addEventListener(type, callback);
    return () => {
      client.removeEventListener(type, callback);
    };
  }, [client]);

  // Remove event listener
  const removeEventListener = useCallback((type: WebSocketEventType, callback: (data?: any) => void) => {
    client.removeEventListener(type, callback);
  }, [client]);

  // Setup event listeners
  useEffect(() => {
    // Status change listener
    const handleStatusChange = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };

    // Message listener
    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === 'connection' && message.sessionId) {
        setSessionId(message.sessionId);
      }
    };

    // Translation listener
    const handleTranslation = (translation: WebSocketMessage) => {
      setLatestTranslation(translation);
    };

    // Add event listeners
    client.addEventListener('status', handleStatusChange);
    client.addEventListener('message', handleMessage);
    client.addEventListener('translation', handleTranslation);

    // Auto-connect if option is enabled
    if (autoConnect) {
      connect().catch(console.error);
    }

    // Remove event listeners on cleanup
    return () => {
      client.removeEventListener('status', handleStatusChange);
      client.removeEventListener('message', handleMessage);
      client.removeEventListener('translation', handleTranslation);
    };
  }, [autoConnect, connect, client]);

  return {
    status,
    sessionId,
    role,
    languageCode,
    latestTranslation,
    connect,
    disconnect,
    register,
    updateRole,
    updateLanguage,
    sendTranscription,
    addEventListener,
    removeEventListener,
  };
}