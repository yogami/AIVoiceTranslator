/**
 * WebSocket Integration for AIVoiceTranslator
 * 
 * This module handles WebSocket connections and message processing,
 * providing a React-friendly interface.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

// Types for WebSocket messages
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface TranslationMessage extends WebSocketMessage {
  type: 'translation';
  text: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  audioData?: string;
  useClientSpeech?: boolean;
  ttsServiceType?: string;
}

export interface ConnectionStatusMessage extends WebSocketMessage {
  type: 'connectionStatus';
  sessionId: string;
  connected: boolean;
}

export interface TeacherStatusMessage extends WebSocketMessage {
  type: 'teacherStatus';
  active: boolean;
  languageCode?: string;
}

// Type for WebSocket connection status
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Helper function to create WebSocket URL
export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

// Hook for managing WebSocket connection
export function useWebSocket(onMessage?: (message: WebSocketMessage) => void) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const messageHandlerRef = useRef(onMessage);

  // Update the message handler reference when it changes
  useEffect(() => {
    messageHandlerRef.current = onMessage;
  }, [onMessage]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || 
                              socketRef.current.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    try {
      setConnectionState('connecting');
      const wsUrl = getWebSocketUrl();
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        setConnectionState('connected');
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          if (message.type === 'connectionStatus' && (message as ConnectionStatusMessage).sessionId) {
            setSessionId((message as ConnectionStatusMessage).sessionId);
          }

          if (messageHandlerRef.current) {
            messageHandlerRef.current(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed');
        setConnectionState('disconnected');
        setSessionId(null);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
      };

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      setConnectionState('error');
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnectionState('disconnected');
      setSessionId(null);
    }
  }, []);

  // Send message to WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Register as student or teacher
  const register = useCallback((role: 'student' | 'teacher', languageCode: string) => {
    return sendMessage({
      type: 'register',
      role,
      languageCode
    });
  }, [sendMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return {
    connectionState,
    sessionId,
    connect,
    disconnect,
    sendMessage,
    register,
    socket: socketRef.current
  };
}

// Hook for managing student WebSocket connection
export function useStudentWebSocket(languageCode: string) {
  const [translations, setTranslations] = useState<TranslationMessage[]>([]);
  const [teacherActive, setTeacherActive] = useState(false);
  const [teacherLanguage, setTeacherLanguage] = useState<string | null>(null);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'translation') {
      const translationMsg = message as TranslationMessage;
      setTranslations(prev => [...prev, translationMsg]);
    } else if (message.type === 'teacherStatus') {
      const statusMsg = message as TeacherStatusMessage;
      setTeacherActive(statusMsg.active);
      if (statusMsg.languageCode) {
        setTeacherLanguage(statusMsg.languageCode);
      }
    }
  }, []);
  
  const {
    connectionState,
    sessionId,
    connect,
    disconnect,
    register,
    sendMessage
  } = useWebSocket(handleMessage);
  
  // Connect and register as student when the component mounts
  useEffect(() => {
    connect();
  }, [connect]);
  
  // Register with the current language code when connected or when language changes
  useEffect(() => {
    if (connectionState === 'connected') {
      register('student', languageCode);
    }
  }, [connectionState, languageCode, register]);
  
  return {
    connectionState,
    sessionId,
    translations,
    teacherActive,
    teacherLanguage,
    connect,
    disconnect,
    sendMessage
  };
}

// Hook for managing teacher WebSocket connection
export function useTeacherWebSocket(languageCode: string) {
  const [studentCount, setStudentCount] = useState(0);
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'studentCount') {
      setStudentCount(message.count);
    }
  }, []);
  
  const {
    connectionState,
    sessionId,
    connect,
    disconnect,
    register,
    sendMessage
  } = useWebSocket(handleMessage);
  
  // Connect and register as teacher when the component mounts
  useEffect(() => {
    connect();
  }, [connect]);
  
  // Register with the current language code when connected or when language changes
  useEffect(() => {
    if (connectionState === 'connected') {
      register('teacher', languageCode);
    }
  }, [connectionState, languageCode, register]);
  
  return {
    connectionState,
    sessionId,
    studentCount,
    connect,
    disconnect,
    sendMessage
  };
}