import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { WebSocketClient, ConnectionStatus as WebSocketStatus, UserRole } from '../services/WebSocketClient';

/**
 * Test Page for WebSocket Functionality
 * 
 * This page provides a simple interface to test WebSocket functionality:
 * - Connection management (connect/disconnect)
 * - Role management (teacher/student)
 * - Sending transcription/audio messages
 * - Receiving messages from server
 * - Session information display
 */
export default function FixedTestPage() {
  // State
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('teacher');
  const [languageCode, setLanguageCode] = useState<string>('en-US');
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  
  // State for log messages
  const [logs, setLogs] = useState<{ type: string; message: string; timestamp: Date }[]>([]);
  // State for transcription text
  const [transcriptionText, setTranscriptionText] = useState('');
  // State for last received message
  const [lastMessage, setLastMessage] = useState<any>(null);
  // State for translation messages
  const [translations, setTranslations] = useState<any[]>([]);
  
  // Initialize WebSocket client
  useEffect(() => {
    // Use the global instance if available
    if (typeof window !== 'undefined' && window.wsClient) {
      setWsClient(window.wsClient);
      addLog('info', 'Using global WebSocketClient instance');
      
      // Set up status listener
      window.wsClient.addEventListener('status', (newStatus: WebSocketStatus) => {
        setStatus(newStatus);
        addLog('status', `Status changed to: ${newStatus}`);
      });
      
      // Set up session ID listener
      window.wsClient.addEventListener('connection', (message: any) => {
        if (message.sessionId) {
          setSessionId(message.sessionId);
          addLog('info', `Received session ID: ${message.sessionId}`);
        }
      });
      
      // Set up message listener
      window.wsClient.addEventListener('message', (message: any) => {
        setLastMessage(message);
        addLog('received', `Received message: ${JSON.stringify(message)}`);
        
        // Process translation messages
        if (message.type === 'translation') {
          setTranslations(prev => [...prev, message]);
        }
      });
      
      return () => {
        // No need to remove listeners - this is a global instance
      };
    } else {
      addLog('error', 'WebSocketClient instance not found in window object');
      
      // Create a new instance
      const client = new WebSocketClient();
      setWsClient(client);
      addLog('info', 'Created new WebSocketClient instance');
      
      // Set up listeners
      client.addEventListener('status', (newStatus: WebSocketStatus) => {
        setStatus(newStatus);
        addLog('status', `Status changed to: ${newStatus}`);
      });
      
      client.addEventListener('connection', (message: any) => {
        if (message.sessionId) {
          setSessionId(message.sessionId);
          addLog('info', `Received session ID: ${message.sessionId}`);
        }
      });
      
      client.addEventListener('message', (message: any) => {
        setLastMessage(message);
        addLog('received', `Received message: ${JSON.stringify(message)}`);
        
        // Process translation messages
        if (message.type === 'translation') {
          setTranslations(prev => [...prev, message]);
        }
      });
      
      return () => {
        // Clean up
        client.disconnect();
      };
    }
  }, []);
  
  // Add a log message
  const addLog = (type: string, message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Connect to WebSocket server
  const connect = () => {
    if (wsClient) {
      wsClient.connect();
      addLog('info', 'Connecting to WebSocket server...');
    } else {
      addLog('error', 'WebSocketClient instance not available');
    }
  };
  
  // Disconnect from WebSocket server
  const disconnect = () => {
    if (wsClient) {
      wsClient.disconnect();
      addLog('info', 'Disconnected from WebSocket server');
    } else {
      addLog('error', 'WebSocketClient instance not available');
    }
  };
  
  // Update role
  const updateRole = (newRole: UserRole) => {
    if (wsClient) {
      wsClient.register(newRole, languageCode);
      setRole(newRole);
      addLog('info', `Role updated to: ${newRole}`);
    } else {
      addLog('error', 'WebSocketClient instance not available');
    }
  };
  
  // Update language
  const updateLanguage = (newLanguageCode: string) => {
    if (wsClient) {
      wsClient.register(role, newLanguageCode);
      setLanguageCode(newLanguageCode);
      addLog('info', `Language updated to: ${newLanguageCode}`);
    } else {
      addLog('error', 'WebSocketClient instance not available');
    }
  };
  
  // Send test message
  const sendTestMessage = () => {
    if (!wsClient) {
      addLog('error', 'WebSocketClient instance not available');
      return;
    }
    
    if (transcriptionText.trim()) {
      try {
        wsClient.sendTranscription(transcriptionText);
        addLog('sent', `Sent transcription: "${transcriptionText}"`);
      } catch (error) {
        addLog('error', `Failed to send transcription: ${error}`);
      }
    } else {
      addLog('warning', 'Cannot send empty transcription');
    }
  };
  
  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  return (
    <div className="container max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">WebSocket Testing Interface (Fixed)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Management */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>Manage WebSocket connection</CardDescription>
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
            <Button onClick={connect} disabled={status === 'connected' || status === 'connecting'}>
              Connect
            </Button>
            <Button onClick={disconnect} disabled={status === 'disconnected'} variant="destructive">
              Disconnect
            </Button>
          </CardFooter>
        </Card>
        
        {/* Role Management */}
        <Card>
          <CardHeader>
            <CardTitle>Role & Language</CardTitle>
            <CardDescription>Change your role and language settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <span className="font-semibold mb-2 block">Select Role:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={role === 'teacher' ? 'default' : 'outline'}
                    onClick={() => updateRole('teacher')}
                    className="w-full"
                  >
                    Teacher
                  </Button>
                  <Button
                    variant={role === 'student' ? 'default' : 'outline'}
                    onClick={() => updateRole('student')}
                    className="w-full"
                  >
                    Student
                  </Button>
                </div>
              </div>
              
              <div>
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
            </div>
          </CardContent>
        </Card>
        
        {/* Message Sending */}
        <Card>
          <CardHeader>
            <CardTitle>Send Messages</CardTitle>
            <CardDescription>Send test messages to the server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="transcription" className="font-semibold mb-2 block">Transcription Text:</label>
                <Textarea
                  id="transcription"
                  placeholder="Enter text to send as transcription..."
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              onClick={sendTestMessage}
              disabled={status !== 'connected' || !transcriptionText.trim()}
            >
              Send Transcription
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="mt-8">
        <Tabs defaultValue="messages">
          <TabsList className="mb-4">
            <TabsTrigger value="messages">Received Messages</TabsTrigger>
            <TabsTrigger value="translations">Translations</TabsTrigger>
            <TabsTrigger value="logs">Log History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="messages" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Last Received Message</CardTitle>
                <CardDescription>The most recent message from the server</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded overflow-auto max-h-48">
                  {lastMessage ? JSON.stringify(lastMessage, null, 2) : 'No messages received yet'}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="translations" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Translation Messages</CardTitle>
                <CardDescription>Translated messages received from the server</CardDescription>
              </CardHeader>
              <CardContent>
                {translations.length > 0 ? (
                  <div className="space-y-4">
                    {translations.slice().reverse().map((translation, index) => (
                      <div key={index} className="border rounded p-4">
                        <div className="font-semibold">Original: <span className="font-normal">{translation.data.originalText}</span></div>
                        <div className="font-semibold mt-2">Translated ({translation.data.languageCode}): <span className="font-normal">{translation.data.translatedText}</span></div>
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
          </TabsContent>
          
          <TabsContent value="logs" className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Log History</CardTitle>
                  <CardDescription>WebSocket communication logs</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  Clear Logs
                </Button>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded h-96 overflow-auto font-mono text-sm">
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
    </div>
  );
}