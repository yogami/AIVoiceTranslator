import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { SpeechRecognizer } from '../lib/audioCapture';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

interface TranscriptSegment {
  text: string;
  isFinal: boolean;
}

/**
 * Speech Test Page Component
 * 
 * This page provides an interface for testing speech recognition
 * with WebSocket communication between teacher and student.
 */
export default function SpeechTestPage() {
  // Use the WebSocket hook
  const {
    status,
    sessionId,
    role,
    languageCode,
    connect,
    disconnect,
    updateRole,
    updateLanguage,
    sendTranscription,
    addEventListener,
    removeEventListener
  } = useWebSocket({
    autoConnect: false,
    initialRole: 'teacher',
    initialLanguage: 'en-US'
  });
  
  // Speech recognition state
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Logs and messages state
  const [logs, setLogs] = useState<{ type: string; message: string; timestamp: Date }[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  
  // Initialize speech recognizer
  useEffect(() => {
    if (!recognizerRef.current) {
      recognizerRef.current = new SpeechRecognizer({
        language: languageCode,
        continuous: true,
        interimResults: true,
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            // Add final transcript to segments
            setTranscriptSegments(prev => [...prev, { text: transcript, isFinal: true }]);
            
            // Send to server if connected
            if (status === 'connected') {
              sendTranscription(transcript);
              addLog('sent', `Sent transcription: "${transcript}"`);
            }
          } else {
            // Update interim transcript
            setInterimTranscript(transcript);
          }
        },
        onStart: () => {
          setIsListening(true);
          addLog('info', 'Speech recognition started');
        },
        onEnd: () => {
          setIsListening(false);
          addLog('info', 'Speech recognition stopped');
        },
        onError: (error) => {
          addLog('error', `Speech recognition error: ${error.message}`);
          setIsListening(false);
        }
      });
    }
    
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, [languageCode, status, sendTranscription]);
  
  // Update recognition language when languageCode changes
  useEffect(() => {
    if (recognizerRef.current) {
      recognizerRef.current.updateLanguage(languageCode);
    }
  }, [languageCode]);
  
  // Set up WebSocket event listeners
  useEffect(() => {
    // Message listener
    const handleMessage = (message: any) => {
      addLog('received', `Received message: ${JSON.stringify(message)}`);
      
      // If it's a translation message, add it to the translations list
      if (message.type === 'translation') {
        setTranslations(prev => [...prev, message]);
      }
    };
    
    // Add event listener for all message types
    const cleanup = addEventListener('message', handleMessage);
    
    // Add connection status events
    const handleStatusChange = (newStatus: string) => {
      addLog('status', `Connection status changed: ${newStatus}`);
    };
    
    // Add event listener for status changes
    const cleanupStatus = addEventListener('status', handleStatusChange);
    
    return () => {
      cleanup();
      cleanupStatus();
    };
  }, [addEventListener]);
  
  // Start recognition
  const startRecognition = () => {
    if (recognizerRef.current) {
      recognizerRef.current.start();
    }
  };
  
  // Stop recognition
  const stopRecognition = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
  };
  
  // Add a log message
  const addLog = (type: string, message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Clear transcript
  const clearTranscript = () => {
    setTranscriptSegments([]);
    setInterimTranscript('');
  };
  
  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <div className="container max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Speech Recognition Test</h1>
      
      <Tabs defaultValue="teacher">
        <TabsList>
          <TabsTrigger value="teacher">Teacher</TabsTrigger>
          <TabsTrigger value="student">Student</TabsTrigger>
        </TabsList>
        
        <TabsContent value="teacher">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>WebSocket connection information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="font-semibold mr-2">Status:</span>
                  <Badge variant={status === 'connected' ? 'default' : status === 'connecting' ? 'outline' : 'destructive'}>
                    {status}
                  </Badge>
                </div>
                {sessionId && (
                  <div className="mb-4">
                    <span className="font-semibold mr-2">Session ID:</span>
                    <code className="bg-muted p-1 rounded text-xs">{sessionId}</code>
                  </div>
                )}
                <div className="mb-4">
                  <span className="font-semibold mr-2">Role:</span>
                  <Badge variant="outline" className="capitalize">
                    {role}
                  </Badge>
                </div>
                <div className="mb-4">
                  <span className="font-semibold mr-2">Language:</span>
                  <Badge variant="outline">
                    {languageCode}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  onClick={connect} 
                  disabled={status === 'connected' || status === 'connecting'}
                >
                  Connect
                </Button>
                <Button 
                  onClick={disconnect} 
                  disabled={status === 'disconnected'} 
                  variant="destructive"
                >
                  Disconnect
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Speech Recognition</CardTitle>
                <CardDescription>Capture and transcribe speech</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="font-semibold mr-2">Status:</span>
                  <Badge variant={isListening ? 'default' : 'outline'}>
                    {isListening ? 'Listening' : 'Not Listening'}
                  </Badge>
                </div>
                <div className="mb-4">
                  <span className="font-semibold mb-2 block">Select Language:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={languageCode === 'en-US' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('en-US')}
                      className="w-full"
                    >
                      English
                    </Button>
                    <Button
                      variant={languageCode === 'es-ES' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('es-ES')}
                      className="w-full"
                    >
                      Spanish
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant={languageCode === 'fr-FR' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('fr-FR')}
                      className="w-full"
                    >
                      French
                    </Button>
                    <Button
                      variant={languageCode === 'de-DE' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('de-DE')}
                      className="w-full"
                    >
                      German
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  onClick={startRecognition}
                  disabled={isListening || status !== 'connected'}
                >
                  Start Listening
                </Button>
                <Button
                  onClick={stopRecognition}
                  disabled={!isListening}
                  variant="destructive"
                >
                  Stop Listening
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Live Transcript</CardTitle>
                <CardDescription>Your speech transcription in real-time</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearTranscript}>
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded min-h-32 max-h-64 overflow-auto font-mono text-sm">
                {transcriptSegments.map((segment, index) => (
                  <span 
                    key={index} 
                    className={segment.isFinal ? 'font-medium' : 'text-muted-foreground'}
                  >
                    {segment.text} {' '}
                  </span>
                ))}
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {interimTranscript}
                  </span>
                )}
                {transcriptSegments.length === 0 && !interimTranscript && (
                  <div className="text-center py-8 text-muted-foreground">
                    Start listening and speak to see transcription here
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Debug Logs</CardTitle>
                <CardDescription>WebSocket and speech recognition logs</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearLogs}>
                Clear Logs
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded h-64 overflow-auto font-mono text-sm">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={`mb-1 ${
                        log.type === 'error' ? 'text-red-500' :
                        log.type === 'warning' ? 'text-amber-500' :
                        log.type === 'received' ? 'text-green-500' :
                        log.type === 'sent' ? 'text-blue-500' :
                        'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      [{formatTimestamp(log.timestamp)}] [{log.type.toUpperCase()}] {log.message}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="student">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>WebSocket connection information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="font-semibold mr-2">Status:</span>
                  <Badge variant={status === 'connected' ? 'default' : status === 'connecting' ? 'outline' : 'destructive'}>
                    {status}
                  </Badge>
                </div>
                {sessionId && (
                  <div className="mb-4">
                    <span className="font-semibold mr-2">Session ID:</span>
                    <code className="bg-muted p-1 rounded text-xs">{sessionId}</code>
                  </div>
                )}
                <div className="mb-4">
                  <span className="font-semibold mr-2">Language:</span>
                  <Badge variant="outline">
                    {languageCode}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  onClick={() => {
                    updateRole('student');
                    connect();
                  }}
                  disabled={status === 'connected' || status === 'connecting'}
                >
                  Connect as Student
                </Button>
                <Button
                  onClick={disconnect}
                  disabled={status === 'disconnected'}
                  variant="destructive"
                >
                  Disconnect
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Language Selection</CardTitle>
                <CardDescription>Choose your preferred language</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <span className="font-semibold mb-2 block">Select Language:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={languageCode === 'en-US' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('en-US')}
                      className="w-full"
                    >
                      English
                    </Button>
                    <Button
                      variant={languageCode === 'es-ES' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('es-ES')}
                      className="w-full"
                    >
                      Spanish
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant={languageCode === 'fr-FR' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('fr-FR')}
                      className="w-full"
                    >
                      French
                    </Button>
                    <Button
                      variant={languageCode === 'de-DE' ? 'default' : 'outline'}
                      onClick={() => updateLanguage('de-DE')}
                      className="w-full"
                    >
                      German
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Received Translations</CardTitle>
              <CardDescription>Messages translated to your language</CardDescription>
            </CardHeader>
            <CardContent>
              {translations.length > 0 ? (
                <div className="space-y-4">
                  {translations.slice().reverse().map((translation, index) => (
                    <div key={index} className="border rounded p-4">
                      <div className="font-semibold">Original: <span className="font-normal">{translation.data?.originalText}</span></div>
                      <div className="font-semibold mt-2">Translated: <span className="font-normal">{translation.data?.translatedText}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No translations received yet
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
              <CardDescription>WebSocket communication logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded h-64 overflow-auto font-mono text-sm">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={`mb-1 ${
                        log.type === 'error' ? 'text-red-500' :
                        log.type === 'warning' ? 'text-amber-500' :
                        log.type === 'received' ? 'text-green-500' :
                        log.type === 'sent' ? 'text-blue-500' :
                        'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      [{formatTimestamp(log.timestamp)}] [{log.type.toUpperCase()}] {log.message}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}