import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TranscriptionService, 
  TranscriptionResult,
  TranscriptionError,
  TranscriptionOptions,
  TranscriptionListeners
} from '@/lib/transcription/TranscriptionService';
import { 
  TranscriptionFactory, 
  TranscriptionServiceType 
} from '@/lib/transcription/TranscriptionFactory';
import { useWebSocket } from './useWebSocket';
import { WebSocketStatus } from '@/lib/websocket';

// Configuration interface for the hook
interface TranscriptionHookOptions {
  serviceType?: TranscriptionServiceType | 'auto';
  preferredOrder?: TranscriptionServiceType[];
  enabled?: boolean;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoConnect?: boolean;
  role?: 'teacher' | 'student';
}

// Return type of the hook
interface TranscriptionHookResult {
  isTranscribing: boolean;
  isSupported: boolean;
  transcription: string | null;
  isFinal: boolean;
  confidence: number | null;
  error: TranscriptionError | null;
  serviceType: TranscriptionServiceType | null;
  start: () => Promise<boolean>;
  stop: () => boolean;
  restart: () => Promise<boolean>;
  updateLanguage: (language: string) => void;
  // Send transcription directly to the server for translation
  sendTranscription: (text: string) => boolean;
}

/**
 * Hook for using transcription services with easy switching between implementations
 */
export function useTranscription({
  serviceType = 'auto',
  preferredOrder = ['whisper', 'web_speech'],
  enabled = true,
  language = 'en-US',
  continuous = true,
  interimResults = true,
  autoConnect = true,
  role = 'teacher'
}: TranscriptionHookOptions = {}): TranscriptionHookResult {
  // State for transcription results
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [error, setError] = useState<TranscriptionError | null>(null);
  const [activeServiceType, setActiveServiceType] = useState<TranscriptionServiceType | null>(null);
  
  // WebSocket connection for sending transcriptions to server
  const wsConnection = useWebSocket({
    autoConnect,
    initialRole: role,
    initialLanguage: language
  });
  
  // Ref for the transcription service
  const serviceRef = useRef<TranscriptionService | null>(null);
  
  // Set up the transcription service
  useEffect(() => {
    if (!enabled) return;
    
    try {
      // Create transcription options
      const options: TranscriptionOptions = {
        language,
        continuous,
        interimResults
      };
      
      // Set up listeners
      const listeners: TranscriptionListeners = {
        onTranscriptionResult: (result: TranscriptionResult) => {
          console.log('Transcription result:', result);
          setTranscription(result.text);
          setIsFinal(result.isFinal);
          if (result.confidence !== undefined) {
            setConfidence(result.confidence);
          }
          
          // If this is a final transcription result, send it to the server for translation
          if (result.isFinal && result.text.trim()) {
            console.log('Sending final transcription to server:', result.text);
            sendTranscriptionToServer(result.text);
          }
        },
        onTranscriptionError: (err: TranscriptionError) => {
          console.error('Transcription error:', err);
          setError(err);
          
          // If the error is fatal, stop transcribing
          if (err.type === 'permission_denied' || err.type === 'not_supported') {
            setIsSupported(false);
            setIsTranscribing(false);
          }
        },
        onTranscriptionStart: () => {
          console.log('Transcription started');
          setIsTranscribing(true);
          setError(null);
        },
        onTranscriptionEnd: () => {
          console.log('Transcription ended');
          setIsTranscribing(false);
        }
      };
      
      // Create the appropriate transcription service
      if (serviceType === 'auto') {
        // Auto-select the best available service
        serviceRef.current = TranscriptionFactory.getBestAvailableService(
          preferredOrder,
          options,
          listeners
        );
      } else {
        // Use the specified service
        serviceRef.current = TranscriptionFactory.createTranscriptionService(
          serviceType,
          options,
          listeners
        );
      }
      
      // Check if the service is supported
      const supported = serviceRef.current.isSupported();
      setIsSupported(supported);
      
      // Determine which service type was actually created
      if (serviceRef.current.constructor.name.includes('WebSpeech')) {
        setActiveServiceType('web_speech');
      } else if (serviceRef.current.constructor.name.includes('Whisper')) {
        setActiveServiceType('whisper');
      }
      
      // Start automatically if enabled
      if (supported && autoConnect) {
        serviceRef.current.start();
      }
    } catch (err) {
      console.error('Error setting up transcription service:', err);
      setError({
        type: 'unknown',
        message: `Failed to initialize transcription service: ${(err as Error).message}`,
        original: err as Error
      });
      setIsSupported(false);
    }
    
    // Clean up function
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stop();
        serviceRef.current = null;
      }
    };
  }, [
    enabled,
    serviceType,
    preferredOrder.join(','), // Convert array to string for deps
    // Don't include dynamic options as dependencies, 
    // we'll handle them with updateOptions
  ]);
  
  // Update options when they change
  useEffect(() => {
    if (serviceRef.current) {
      serviceRef.current.updateOptions({
        language,
        continuous,
        interimResults
      });
    }
  }, [language, continuous, interimResults]);
  
  // Function to start transcription
  const start = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current) {
      console.warn('Transcription service not initialized');
      return false;
    }
    
    // Ensure WebSocket is connected first
    if (wsConnection.status !== 'connected') {
      wsConnection.connect();
      
      // Wait for connection or timeout
      const connectTimeout = 3000;
      const startTime = Date.now();
      
      // Use string comparisons instead of type assertions
      while (wsConnection.status !== 'connected' && (Date.now() - startTime) < connectTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Use string comparisons instead of type assertions
      if (wsConnection.status !== 'connected') {
        setError({
          type: 'network_error',
          message: 'Failed to connect to WebSocket server'
        });
        return false;
      }
    }
    
    const result = serviceRef.current.start();
    if (result) {
      setIsTranscribing(true);
    }
    return result;
  }, [wsConnection]);
  
  // Function to stop transcription
  const stop = useCallback((): boolean => {
    if (!serviceRef.current) {
      console.warn('Transcription service not initialized');
      return false;
    }
    
    const result = serviceRef.current.stop();
    if (result) {
      setIsTranscribing(false);
    }
    return result;
  }, []);
  
  // Function to restart transcription
  const restart = useCallback(async (): Promise<boolean> => {
    stop();
    // Add a small delay to ensure everything is cleaned up
    await new Promise(resolve => setTimeout(resolve, 200));
    return start();
  }, [stop, start]);
  
  // Function to update language
  const updateLanguage = useCallback((newLanguage: string): void => {
    if (serviceRef.current) {
      serviceRef.current.updateOptions({ language: newLanguage });
    }
    
    // Update WebSocket language as well
    wsConnection.updateLanguage(newLanguage);
  }, [wsConnection]);
  
  // Function to send transcription directly to the server
  const sendTranscriptionToServer = useCallback((text: string): boolean => {
    // Only send if connected
    if (wsConnection.status !== 'connected') {
      console.warn('Cannot send transcription - WebSocket not connected');
      return false;
    }
    
    // Send as a transcription message using the wsConnection's sendTranscription method
    return wsConnection.sendTranscription(text);
  }, [wsConnection]);
  
  return {
    isTranscribing,
    isSupported,
    transcription,
    isFinal,
    confidence,
    error,
    serviceType: activeServiceType,
    start,
    stop,
    restart,
    updateLanguage,
    sendTranscription: sendTranscriptionToServer
  };
}