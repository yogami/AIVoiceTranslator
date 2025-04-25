import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useToast } from '../hooks/use-toast';
import { useTeacherWebSocket } from '../lib/websocket';
import { useLanguageSupport } from '../hooks/use-language-support';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';

const TeacherPage: React.FC = () => {
  const { toast } = useToast();
  const {
    selectedLanguage,
    setSelectedLanguage,
    availableLanguages,
    currentLanguage
  } = useLanguageSupport();
  
  // WebSocket integration for teacher
  const {
    connectionState,
    sessionId,
    studentCount,
    connect,
    sendMessage
  } = useTeacherWebSocket(selectedLanguage);
  
  // State for recording and teaching
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [recognition, setRecognition] = useState<any>(null);
  const [isTeaching, setIsTeaching] = useState(false);
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = selectedLanguage;
      
      recognitionInstance.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            
            // Send the final transcript for translation
            if (isRecording && connectionState === 'connected') {
              sendMessage({
                type: 'teacherSpeech',
                text: finalTranscript,
                languageCode: selectedLanguage
              });
              
              toast({
                title: 'Speech Sent',
                description: `"${finalTranscript.substring(0, 30)}${finalTranscript.length > 30 ? '...' : ''}"`,
              });
            }
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Update the transcription
        setTranscription(finalTranscript || interimTranscript);
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // This is a normal error when no speech is detected
          return;
        }
        
        toast({
          title: 'Speech Recognition Error',
          description: `Error: ${event.error}. Please try again.`,
          variant: 'destructive'
        });
        
        stopRecording();
      };
      
      setRecognition(recognitionInstance);
    } else {
      toast({
        title: 'Browser Not Supported',
        description: 'Speech recognition is not supported in this browser. Please use Chrome.',
        variant: 'destructive'
      });
    }
  }, [selectedLanguage, connectionState, isRecording, sendMessage, toast]);
  
  // Start recording
  const startRecording = () => {
    if (recognition) {
      try {
        recognition.start();
        setIsRecording(true);
        
        toast({
          title: 'Recording Started',
          description: 'Your speech is now being recorded and translated.'
        });
      } catch (error) {
        console.error('Error starting recognition:', error);
        
        // If recognition is already running, restart it
        try {
          recognition.stop();
          setTimeout(() => {
            recognition.start();
            setIsRecording(true);
          }, 100);
        } catch (err) {
          toast({
            title: 'Recording Error',
            description: 'Could not start speech recognition.',
            variant: 'destructive'
          });
        }
      }
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (recognition) {
      recognition.stop();
      setIsRecording(false);
      
      toast({
        title: 'Recording Stopped',
        description: 'Speech recording has been stopped.'
      });
    }
  };
  
  // Toggle teaching mode
  const toggleTeaching = () => {
    if (isTeaching) {
      // Stop teaching
      sendMessage({
        type: 'teacherStatus',
        active: false
      });
      
      stopRecording();
      setIsTeaching(false);
      
      toast({
        title: 'Teaching Session Ended',
        description: 'Your teaching session has ended.'
      });
    } else {
      // Start teaching
      sendMessage({
        type: 'teacherStatus',
        active: true,
        languageCode: selectedLanguage
      });
      
      startRecording();
      setIsTeaching(true);
      
      toast({
        title: 'Teaching Session Started',
        description: 'Your teaching session has started. Students can now receive translations.'
      });
    }
  };
  
  // Share session link
  const shareSessionLink = () => {
    const url = `${window.location.origin}/student?session=${sessionId}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          toast({
            title: 'Link Copied!',
            description: 'Session link has been copied to clipboard.'
          });
        })
        .catch(() => {
          toast({
            title: 'Copy Failed',
            description: 'Could not copy to clipboard. Please copy the URL manually.',
            variant: 'destructive'
          });
        });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        toast({
          title: 'Link Copied!',
          description: 'Session link has been copied to clipboard.'
        });
      } catch (err) {
        toast({
          title: 'Copy Failed',
          description: 'Could not copy to clipboard. Please copy the URL manually.',
          variant: 'destructive'
        });
      }
      
      document.body.removeChild(textArea);
    }
  };
  
  // Create status message based on connection state
  const getStatusMessage = () => {
    if (connectionState === 'connecting') {
      return 'Connecting to translation service...';
    } else if (connectionState === 'connected') {
      return isTeaching ? 'Teaching mode active' : 'Connected and ready';
    } else if (connectionState === 'error') {
      return 'Connection error. Please refresh the page.';
    } else {
      return 'Disconnected. Please refresh the page.';
    }
  };
  
  // Get status color based on connection state
  const getStatusColor = () => {
    if (connectionState === 'connected' && isTeaching) {
      return 'bg-green-500';
    } else if (connectionState === 'connected') {
      return 'bg-yellow-500';
    } else if (connectionState === 'connecting') {
      return 'bg-blue-500';
    } else {
      return 'bg-red-500';
    }
  };
  
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">AI Voice Translator</h1>
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${getStatusColor()}`}></span>
            <span className="text-sm text-gray-600">{getStatusMessage()}</span>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Teacher Interface</CardTitle>
            <CardDescription>
              Your speech will be translated in real-time for students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Your Language</label>
              <div className="relative">
                <select 
                  className="w-full p-2 border rounded-md pr-8"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isTeaching}
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag ? `${lang.flag} ` : ''}{lang.name} {lang.localName ? `(${lang.localName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {isTeaching && (
                <p className="text-xs text-yellow-600 mt-1">
                  Language cannot be changed while teaching is active
                </p>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-center space-x-4">
                <Button
                  variant={isTeaching ? 'destructive' : 'default'}
                  size="lg"
                  onClick={toggleTeaching}
                >
                  {isTeaching ? 'Stop Teaching' : 'Start Teaching'}
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  onClick={shareSessionLink}
                  disabled={connectionState !== 'connected'}
                >
                  Share Session Link
                </Button>
              </div>
              
              {sessionId && (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-500">Session ID: {sessionId}</p>
                  <p className="text-sm text-gray-500">
                    Students connected: {studentCount}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Speech Recognition</CardTitle>
            <CardDescription>
              {isRecording ? 'Recording in progress...' : 'Press Start Teaching to begin recording'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRecording ? (
              <div className="p-4 bg-blue-50 rounded-md border border-blue-200 relative min-h-[100px]">
                <div className="absolute top-2 right-2 flex items-center">
                  <span className="animate-pulse w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  <span className="text-xs font-medium text-gray-500">LIVE</span>
                </div>
                <p className="text-gray-700">
                  {transcription || 'Speak now... your speech will appear here.'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200 min-h-[100px] flex items-center justify-center">
                <p className="text-gray-500 text-center">
                  {connectionState === 'connected' 
                    ? 'Ready to start recording. Click "Start Teaching" above.' 
                    : 'Please wait until connection is established...'}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-4">
            <div className="w-full text-center">
              <Link to="/">
                <Button variant="link" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default TeacherPage;