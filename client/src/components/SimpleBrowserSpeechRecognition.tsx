import React, { useState, useEffect, useRef } from 'react';

interface SimpleBrowserSpeechRecognitionProps {
  onTranscription?: (text: string) => void;
  language?: string;
  className?: string;
}

// This component uses the successful approach from the test page
// but integrated for use in the TeacherInterface
const SimpleBrowserSpeechRecognition: React.FC<SimpleBrowserSpeechRecognitionProps> = ({ 
  onTranscription,
  language = 'en-US',
  className = ''
}) => {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to store the SpeechRecognition instance
  const recognitionRef = useRef<any>(null);
  
  // Check microphone access
  const checkMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the mic immediately after testing
      stream.getTracks().forEach(track => track.stop());
      setError(null);
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      return false;
    }
  };
  
  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (typeof window === 'undefined') {
      setError('Speech recognition is not available in this environment');
      return false;
    }
    
    // @ts-ignore - Get the appropriate constructor based on browser
    const SpeechRecognition = window.SpeechRecognition || 
                            window.webkitSpeechRecognition || 
                            window.mozSpeechRecognition || 
                            window.msSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return false;
    }
    
    try {
      // Clean up any existing instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      
      const recognition = new SpeechRecognition();
      
      // Configure with the most basic settings that worked on the test page
      recognition.lang = language;
      recognition.continuous = false; // Non-continuous mode is more stable
      recognition.interimResults = true;
      
      // Handle results
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          console.log('Final transcript:', finalTranscript);
          setTranscript(prev => {
            const newText = prev ? `${prev} ${finalTranscript}`.trim() : finalTranscript.trim();
            // Notify parent component
            onTranscription?.(newText);
            return newText;
          });
        }
      };
      
      // Handle events
      recognition.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        
        // Auto-restart if we're supposed to be listening
        if (isListening) {
          try {
            setTimeout(() => {
              if (isListening && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 250);
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        // Don't show "aborted" errors to the user
        if (event.error !== 'aborted') {
          setError(`Recognition error: ${event.error}`);
        }
        
        // For most errors, restart after a delay
        setTimeout(() => {
          if (isListening && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Failed to restart after error');
            }
          }
        }, 1000);
      };
      
      recognitionRef.current = recognition;
      return true;
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError(`Failed to initialize: ${err}`);
      return false;
    }
  };
  
  // Start listening
  const startListening = async () => {
    setError(null);
    
    // First check microphone access
    const hasMicAccess = await checkMicrophoneAccess();
    if (!hasMicAccess) return;
    
    // Then initialize speech recognition
    if (!initSpeechRecognition()) return;
    
    // Start listening
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(`Error starting: ${err}`);
      
      // If already started, stop and restart
      if (err instanceof Error && err.message.includes('already started')) {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              setIsListening(true);
            } catch (e) {
              console.error('Error restarting after already-started error:', e);
            }
          }, 300);
        } catch (e) {
          console.error('Error stopping after already-started error:', e);
        }
      }
    }
  };
  
  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  };
  
  // Clear transcript
  const clearTranscript = () => {
    setTranscript('');
    onTranscription?.('');
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);
  
  return (
    <div className={`simple-browser-speech ${className}`}>
      <div className="mb-4 text-sm">
        <div className="flex items-center mb-2">
          <span className="font-medium mr-2">Status:</span> 
          {isListening ? (
            <span className="text-green-600 flex items-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
              Listening...
            </span>
          ) : (
            <span className="text-gray-500">Idle</span>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex space-x-2 mb-4">
        {isListening ? (
          <button
            onClick={stopListening}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
          >
            Stop Listening
          </button>
        ) : (
          <button
            onClick={startListening}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          >
            Start Listening
          </button>
        )}
        
        <button
          onClick={clearTranscript}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          disabled={!transcript}
        >
          Clear
        </button>
      </div>
      
      {/* Transcript Display */}
      <div className="mb-4">
        <div className="font-medium text-sm mb-1">Current transcript:</div>
        <div className="p-3 bg-gray-50 border rounded min-h-[60px] text-sm">
          {transcript || <span className="text-gray-400 italic">Nothing transcribed yet...</span>}
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="text-red-500 text-xs mt-2">
          {error}
        </div>
      )}
    </div>
  );
};

export default SimpleBrowserSpeechRecognition;