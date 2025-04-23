import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranscriptionService } from '@/hooks/useTranscriptionService';
import { formatLatency, formatDuration } from '@/lib/openai';
import { Mic, Languages, Play, Timer, Plus } from 'lucide-react';
import { wsClient } from '@/lib/websocket';
import { TranscriptionServiceType } from '@/lib/transcription/TranscriptionFactory';

// Force Web Speech API as the only option since OpenAI credits are depleted
const TRANSCRIPTION_SERVICE: TranscriptionServiceType = 'web_speech';

interface Languages {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export const TeacherInterface: React.FC = () => {
  const [selectedInputLanguage, setSelectedInputLanguage] = useState('en-US');
  const [roleInitialized, setRoleInitialized] = useState(false);
  const [transcriptionService, setTranscriptionService] = useState<TranscriptionServiceType>(TRANSCRIPTION_SERVICE);
  
  // Keep local state of current speech for direct rendering
  const [displayedSpeech, setDisplayedSpeech] = useState<string | JSX.Element>('');
  
  // Lock teacher role on mount
  useEffect(() => {
    if (!roleInitialized) {
      console.log('TeacherInterface mounting: Setting and locking teacher role');
      wsClient.setRoleAndLock('teacher');
      wsClient.connect();
      setRoleInitialized(true);
    }
  }, [roleInitialized]);
  
  // Audio capture setup
  const { 
    isRecording,
    startRecording,
    stopRecording,
    forceStop
  } = useAudioCapture({
    onDataAvailable: (base64Data) => {
      console.log('Audio data captured, sending to server...');
      translation.sendAudioData(base64Data);
    }
  });
  
  // Translation setup with forced teacher role
  const translation = useTranslation({
    role: 'teacher',
    languageCode: selectedInputLanguage,
    autoConnect: true,
    forceTeacherRole: true
  });
  
  // Initialize transcription service
  const transcriptionSvc = useTranscriptionService(
    'web_speech',
    {
      language: selectedInputLanguage,
      continuous: true,
      interimResults: true,
      role: 'teacher',
    },
    {
      onTranscriptionResult: (result) => {
        if (result.text.trim().length > 0) {
          setDisplayedSpeech(result.text);
          
          if (result.isFinal && wsClient) {
            wsClient.sendTranscription(result.text);
          }
        }
      }
    }
  );
  
  // Function to simulate speech for testing
  const simulateSpeech = useCallback((text: string) => {
    setDisplayedSpeech(text);
    
    if (wsClient) {
      console.log('Sending simulated transcription to server:', text);
      wsClient.sendTranscription(text);
    }
  }, []);
  
  return (
    <div className="flex flex-col gap-4">
      {/* Quick Navigation Bar */}
      <div className="bg-white p-3 rounded-md border shadow-sm mb-2">
        <div className="flex flex-wrap gap-2 justify-center">
          <a href="/" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">
            Home
          </a>
          <a href="/test" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">
            WebSocket Test
          </a>
          <a href="/speechtest" className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded text-sm font-medium">
            Speech Test
          </a>
          <a href="/student" className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">
            Student View
          </a>
        </div>
      </div>
      
      {/* Quick Debug Panel for Testing */}
      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-300 shadow-sm mb-2">
        <h3 className="text-sm font-semibold mb-2">Quick Testing Tools</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button 
            onClick={() => setDisplayedSpeech('This is a test speech for the Current Speech display.')}
            className="px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-yellow-800 text-sm"
          >
            Test UI Update
          </button>
          <button 
            onClick={() => wsClient.setRoleAndLock('teacher')}
            className="px-2 py-1 bg-green-200 hover:bg-green-300 rounded text-green-800 text-sm"
          >
            Force Teacher Role
          </button>
        </div>
        
        {/* Manual text input for testing */}
        <div className="flex gap-2">
          <input 
            type="text" 
            id="quick-test-speech-input"
            placeholder="Type test speech here and press Enter or Send..."
            className="flex-1 px-2 py-1 text-sm border rounded text-gray-800"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = document.getElementById('quick-test-speech-input') as HTMLInputElement;
                if (input.value) {
                  simulateSpeech(input.value);
                  input.value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('quick-test-speech-input') as HTMLInputElement;
              if (input.value) {
                simulateSpeech(input.value);
                input.value = '';
              }
            }}
            className="px-3 py-1 bg-primary text-white rounded text-sm whitespace-nowrap"
          >
            Send Test Speech
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-bold text-lg mb-4">Speech Recognition</h2>
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-sm font-medium mb-2">Recognition Status:</div>
                <div className="mb-3">
                  {isRecording ? (
                    <div className="text-success flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                      Recording active
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      Press Record or use manual input above
                    </div>
                  )}
                </div>
                
                {/* Current Speech Display */}
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Current Speech:</div>
                  <div className="p-3 bg-white border rounded-md min-h-[60px] shadow-sm">
                    {displayedSpeech ? (
                      <div className="text-md">{displayedSpeech}</div>
                    ) : translation.currentSpeech ? (
                      <div className="text-md">{translation.currentSpeech}</div>
                    ) : (
                      <div className="text-gray-400 italic">
                        {isRecording ? "Speak now..." : "No speech detected yet"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Debug Info */}
              <div className="mt-3 p-2 border border-dashed border-yellow-300 bg-yellow-50 rounded text-xs">
                <details open>
                  <summary className="font-medium text-yellow-700 cursor-pointer">Debug Info</summary>
                  <div className="mt-2 space-y-1">
                    <div><strong>WebSocket Status:</strong> {translation.status}</div>
                    <div><strong>WebSocket Role:</strong> {wsClient.currentRole || 'None'}</div>
                    <div><strong>WebSocket Role Locked:</strong> {wsClient.isRoleLocked ? 'Yes' : 'No'}</div>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right Column */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-bold text-lg mb-4">Controls</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {isRecording ? (
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        try {
                          transcriptionSvc.stop();
                          stopRecording();
                        } catch (err) {
                          console.error('Error stopping recording:', err);
                        }
                      }}
                    >
                      Stop Recording
                    </Button>
                  ) : (
                    <Button 
                      variant="default"
                      onClick={() => {
                        try {
                          transcriptionSvc.start();
                          startRecording();
                        } catch (err) {
                          console.error('Error starting recording:', err);
                        }
                      }}
                    >
                      Start Recording
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => setDisplayedSpeech('')}
                  >
                    Clear Display
                  </Button>
                </div>
                
                <div>
                  <Label className="text-sm">Speech Language</Label>
                  <Select 
                    value={selectedInputLanguage}
                    onValueChange={setSelectedInputLanguage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="fr-FR">French</SelectItem>
                      <SelectItem value="es-ES">Spanish</SelectItem>
                      <SelectItem value="de-DE">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TeacherInterface;