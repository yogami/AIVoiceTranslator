import { useCallback, useEffect, useRef, useState } from 'react';
import { WebSpeechRecognizer, sendTranscribedText } from '@/lib/webSpeechAPI';
import { useWebSocket } from './useWebSocket';

interface WebSpeechHookProps {
  enabled?: boolean;
  language?: string;
  onTranscriptionUpdate?: (text: string, isFinal: boolean) => void;
}

export function useWebSpeech({
  enabled = false,
  language = 'en-US',
  onTranscriptionUpdate
}: WebSpeechHookProps = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<WebSpeechRecognizer | null>(null);
  
  const { socket, status: connectionStatus } = useWebSocket({
    autoConnect: true
  });

  // Initialize the speech recognizer
  useEffect(() => {
    try {
      const recognizer = new WebSpeechRecognizer({
        interimResults: true,
        languageCode: language
      });
      
      recognizerRef.current = recognizer;
      setIsSupported(recognizer.isSupported());
      
      return () => {
        if (recognizerRef.current) {
          recognizerRef.current.stop();
          recognizerRef.current = null;
        }
      };
    } catch (e) {
      console.error('Error initializing Web Speech API:', e);
      setError('Speech recognition is not supported in this browser');
      setIsSupported(false);
      return undefined;
    }
  }, []);
  
  // Update language if it changes
  useEffect(() => {
    if (recognizerRef.current && language) {
      recognizerRef.current.setLanguage(language);
    }
  }, [language]);
  
  // Set up the result handler
  useEffect(() => {
    if (!recognizerRef.current) return;
    
    recognizerRef.current.onResult((result) => {
      setCurrentTranscript(result.transcript);
      
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate(result.transcript, result.isFinal);
      }
      
      // If this is final transcription, send it to the server via WebSocket
      if (result.isFinal && socket && connectionStatus === 'connected') {
        sendTranscribedText(result.transcript, socket, language);
      }
    });
    
    recognizerRef.current.onError((error) => {
      console.error('Speech recognition error:', error);
      setError(`Speech recognition error: ${error.message || 'Unknown error'}`);
      setIsRecording(false);
    });
    
    recognizerRef.current.onEnd(() => {
      if (isRecording) {
        setIsRecording(false);
      }
    });
  }, [onTranscriptionUpdate, socket, connectionStatus, language, isRecording]);
  
  // Start recording
  const startRecording = useCallback(() => {
    if (!recognizerRef.current) {
      setError('Speech recognition is not initialized');
      return false;
    }
    
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return false;
    }
    
    try {
      const started = recognizerRef.current.start();
      if (started) {
        setIsRecording(true);
        setError(null);
      }
      return started;
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      setError(`Failed to start recording: ${e}`);
      return false;
    }
  }, [isSupported]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognizerRef.current && isRecording) {
      recognizerRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);
  
  // Auto-start recording if enabled
  useEffect(() => {
    if (enabled && !isRecording && isSupported && recognizerRef.current) {
      startRecording();
    } else if (!enabled && isRecording && recognizerRef.current) {
      stopRecording();
    }
  }, [enabled, isRecording, isSupported, startRecording, stopRecording]);
  
  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript: currentTranscript,
    isSupported,
    error
  };
}