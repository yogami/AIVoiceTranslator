import React, { useState, useEffect, useRef } from 'react';

// This component uses the most basic Web Speech API implementation
// with minimal configuration to maximize compatibility
const BrowserSpeechRecognition: React.FC = () => {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [microphoneAccess, setMicrophoneAccess] = useState<boolean | null>(null);
  
  // Reference to store the SpeechRecognition instance
  const recognitionRef = useRef<any>(null);
  
  // Check if the browser supports Speech Recognition
  const checkBrowserSupport = () => {
    if (typeof window === 'undefined') return false;
    
    // @ts-ignore - TypeScript doesn't know about browser-specific SpeechRecognition
    return !!window.SpeechRecognition || !!window.webkitSpeechRecognition || 
           !!window.mozSpeechRecognition || !!window.msSpeechRecognition;
  };
  
  // Check microphone access
  const checkMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the mic immediately after testing
      stream.getTracks().forEach(track => track.stop());
      setMicrophoneAccess(true);
      setError(null);
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      setMicrophoneAccess(false);
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
      return false;
    }
  };
  
  // Initialize speech recognition
  const initSpeechRecognition = () => {
    if (!checkBrowserSupport()) {
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
      
      // @ts-ignore - Get the appropriate constructor based on browser
      const SpeechRecognition = window.SpeechRecognition || 
                              window.webkitSpeechRecognition || 
                              window.mozSpeechRecognition || 
                              window.msSpeechRecognition;
      
      const recognition = new SpeechRecognition();
      
      // Configure with the most basic settings
      recognition.lang = 'en-US';
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
          setTranscript(prev => prev + ' ' + finalTranscript);
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
              if (isListening) {
                recognition.start();
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
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(`Error starting: ${err}`);
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
  };
  
  // Check browser support on mount
  useEffect(() => {
    const isSupported = checkBrowserSupport();
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser.');
    } else {
      // Check microphone access
      checkMicrophoneAccess();
    }
    
    // Clean up on unmount
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
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-medium mb-3">Simple Browser Speech Recognition</h3>
      
      {/* Status */}
      <div className="mb-4">
        <div className="text-sm mb-1">
          <span className="font-medium">Status:</span> 
          {isListening ? (
            <span className="ml-2 text-green-600 flex items-center">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
              Listening...
            </span>
          ) : (
            <span className="ml-2 text-gray-500">Idle</span>
          )}
        </div>
        
        <div className="text-sm">
          <span className="font-medium">Microphone:</span>
          {microphoneAccess === null ? (
            <span className="ml-2 text-gray-500">Checking...</span>
          ) : microphoneAccess ? (
            <span className="ml-2 text-green-600">Access granted</span>
          ) : (
            <span className="ml-2 text-red-600">Access denied</span>
          )}
        </div>
      </div>
      
      {/* Transcript Display */}
      <div className="mb-4">
        <div className="font-medium text-sm mb-1">Transcript:</div>
        <div className="p-3 bg-gray-50 border rounded min-h-[100px] text-sm">
          {transcript || <span className="text-gray-400">Nothing transcribed yet...</span>}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex space-x-2">
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
            disabled={microphoneAccess === false}
          >
            Start Listening
          </button>
        )}
        
        <button
          onClick={clearTranscript}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          disabled={!transcript}
        >
          Clear Transcript
        </button>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mt-3 text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {/* Browser Support */}
      {!checkBrowserSupport() && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          Your browser doesn't support the Web Speech API. Please try Chrome, Edge, or Safari.
        </div>
      )}
      
      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          <strong>Troubleshooting:</strong><br />
          - Make sure your microphone is working and connected<br />
          - Ensure you've granted microphone permission to this website<br />
          - Try refreshing the page if recognition doesn't start<br />
          - Speak clearly and at a normal pace
        </p>
      </div>
    </div>
  );
};

export default BrowserSpeechRecognition;