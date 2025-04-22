import { useState, useEffect, useCallback } from 'react';
import { webSocketClient, WebSocketMessage, UserRole, ConnectionStatus, WebSocketEventType } from '../lib/websocket';

/**
 * Hook for using WebSocket connection
 */
export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>(webSocketClient.getStatus());
  const [sessionId, setSessionId] = useState<string | null>(webSocketClient.getSessionId());
  const [role, setRole] = useState<UserRole | null>(webSocketClient.getRole());
  const [languageCode, setLanguageCode] = useState<string>(webSocketClient.getLanguageCode());
  const [latestTranslation, setLatestTranslation] = useState<WebSocketMessage | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await webSocketClient.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect:', error);
      return false;
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    webSocketClient.disconnect();
  }, []);

  // Register role and language
  const register = useCallback((newRole: UserRole, newLanguageCode: string) => {
    webSocketClient.register(newRole, newLanguageCode);
    setRole(newRole);
    setLanguageCode(newLanguageCode);
  }, []);

  // Send transcription
  const sendTranscription = useCallback((text: string) => {
    webSocketClient.sendTranscription(text);
  }, []);

  // Add event listener
  const addEventListener = useCallback((type: WebSocketEventType, callback: (data?: any) => void) => {
    webSocketClient.addEventListener(type, callback);
    return () => {
      webSocketClient.removeEventListener(type, callback);
    };
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

    // Remove event listeners on cleanup
    return () => {
      webSocketClient.removeEventListener('status', handleStatusChange);
      webSocketClient.removeEventListener('message', handleMessage);
      webSocketClient.removeEventListener('translation', handleTranslation);
    };
  }, []);

  return {
    status,
    sessionId,
    role,
    languageCode,
    latestTranslation,
    connect,
    disconnect,
    register,
    sendTranscription,
    addEventListener,
  };
}