import { useState, useEffect, useCallback } from 'react';
import { webSocketClient, WebSocketMessage, UserRole, ConnectionStatus, WebSocketEventType } from '../lib/websocket';

/**
 * Hook options for useWebSocket
 */
interface UseWebSocketOptions {
  autoConnect?: boolean;
  initialRole?: UserRole;
  initialLanguage?: string;
}

/**
 * Hook for using WebSocket connection
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = false,
    initialRole = 'teacher',
    initialLanguage = 'en-US'
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>(webSocketClient.getStatus());
  const [sessionId, setSessionId] = useState<string | null>(webSocketClient.getSessionId());
  const [role, setRole] = useState<UserRole | null>(webSocketClient.getRole() || initialRole);
  const [languageCode, setLanguageCode] = useState<string>(webSocketClient.getLanguageCode() || initialLanguage);
  const [latestTranslation, setLatestTranslation] = useState<WebSocketMessage | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await webSocketClient.connect();
      // Register role and language after connection
      if (webSocketClient.getStatus() === 'connected') {
        webSocketClient.register(role as UserRole, languageCode);
      }
      return true;
    } catch (error) {
      console.error('Failed to connect:', error);
      return false;
    }
  }, [role, languageCode]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
  }, []);

  // Update role
  const updateRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    if (status === 'connected') {
      webSocketClient.register(newRole, languageCode);
    }
  }, [status, languageCode]);

  // Update language
  const updateLanguage = useCallback((newLanguageCode: string) => {
    setLanguageCode(newLanguageCode);
    if (status === 'connected' && role) {
      webSocketClient.register(role, newLanguageCode);
    }
  }, [status, role]);

  // Register role and language
  const register = useCallback((newRole: UserRole, newLanguageCode: string) => {
    setRole(newRole);
    setLanguageCode(newLanguageCode);
    if (status === 'connected') {
      webSocketClient.register(newRole, newLanguageCode);
    }
  }, [status]);

  // Send transcription
  const sendTranscription = useCallback((text: string) => {
    if (webSocketClient.getStatus() !== 'connected') {
      console.warn('[useWebSocket] Cannot send transcription - not connected');
      return false;
    }
    // The client function now returns a boolean indicating success
    return webSocketClient.sendTranscription(text);
  }, []);

  // Add event listener
  const addEventListener = useCallback((type: WebSocketEventType, callback: (data?: any) => void) => {
    webSocketClient.addEventListener(type, callback);
    return () => {
      webSocketClient.removeEventListener(type, callback);
    };
  }, []);

  // Remove event listener (added for compatibility with TestPage)
  const removeEventListener = useCallback((type: WebSocketEventType, callback: (data?: any) => void) => {
    webSocketClient.removeEventListener(type, callback);
  }, []);

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
    webSocketClient.addEventListener('status', handleStatusChange);
    webSocketClient.addEventListener('message', handleMessage);
    webSocketClient.addEventListener('translation', handleTranslation);

    // Auto-connect if option is enabled
    if (autoConnect) {
      connect().catch(console.error);
    }

    // Remove event listeners on cleanup
    return () => {
      webSocketClient.removeEventListener('status', handleStatusChange);
      webSocketClient.removeEventListener('message', handleMessage);
      webSocketClient.removeEventListener('translation', handleTranslation);
    };
  }, [autoConnect, connect]);

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