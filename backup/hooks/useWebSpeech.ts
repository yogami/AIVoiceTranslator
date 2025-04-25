import { useState, useEffect, useRef } from 'react';
import { WebSpeechRecognition, SpeechRecognitionResult } from '@/lib/webSpeechAPI';
import { wsClient } from '@/lib/websocket'; 

interface UseWebSpeechOptions {
  enabled?: boolean;
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscriptionUpdate?: (text: string, isFinal: boolean) => void;
}

interface UseWebSpeechReturn {
  isSupported: boolean;
  isRecording: boolean;
  transcript: string; 
  interimTranscript: string;
  error: Error | null;
  start: () => boolean;
  stop: () => boolean;
}

export function useWebSpeech({
  enabled = false,
  language = 'en-US',
  continuous = true,
  interimResults = true,
  onTranscriptionUpdate
}: UseWebSpeechOptions = {}): UseWebSpeechReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  
  // Use a ref to hold the WebSpeechRecognition instance
  // This ensures it persists between renders and doesn't get recreated
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  
  // Initialize the recognition instance
  useEffect(() => {
    try {
      // Create a new instance of WebSpeechRecognition
      const recognition = new WebSpeechRecognition({
        language,
        continuous,
        interimResults,
        onResult: (result: SpeechRecognitionResult) => {
          // Update the transcript
          if (result.isFinal) {
            setTranscript(result.text);
            
            // Call the callback if provided
            if (onTranscriptionUpdate) {
              onTranscriptionUpdate(result.text, true);
            }
            
            // Send the transcription to the server via WebSocket
            // For development: This now serves as the primary transcription method
            // so it will be shown directly in the UI
            if (wsClient && wsClient.getStatus() === 'connected') {
              console.log('Sending Web Speech transcription to WebSocket server:', result.text);
              wsClient.send({
                type: 'webSpeechTranscription',
                text: result.text,
                timestamp: Date.now(),
                language
              });
              
              // For development mode: Also send it as if it came from the AI transcription service
              // This allows the application to work without needing an OpenAI API key
              wsClient.send({
                type: 'transcription',
                status: 'success',
                data: {
                  originalText: result.text, 
                  translatedText: result.text,
                  timestamp: new Date().toISOString(),
                  latency: 200, // Mock latency for development
                  sourceLanguage: language,
                  targetLanguage: language
                }
              });
            }
          } else {
            setInterimTranscript(result.text);
            if (onTranscriptionUpdate) {
              onTranscriptionUpdate(result.text, false);
            }
          }
        },
        onError: (err: Error) => {
          console.error('Web Speech recognition error:', err);
          setError(err);
        },
        onStart: () => {
          console.log('Web Speech recognition started');
          setIsRecording(true);
        },
        onEnd: () => {
          console.log('Web Speech recognition ended');
          setIsRecording(false);
        }
      });
      
      // Store the recognition instance in the ref
      recognitionRef.current = recognition;
      
      // Check if Web Speech API is supported
      setIsSupported(recognition.isSupported());
      
      // Cleanup on unmount
      return () => {
        if (recognitionRef.current && recognitionRef.current.isActive()) {
          recognitionRef.current.stop();
        }
      };
    } catch (err) {
      console.error('Error initializing Web Speech recognition:', err);
      setError(err as Error);
      setIsSupported(false);
      return () => {}; // Return empty cleanup function
    }
  }, [language, continuous, interimResults, onTranscriptionUpdate]);
  
  // Start or stop recognition based on enabled prop
  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return;
    
    if (enabled) {
      // Only start if not already recording
      if (!recognitionRef.current.isActive()) {
        recognitionRef.current.start();
      }
    } else {
      // Only stop if currently recording
      if (recognitionRef.current.isActive()) {
        recognitionRef.current.stop();
      }
    }
  }, [enabled, isSupported]);
  
  // Update recognition parameters if language changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.updateParams({ language });
    }
  }, [language]);
  
  // Functions to manually start and stop recognition
  const start = () => {
    if (recognitionRef.current && isSupported) {
      return recognitionRef.current.start();
    }
    return false;
  };
  
  const stop = () => {
    if (recognitionRef.current && isSupported) {
      return recognitionRef.current.stop();
    }
    return false;
  };
  
  return {
    isSupported,
    isRecording,
    transcript,
    interimTranscript,
    error,
    start,
    stop
  };
}