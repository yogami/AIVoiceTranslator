/**
 * React Hook for Audio Recording using Web Speech API
 * 
 * Provides speech recognition functionality for the teacher interface
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { clientConfig } from '../config/client-config.js';

export interface UseAudioRecordingOptions {
  language: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export interface UseAudioRecordingReturn {
  isRecording: boolean;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  toggleRecording: () => void;
}

// Type declaration for webkit Speech Recognition API
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function useAudioRecording(options: UseAudioRecordingOptions): UseAudioRecordingReturn {
  const { language, continuous = true, interimResults = true, onTranscript, onError } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = interimResults;
      recognitionRef.current.lang = language;
      
      // Set up event handlers
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript && onTranscript) {
          onTranscript(finalTranscript, true);
        } else if (interimTranscript && onTranscript && interimResults) {
          onTranscript(interimTranscript, false);
        }
      };
      
      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (onError) {
          onError(event.error);
        }
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        // Restart if still recording (continuous mode)
        if (isRecording && continuous) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
            setIsRecording(false);
          }
        }
      };
    }
  }, [language, continuous, interimResults, onTranscript, onError, isRecording]);

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
      
      // If recording, restart with new language
      if (isRecording) {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to restart with new language:', e);
          }
        }, clientConfig.audio.speechRecognitionRestartDelay);
      }
    }
  }, [language, isRecording]);

  const startRecording = useCallback(() => {
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recording:', e);
        if (onError) {
          onError('Failed to start recording');
        }
      }
    }
  }, [isRecording, onError]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording
  };
} 