import React, { useState, useEffect, useRef } from 'react';
import { webSocketClient, ConnectionStatus, UserRole } from '../lib/websocket';

/**
 * Fixed Test Page
 * A simple page to test WebSocket functionality with direct access to the singleton
 */
const FixedTestPage: React.FC = () => {
  // State 
  const [status, setStatus] = useState<ConnectionStatus>(webSocketClient.getStatus());
  const [sessionId, setSessionId] = useState<string | null>(webSocketClient.getSessionId());
  const [role, setRole] = useState<UserRole | null>(webSocketClient.getRole() || 'teacher');
  const [language, setLanguage] = useState<string>(webSocketClient.getLanguageCode() || 'en-US');
  const [message, setMessage] = useState<string>('');
  const [translations, setTranslations] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  
  const logsRef = useRef<HTMLDivElement>(null);
  
  // Connect to WebSocket
  const handleConnect = async () => {
    addLog('Connecting...');
    
    try {
      await webSocketClient.connect();
      addLog('Connected successfully');
      registerRoleAndLanguage();
    } catch (error) {
      addLog(`Connection error: ${error}`);
    }
  };
  
  // Disconnect from WebSocket
  const handleDisconnect = () => {
    webSocketClient.disconnect();
    addLog('Disconnected');
  };
  
  // Register role and language
  const registerRoleAndLanguage = () => {
    webSocketClient.register(role as UserRole, language);
    addLog(`Registered as ${role} with language ${language}`);
  };
  
  // Change role
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (status === 'connected') {
      webSocketClient.register(newRole, language);
      addLog(`Changed role to ${newRole}`);
    }
  };
  
  // Change language
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (status === 'connected') {
      webSocketClient.register(role as UserRole, newLanguage);
      addLog(`Changed language to ${newLanguage}`);
    }
  };
  
  // Send transcription
  const handleSendMessage = () => {
    if (!message.trim()) {
      addLog('Cannot send empty message');
      return;
    }
    
    webSocketClient.sendTranscription(message);
    addLog(`Sent: ${message}`);
    setMessage('');
  };
  
  // Add log
  const addLog = (text: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
    
    // Scroll to bottom of logs
    setTimeout(() => {
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    }, 0);
  };
  
  // Setup event listeners
  useEffect(() => {
    // Status change listener
    const handleStatusChange = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };
    
    // Connection established listener
    const handleConnection = (message: any) => {
      if (message?.type === 'connection' && message?.sessionId) {
        setSessionId(message.sessionId);
        addLog(`Connected with session ID: ${message.sessionId}`);
      }
    };
    
    // Translation listener
    const handleTranslation = (translation: any) => {
      if (translation?.text) {
        const translationText = `[${translation.originalLanguage} → ${translation.translatedLanguage}] ${translation.text}`;
        setTranslations((prev) => [...prev, translationText]);
        addLog(`Received translation: ${translationText}`);
      }
    };
    
    // Error listener
    const handleError = (error: any) => {
      addLog(`WebSocket error: ${error}`);
    };
    
    // Close listener
    const handleClose = (event: any) => {
      addLog(`Connection closed: ${event?.code} ${event?.reason || 'No reason provided'}`);
    };
    
    // Add event listeners
    webSocketClient.addEventListener('status', handleStatusChange);
    webSocketClient.addEventListener('message', handleConnection);
    webSocketClient.addEventListener('translation', handleTranslation);
    webSocketClient.addEventListener('error', handleError);
    webSocketClient.addEventListener('close', handleClose);
    
    // Initial log
    addLog('Page initialized. Click Connect to start.');
    
    // Remove event listeners on cleanup
    return () => {
      webSocketClient.removeEventListener('status', handleStatusChange);
      webSocketClient.removeEventListener('message', handleConnection);
      webSocketClient.removeEventListener('translation', handleTranslation);
      webSocketClient.removeEventListener('error', handleError);
      webSocketClient.removeEventListener('close', handleClose);
    };
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Fixed WebSocket Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Connection</h2>
          
          <div className="mb-4">
            <div className="mb-2">Status: 
              <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                status === 'connected' ? 'bg-green-100 text-green-800' : 
                status === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                status === 'error' ? 'bg-red-100 text-red-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {status}
              </span>
            </div>
            
            <div className="mb-2">Session ID: <span className="font-mono text-sm">{sessionId || 'None'}</span></div>
          </div>
          
          <div className="flex space-x-2 mb-6">
            <button 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={handleConnect}
              disabled={status === 'connected' || status === 'connecting'}
            >
              Connect
            </button>
            
            <button 
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={handleDisconnect}
              disabled={status !== 'connected'}
            >
              Disconnect
            </button>
          </div>
          
          <h3 className="text-lg font-medium mb-2">Role</h3>
          <div className="flex space-x-2 mb-4">
            <button 
              className={`px-4 py-2 rounded ${role === 'teacher' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleRoleChange('teacher')}
            >
              Teacher
            </button>
            
            <button 
              className={`px-4 py-2 rounded ${role === 'student' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleRoleChange('student')}
            >
              Student
            </button>
          </div>
          
          <h3 className="text-lg font-medium mb-2">Language</h3>
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button 
              className={`px-4 py-2 rounded ${language === 'en-US' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleLanguageChange('en-US')}
            >
              English
            </button>
            
            <button 
              className={`px-4 py-2 rounded ${language === 'es-ES' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleLanguageChange('es-ES')}
            >
              Spanish
            </button>
            
            <button 
              className={`px-4 py-2 rounded ${language === 'fr-FR' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleLanguageChange('fr-FR')}
            >
              French
            </button>
            
            <button 
              className={`px-4 py-2 rounded ${language === 'de-DE' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
              onClick={() => handleLanguageChange('de-DE')}
            >
              German
            </button>
          </div>
          
          {role === 'teacher' && (
            <div>
              <h3 className="text-lg font-medium mb-2">Send Message</h3>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && status === 'connected' && handleSendMessage()}
                  placeholder="Type a message..."
                  disabled={status !== 'connected'}
                />
                
                <button 
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={handleSendMessage}
                  disabled={status !== 'connected' || !message.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Logs</h2>
          <div 
            ref={logsRef}
            className="h-64 overflow-y-auto p-4 bg-gray-100 rounded font-mono text-sm"
          >
            {logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))}
          </div>
          
          {role === 'student' && (
            <>
              <h2 className="text-xl font-semibold mt-6 mb-4">Translations</h2>
              <div className="h-64 overflow-y-auto p-4 bg-blue-50 rounded">
                {translations.length > 0 ? (
                  translations.map((translation, index) => (
                    <div key={index} className="mb-2 p-2 bg-white rounded shadow-sm">
                      {translation}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-6">
                    No translations received yet
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Instructions</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Click <b>Connect</b> to establish a WebSocket connection</li>
          <li>Choose your <b>Role</b> (teacher or student) and <b>Language</b></li>
          <li>For testing with multiple users, open a second browser window at /fixedtest</li>
          <li>Connect as a <b>teacher</b> in one window and a <b>student</b> in the other</li>
          <li>Send messages from the teacher window and see translations in the student window</li>
        </ol>
      </div>
    </div>
  );
};

export default FixedTestPage;