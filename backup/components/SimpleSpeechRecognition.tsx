import React, { useState, useEffect, useRef } from 'react';

interface SimpleSpeechRecognitionProps {
  onSpeechResult?: (text: string) => void;
  initialLanguage?: string;
  continuous?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A simple, standalone Speech Recognition component that directly renders
 * transcription results without using OpenAI or WebSockets.
 */
const SimpleSpeechRecognition: React.FC<SimpleSpeechRecognitionProps> = ({
  onSpeechResult,
  initialLanguage = 'en-US',
  continuous = true,
  disabled = false,
  className = '',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(initialLanguage);
  
  // Keep recognition instance in a ref to preserve between renders
  const recognitionRef = useRef<any>(null);
  
  // Check if speech recognition is supported
  const isSupported = typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 
    'webkitSpeechRecognition' in window || 
    'mozSpeechRecognition' in window || 
    'msSpeechRecognition' in window
  );
  
  // Initialize or reset the speech recognition
  const initRecognition = () => {
    // Clean up any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors on cleanup
      }
      recognitionRef.current = null;
    }
    
    // Check if the API is supported
    if (!isSupported) {
      setError('Speech recognition is not supported in your browser');
      return false;
    }
    
    // Get the appropriate constructor
    // @ts-ignore - TypeScript doesn't know about browser-specific SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || 
                             window.webkitSpeechRecognition || 
                             window.mozSpeechRecognition || 
                             window.msSpeechRecognition;
    
    try {
      // Create a new instance
      const recognition = new SpeechRecognition();
      
      // Configure options
      recognition.lang = language;
      recognition.continuous = continuous;
      recognition.interimResults = true;
      
      // Handle results
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            currentInterim += transcript;
          }
        }
        
        // Update state - use requestAnimationFrame to avoid flickering
        requestAnimationFrame(() => {
          if (finalTranscript) {
            // Log the final transcript
            console.log("🎙️ Speech recognition final:", finalTranscript);
            
            // Store and notify parent
            setTranscript(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
            onSpeechResult?.(finalTranscript);
            
            // Clear interim
            setInterimTranscript('');
          } else if (currentInterim) {
            // Show interim results
            setInterimTranscript(currentInterim);
          }
        });
      };
      
      // Handle start event
      recognition.onstart = () => {
        console.log('Simple Speech Recognition started');
        setIsListening(true);
        setError(null);
      };
      
      // Handle end event
      recognition.onend = () => {
        console.log('Simple Speech Recognition ended');
        setIsListening(false);
        
        // Restart if continuous mode is enabled
        if (continuous && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Error restarting speech recognition:', e);
          }
        }
      };
      
      // Handle errors
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Error: ${event.error}`);
      };
      
      // Store in ref
      recognitionRef.current = recognition;
      return true;
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError('Failed to initialize speech recognition');
      return false;
    }
  };
  
  // Start listening
  const start = () => {
    if (disabled) return;
    
    if (!recognitionRef.current) {
      if (!initRecognition()) {
        return;
      }
    }
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition');
      
      // Re-initialize and try again after a short delay
      setTimeout(() => {
        if (initRecognition()) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Error on second attempt to start speech recognition:', e);
          }
        }
      }, 100);
    }
  };
  
  // Stop listening
  const stop = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  };
  
  // Clear the transcript
  const clear = () => {
    setTranscript('');
    setInterimTranscript('');
  };
  
  // Change language
  const changeLanguage = (newLanguage: string) => {
    setLanguage(newLanguage);
    // Recognition needs to be restarted for language change to take effect
    const wasListening = isListening;
    stop();
    setTimeout(() => {
      if (initRecognition() && wasListening) {
        start();
      }
    }, 100);
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);
  
  return (
    <div className={`simple-speech-recognition ${className}`}>
      <div className="controls flex gap-2 mb-2">
        {isListening ? (
          <button 
            onClick={stop}
            className="bg-red-500 text-white px-3 py-1 rounded text-sm"
            disabled={disabled}
          >
            Stop Listening
          </button>
        ) : (
          <button 
            onClick={start}
            className="bg-green-500 text-white px-3 py-1 rounded text-sm"
            disabled={disabled}
          >
            Start Listening
          </button>
        )}
        
        <button 
          onClick={clear}
          className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm"
          disabled={disabled}
        >
          Clear
        </button>
      </div>
      
      {error && (
        <div className="error text-red-500 text-sm mb-2">
          {error}
        </div>
      )}
      
      <div className="transcript-container border rounded p-3 min-h-[100px] bg-white">
        <div className="final-transcript text-gray-900">
          {transcript}
        </div>
        {interimTranscript && (
          <div className="interim-transcript text-gray-500 italic mt-1">
            {interimTranscript}...
          </div>
        )}
        {!transcript && !interimTranscript && !isListening && (
          <div className="placeholder text-gray-400">
            Click "Start Listening" to begin speech recognition
          </div>
        )}
        {!transcript && !interimTranscript && isListening && (
          <div className="placeholder text-gray-400">
            Listening... speak now
          </div>
        )}
      </div>
      
      <div className="status text-xs text-gray-500 mt-1">
        {isListening ? 
          <span className="text-green-500">●</span> : 
          <span className="text-gray-300">○</span>}
        {' '}
        {isListening ? 'Listening' : 'Not listening'}
        {isListening && ' - using native Web Speech API (no OpenAI)'}
      </div>
    </div>
  );
};

export default SimpleSpeechRecognition;