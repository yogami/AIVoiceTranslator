import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TranscriptionFactory, 
  TranscriptionServiceType 
} from '../lib/transcription/TranscriptionFactory';
import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners,
  TranscriptionResult
} from '../lib/transcription/TranscriptionService';

/**
 * Hook for managing transcription services
 */
export function useTranscriptionService(
  initialServiceType: TranscriptionServiceType = 'web_speech',
  options?: TranscriptionOptions,
  listeners?: TranscriptionListeners
) {
  // Store the active service type
  const [serviceType, setServiceType] = useState<TranscriptionServiceType>(initialServiceType);
  
  // Store the transcription service instance
  const serviceRef = useRef<TranscriptionService | null>(null);
  
  // Store transcription state
  const [isActive, setIsActive] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Initialize or update the service when dependencies change
  useEffect(() => {
    try {
      // Create combined listeners that include our internal handlers plus any provided ones
      const combinedListeners: TranscriptionListeners = {
        onTranscriptionStart: () => {
          setIsActive(true);
          setError(null);
          listeners?.onTranscriptionStart?.();
        },
        
        onTranscriptionEnd: () => {
          setIsActive(false);
          listeners?.onTranscriptionEnd?.();
        },
        
        onTranscriptionResult: (result: TranscriptionResult) => {
          if (result.isFinal) {
            setFinalText(result.text);
            setCurrentText('');
          } else {
            setCurrentText(result.text);
          }
          
          // Forward to external listener if provided
          listeners?.onTranscriptionResult?.(result);
        },
        
        onTranscriptionError: (error) => {
          setError(error.message);
          setIsActive(false);
          
          // Forward to external listener if provided
          listeners?.onTranscriptionError?.(error);
        }
      };
      
      // Create the service
      serviceRef.current = TranscriptionFactory.createTranscriptionService(
        serviceType,
        options,
        combinedListeners
      );
      
      console.log(`Transcription service created: ${serviceType}`);
    } catch (err) {
      console.error('Error creating transcription service:', err);
      setError(err instanceof Error ? err.message : 'Unknown error creating service');
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (serviceRef.current?.isActive()) {
        serviceRef.current.abort();
      }
    };
  }, [serviceType, options]);
  
  // Start transcription
  const start = useCallback(async () => {
    try {
      if (!serviceRef.current) {
        throw new Error('Transcription service not initialized');
      }
      
      setError(null);
      
      // If already active, stop first
      if (serviceRef.current.isActive()) {
        serviceRef.current.stop();
      }
      
      // Start transcription
      const started = await serviceRef.current.start();
      
      if (!started) {
        throw new Error('Failed to start transcription');
      }
      
      return true;
    } catch (err) {
      console.error('Error starting transcription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error starting transcription');
      return false;
    }
  }, []);
  
  // Stop transcription
  const stop = useCallback(() => {
    try {
      if (!serviceRef.current) {
        return false;
      }
      
      return serviceRef.current.stop();
    } catch (err) {
      console.error('Error stopping transcription:', err);
      return false;
    }
  }, []);
  
  // Abort transcription
  const abort = useCallback(() => {
    try {
      if (!serviceRef.current) {
        return false;
      }
      
      return serviceRef.current.abort();
    } catch (err) {
      console.error('Error aborting transcription:', err);
      return false;
    }
  }, []);
  
  // Switch service type
  const switchServiceType = useCallback((newType: TranscriptionServiceType) => {
    // Stop current service if active
    if (serviceRef.current?.isActive()) {
      serviceRef.current.stop();
    }
    
    // Update service type
    setServiceType(newType);
  }, []);
  
  return {
    serviceType,
    switchServiceType,
    isActive,
    currentText,
    finalText,
    error,
    start,
    stop,
    abort
  };
}