import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Simple Speech Test component that uses the browser's Web Speech API directly
export default function SimpleSpeechTest() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechRecognition);
  }, []);

  // Start speech recognition
  const startListening = () => {
    setError(null);
    
    // Get speech recognition constructor
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    
    try {
      // Create new recognition instance
      const recognition = new SpeechRecognition();
      
      // Configure recognition
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Handle results
      recognition.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript;
        
        setTranscript((prev) => prev + ' ' + transcript);
      };
      
      // Handle start
      recognition.onstart = () => {
        setIsListening(true);
        console.log('Speech recognition started');
      };
      
      // Handle end
      recognition.onend = () => {
        setIsListening(false);
        console.log('Speech recognition ended');
      };
      
      // Handle errors
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };
      
      // Start recognition
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Simple Speech Recognition Test</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Speech Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="font-semibold mr-2">Support Status:</span>
              {isSpeechSupported ? (
                <span className="text-green-600">Speech Recognition is supported in this browser</span>
              ) : (
                <span className="text-red-600">Speech Recognition is NOT supported in this browser</span>
              )}
            </div>
            
            <div className="mb-4">
              <span className="font-semibold mr-2">Recording Status:</span>
              {isListening ? (
                <span className="text-green-600 flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                  Listening...
                </span>
              ) : (
                <span className="text-gray-500">Not listening</span>
              )}
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 mb-4">
                {error}
              </div>
            )}
            
            <div className="flex gap-4">
              <Button 
                onClick={startListening}
                disabled={isListening || !isSpeechSupported}
              >
                Start Listening
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setTranscript('')}
              >
                Clear Transcript
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 border rounded-md min-h-[150px] whitespace-pre-wrap">
              {transcript || (
                <span className="text-gray-400 italic">
                  Your speech will appear here when you start listening...
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}