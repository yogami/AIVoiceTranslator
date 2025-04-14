import { useState, useEffect, useCallback } from 'react';
import { wsClient, WebSocketStatus, UserRole } from '@/lib/websocket';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  role?: UserRole;
  languageCode?: string;
  onMessage?: (data: any) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [status, setStatus] = useState<WebSocketStatus>(wsClient.getStatus());
  const [sessionId, setSessionId] = useState<string | null>(wsClient.getSessionId());
  const [role, setRole] = useState<UserRole>(options.role || 'student');
  const [languageCode, setLanguageCode] = useState(options.languageCode || 'en-US');

  // Handle connection status changes
  useEffect(() => {
    const handleStatusChange = (newStatus: WebSocketStatus) => {
      setStatus(newStatus);
      options.onStatusChange?.(newStatus);
    };

    wsClient.addEventListener('status', handleStatusChange);
    
    // Auto connect if specified
    if (options.autoConnect) {
      wsClient.connect();
    }
    
    return () => {
      wsClient.removeEventListener('status', handleStatusChange);
    };
  }, [options.autoConnect, options.onStatusChange]);

  // Handle session ID updates
  useEffect(() => {
    const handleSessionUpdate = (sid: string) => {
      setSessionId(sid);
    };
    
    wsClient.addEventListener('sessionId', handleSessionUpdate);
    
    return () => {
      wsClient.removeEventListener('sessionId', handleSessionUpdate);
    };
  }, []);

  // Handle generic messages
  useEffect(() => {
    if (!options.onMessage) return;
    
    const handleMessage = (data: any) => {
      options.onMessage?.(data);
    };
    
    wsClient.addEventListener('message', handleMessage);
    
    return () => {
      wsClient.removeEventListener('message', handleMessage);
    };
  }, [options.onMessage]);

  // Handle errors
  useEffect(() => {
    if (!options.onError) return;
    
    const handleError = (error: any) => {
      options.onError?.(error);
    };
    
    wsClient.addEventListener('error', handleError);
    
    return () => {
      wsClient.removeEventListener('error', handleError);
    };
  }, [options.onError]);

  // Update role and language when changed
  useEffect(() => {
    if (role !== options.role && options.role) {
      setRole(options.role);
    }
    
    if (languageCode !== options.languageCode && options.languageCode) {
      setLanguageCode(options.languageCode);
    }
  }, [options.role, options.languageCode, role, languageCode]);

  // Register when role or language changes
  useEffect(() => {
    if (status === 'connected') {
      // For teacher role, use the locked method to prevent future changes
      if (role === 'teacher') {
        wsClient.setRoleAndLock('teacher');
      } else {
        wsClient.register(role, languageCode);
      }
    }
  }, [role, languageCode, status]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    wsClient.connect();
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  // Send audio data
  const sendAudio = useCallback((audioData: string) => {
    return wsClient.sendAudio(audioData);
  }, []);

  // Update role
  const updateRole = useCallback((newRole: UserRole) => {
    setRole(newRole);
    if (status === 'connected') {
      // For critical 'teacher' role, use the locked method
      if (newRole === 'teacher') {
        wsClient.setRoleAndLock(newRole);
      } else {
        wsClient.register(newRole, languageCode);
      }
    }
  }, [status, languageCode]);

  // Update language
  const updateLanguage = useCallback((newLanguageCode: string) => {
    setLanguageCode(newLanguageCode);
    if (status === 'connected') {
      // Ensure we don't accidentally change the role when updating language
      if (role === 'teacher') {
        // For teacher role, preserve the role lock by using a special method
        const currentRoleInWsClient = (wsClient as any).role;
        if (currentRoleInWsClient === 'teacher') {
          // If already set as teacher and locked, simply send a register message
          wsClient.register('teacher', newLanguageCode);
        } else {
          // If not already locked as teacher, set and lock it
          wsClient.setRoleAndLock('teacher');
        }
      } else {
        wsClient.register(role, newLanguageCode);
      }
    }
  }, [status, role]);

  // Request transcripts
  const requestTranscripts = useCallback((language: string) => {
    if (!sessionId) return false;
    return wsClient.requestTranscripts(sessionId, language);
  }, [sessionId]);

  // Add event listener
  const addEventListener = useCallback((eventType: string, callback: (data: any) => void) => {
    wsClient.addEventListener(eventType, callback);
    return () => wsClient.removeEventListener(eventType, callback);
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
    addEventListener
  };
}
