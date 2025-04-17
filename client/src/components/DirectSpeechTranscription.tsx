import React, { useState, useEffect, useRef } from 'react';

interface DirectSpeechTranscriptionProps {
  onTranscription?: (text: string) => void;
  language?: string;
  disabled?: boolean;
  className?: string;
  autoStart?: boolean;
}

/**
 * A completely standalone speech recognition component
 * 
 * This component:
 * 1. Uses the Web Speech API directly with no dependencies
 * 2. Does not rely on OpenAI or WebSockets
 * 3. Renders transcriptions directly in the UI
 * 4. Has minimal styling to integrate anywhere
 */
const DirectSpeechTranscription: React.FC<DirectSpeechTranscriptionProps> = ({
  onTranscription,
  language = 'en-US',
  disabled = false,
  className = '',
  autoStart = false
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the recognition instance
  const recognitionRef = useRef<any>(null);
  
  // Initialize speech recognition
  const initSpeechRecognition = () => {
    // Clean up any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors during cleanup
      }
      recognitionRef.current = null;
    }
    
    // Check browser support
    if (typeof window === 'undefined') {
      setError('Speech recognition not available in this environment');
      return false;
    }
    
    // Get the appropriate Speech Recognition constructor
    // @ts-ignore - TypeScript doesn't know about browser-specific SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || 
                              window.webkitSpeechRecognition || 
                              window.mozSpeechRecognition || 
                              window.msSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return false;
    }
    
    try {
      // Create a new instance
      const recognition = new SpeechRecognition();
      
      // Configure
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Handle results
      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        
        // Only update state if there's content to show
        if (final) {
          console.log('Direct Speech Recognition - FINAL:', final);
          setTranscript(prev => {
            const newValue = prev ? `${prev} ${final}` : final;
            // Notify parent component
            onTranscription?.(newValue);
            return newValue;
          });
          setInterimTranscript('');
        } else if (interim) {
          setInterimTranscript(interim);
        }
      };
      
      // Handle events
      recognition.onstart = () => {
        console.log('Direct Speech Recognition started');
        setIsListening(true);
        setError(null);
      };
      
      recognition.onend = () => {
        console.log('Direct Speech Recognition ended');
        setIsListening(false);
        
        // Auto-restart if still supposed to be listening
        if (recognitionRef.current && isListening && !disabled) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Error restarting speech recognition:', e);
          }
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Direct Speech Recognition error:', event.error);
        setError(`Error: ${event.error}`);
        
        // If we get a network error, try to restart after a delay
        if (event.error === 'network') {
          setTimeout(() => {
            if (isListening && !disabled) {
              initSpeechRecognition();
              startListening();
            }
          }, 1000);
        }
      };
      
      // Store the instance for later control
      recognitionRef.current = recognition;
      return true;
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError(`Failed to initialize: ${err}`);
      return false;
    }
  };
  
  // Start speech recognition
  const startListening = () => {
    if (disabled) return;
    
    // Make sure we have a recognition instance
    if (!recognitionRef.current) {
      if (!initSpeechRecognition()) {
        return;
      }
    }
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      
      // Try to recover if we get an error about an existing recognition
      if (err instanceof Error && err.message.includes('already started')) {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (!disabled) {
              recognitionRef.current.start();
              setIsListening(true);
            }
          }, 100);
        } catch (stopErr) {
          // If even stopping fails, reinitialize
          initSpeechRecognition();
          setTimeout(() => {
            if (!disabled) {
              recognitionRef.current?.start();
              setIsListening(true);
            }
          }, 200);
        }
      } else {
        // Different error, reinitialize
        setError(`Failed to start: ${err}`);
        initSpeechRecognition();
      }
    }
  };
  
  // Stop speech recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
    setIsListening(false);
  };
  
  // Clear transcript
  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };
  
  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart && !disabled) {
      if (initSpeechRecognition()) {
        startListening();
      }
    }
    
    // Clean up on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update language if it changes
  useEffect(() => {
    if (recognitionRef.current) {
      const wasListening = isListening;
      
      // Need to stop and restart to change language
      try {
        stopListening();
        
        // Small delay before reinitializing
        setTimeout(() => {
          if (initSpeechRecognition() && wasListening && !disabled) {
            startListening();
          }
        }, 100);
      } catch (err) {
        console.error('Error updating language:', err);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  
  // Update based on disabled state
  useEffect(() => {
    if (disabled && isListening) {
      stopListening();
    } else if (!disabled && autoStart && !isListening) {
      if (initSpeechRecognition()) {
        startListening();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);
  
  return (
    <div className={`direct-speech-transcription ${className}`}>
      <div className="transcript-container mb-2">
        <div className="final-transcript text-gray-900 min-h-[40px]">
          {transcript || (
            <span className="text-gray-400 text-sm italic">
              {isListening ? 'Listening...' : 'Click "Start" to begin speech recognition'}
            </span>
          )}
        </div>
        {interimTranscript && (
          <div className="interim-transcript text-gray-500 italic mt-1">
            {interimTranscript}<span className="animate-pulse">...</span>
          </div>
        )}
      </div>
      
      <div className="controls flex gap-2">
        {isListening ? (
          <button 
            onClick={stopListening}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            disabled={disabled}
          >
            Stop
          </button>
        ) : (
          <button 
            onClick={startListening}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
            disabled={disabled}
          >
            Start
          </button>
        )}
        
        <button 
          onClick={clearTranscript}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
          disabled={disabled || (!transcript && !interimTranscript)}
        >
          Clear
        </button>
      </div>
      
      {error && (
        <div className="error text-red-500 text-xs mt-2">
          {error}
        </div>
      )}
      
      <div className="status text-xs text-gray-500 mt-1">
        {isListening ? 
          <span className="text-green-500">●</span> : 
          <span className="text-gray-300">○</span>}
        {' '}
        {isListening ? 'Listening' : 'Not listening'} in {language}
      </div>
    </div>
  );
};

export default DirectSpeechTranscription;