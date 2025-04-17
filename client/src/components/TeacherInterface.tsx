import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AudioWaveform from '@/components/AudioWaveform';
import LanguageSelector from '@/components/LanguageSelector';
import TranscriptionServiceSelector from '@/components/TranscriptionServiceSelector';
import SimpleSpeechRecognition from '@/components/SimpleSpeechRecognition';
import SimpleBrowserSpeechRecognition from '@/components/SimpleBrowserSpeechRecognition';
import DirectSpeechTranscription from '@/components/DirectSpeechTranscription';
import { apiRequest } from '@/lib/queryClient';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranscriptionService } from '@/hooks/useTranscriptionService';
import { formatLatency, formatDuration } from '@/lib/openai';
import { Mic, Languages, Play, Timer, Plus, CheckCircle, Subtitles } from 'lucide-react';
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
  // Always use Web Speech API since OpenAI is out of credits
  const [transcriptionService, setTranscriptionService] = useState<TranscriptionServiceType>(TRANSCRIPTION_SERVICE);

  // CRITICAL: Lock the role as 'teacher' immediately when component mounts
  // This is to prevent race conditions with other component registrations
  useEffect(() => {
    if (!roleInitialized) {
      console.log('TeacherInterface mounting: Setting and locking teacher role');
      
      // First, check if we're already connected but with the wrong role
      if (wsClient.getStatus() === 'connected') {
        const socket = wsClient.getSocket();
        if (socket && socket.url.includes('role=student')) {
          console.warn('TeacherInterface: Connected with student role! Forcing reconnect as teacher...');
          wsClient.disconnect();
          
          // Wait for disconnect to complete
          setTimeout(() => {
            wsClient.setRoleAndLock('teacher');
            wsClient.connect();
          }, 500);
        } else {
          // Just set and lock the role
          wsClient.setRoleAndLock('teacher');
        }
      } else {
        // Not connected, so set role and connect
        wsClient.setRoleAndLock('teacher');
        wsClient.connect();
      }
      
      // Very aggressive double-check of role after a short delay
      setTimeout(() => {
        if (wsClient.currentRole !== 'teacher' || !wsClient.isRoleLocked) {
          console.warn('TeacherInterface: Role still not teacher after delay! Emergency fix...');
          wsClient.disconnect();
          setTimeout(() => {
            wsClient.setRoleAndLock('teacher');
            wsClient.connect();
          }, 500);
        } else {
          console.log('TeacherInterface: Role verified as teacher after delay');
        }
      }, 1000);
      
      // Add a periodic check to make sure role remains locked
      const roleCheckInterval = setInterval(() => {
        const currentRole = wsClient.currentRole;
        const isLocked = wsClient.isRoleLocked;
        const socket = wsClient.getSocket();
        
        console.log(`TeacherInterface: Role check - current=${currentRole}, locked=${isLocked}, socket=${socket ? 'connected' : 'disconnected'}`);
        
        if (currentRole !== 'teacher' || !isLocked) {
          console.warn('TeacherInterface: Role was changed or unlocked! Re-locking...');
          wsClient.setRoleAndLock('teacher');
        }
        
        // Check URL in WebSocket connection
        if (socket && socket.url.includes('role=student')) {
          console.warn('TeacherInterface: Socket URL still contains student role! Reconnecting...');
          wsClient.disconnect();
          setTimeout(() => {
            wsClient.setRoleAndLock('teacher');
            wsClient.connect();
          }, 500);
        }
        
      }, 5000); // Check every 5 seconds
      
      setRoleInitialized(true);
      console.log('TeacherInterface: Initialized and locked role as teacher');
      
      // Clear interval on component unmount
      return () => clearInterval(roleCheckInterval);
    }
  }, [roleInitialized]);
  
  // Fetch available languages
  const { data: languages = [] } = useQuery<Languages[]>({
    queryKey: ['/api/languages'],
  });
  
  const inputLanguages = languages.filter(lang => 
    lang.code.startsWith('en-')
  );
  
  const targetLanguages = languages.filter(lang => 
    !lang.code.startsWith('en-') && lang.isActive
  );
  
  // Audio capture setup
  const { 
    isRecording,
    devices,
    selectedDeviceId,
    error: audioError,
    isLoading,
    startRecording,
    stopRecording,
    forceStop,
    toggleRecording,
    selectDevice,
    loadDevices,
    getAudioCaptureInstance,
    requestPermission
  } = useAudioCapture({
    onDataAvailable: (base64Data) => {
      console.log('Audio data captured, sending to server...');
      translation.sendAudioData(base64Data);
    }
  });
  
  // CRITICAL FIX: Force the role to be 'teacher' and ensure it's locked
  // This is to prevent race conditions with other components
  useEffect(() => {
    // Directly access the singleton instance and forcibly set the role
    console.log('TeacherInterface: DIRECT ACCESS - Forcing wsClient to teacher role');
    wsClient.setRoleAndLock('teacher');
    
    // If not connected, connect now
    if (wsClient.getStatus() === 'disconnected') {
      wsClient.connect();
    }
    
    // Safety check - 100ms after setup
    setTimeout(() => {
      if (wsClient.currentRole !== 'teacher') {
        console.error('TeacherInterface: EMERGENCY ROLE FIX - Role still not teacher after direct access');
        wsClient.disconnect();
        setTimeout(() => {
          wsClient.setRoleAndLock('teacher');
          wsClient.connect();
        }, 100);
      }
    }, 100);
  }, []);

  // Translation setup with forced teacher role
  const translation = useTranslation({
    role: 'teacher',
    languageCode: selectedInputLanguage,
    autoConnect: true,
    forceTeacherRole: true // Add special flag for forced teacher role
  });
  
  // Initialize our transcription service with Web Speech API 
  // Note: We're using this for consistent behavior with audio recording,
  // rather than using SimpleBrowserSpeechRecognition separately
  const transcriptionSvc = useTranscriptionService(
    'web_speech', // Force Web Speech API use
    {
      language: selectedInputLanguage,
      continuous: true,
      interimResults: true,
      role: 'teacher',
    },
    {
      onTranscriptionResult: (result) => {
        // When we get a transcription from the service, update the UI
        if (result.text.trim().length > 0) {
          console.log(`Received transcription (${result.isFinal ? 'final' : 'interim'}):", ${result.text}`);
          
          // Use requestAnimationFrame to reduce flicker
          window.requestAnimationFrame(() => {
            setDisplayedSpeech(result.text);
          });
        }
      }
    }
  );
  
  // Keep local state of current speech for direct rendering
  const [displayedSpeech, setDisplayedSpeech] = useState<string | JSX.Element>('');
  const [interimDisplayedSpeech, setInterimDisplayedSpeech] = useState<string>('');

  // Direct WebSocket event listener for raw translation data
  useEffect(() => {
    const handleRawTranslation = (data: any) => {
      console.log("DIRECT TRANSLATION EVENT:", data);
      
      if (!data || !data.data) {
        console.error('Invalid translation data structure:', data);
        return;
      }
      
      const { translatedText } = data.data;
      
      if (translatedText) {
        console.log("DIRECT TRANSLATION TEXT RECEIVED:", translatedText);
        
        // Special handling for test content
        if (translatedText.includes("Detected test audio pattern")) {
          setDisplayedSpeech(
            <div className="text-amber-600 font-medium">
              <span className="inline-block mr-2">⚠️</span> 
              {translatedText}
            </div> as any
          );
        } else {
          // Force UI update but don't change the display text
          setDisplayedSpeech('');
          setTimeout(() => {
            setDisplayedSpeech(translatedText.toString());
            console.log("FORCE SET DISPLAYED SPEECH:", translatedText);
          }, 10);
        }
      }
    };
    
    // Get direct access to the WebSocket client
    if (wsClient) {
      console.log("Adding direct translation event listener");
      wsClient.addEventListener('translation', handleRawTranslation);
      
      return () => {
        wsClient.removeEventListener('translation', handleRawTranslation);
      };
    }
  }, []);
  
  // Also keep the original listener for backward compatibility
  useEffect(() => {
    console.log("TeacherInterface detected change in currentSpeech:", translation.currentSpeech);
    if (translation.currentSpeech) {
      // Check if it's a test content warning message
      if (translation.currentSpeech.includes("Detected test audio pattern")) {
        // Style the warning message differently
        setDisplayedSpeech(
          <div className="text-amber-600 font-medium">
            <span className="inline-block mr-2">⚠️</span> 
            {translation.currentSpeech}
          </div> as any
        );
      } else {
        // Force UI update but don't change the display text
        setDisplayedSpeech('');
        setTimeout(() => {
          setDisplayedSpeech(translation.currentSpeech);
          console.log("SET DISPLAYED SPEECH FROM HOOK:", translation.currentSpeech);
        }, 10);
      }
    }
  }, [translation.currentSpeech]);
  
  // Update transcription service when selected language changes
  useEffect(() => {
    // Update the language in the WebSocket client
    if (wsClient && wsClient.currentRole === 'teacher') {
      console.log(`Updating WebSocket language to ${selectedInputLanguage}`);
      wsClient.register('teacher', selectedInputLanguage);
    }
    
    // The TranscriptionService is now just a placeholder that we're not really using
    // Instead of recreating it, just log that we would update the language
    console.log(`Speech recognition language updated to ${selectedInputLanguage}`);
  }, [selectedInputLanguage, transcriptionService]);
  
  // Request microphone permission on mount - only once
  useEffect(() => {
    // Check if browser supports required audio APIs
    if (typeof navigator === 'undefined' || 
        !navigator.mediaDevices || 
        !navigator.mediaDevices.getUserMedia) {
      console.error('Browser does not support required audio APIs');
      return;
    }
    
    // One-time initialization
    let isMounted = true;
    
    async function initMicrophone() {
      console.log('Initializing microphone...');
      try {
        // First, try to just load devices - this works if permission is already granted
        await loadDevices();
        
        // If we didn't get any devices but we're still mounted, try requesting permission
        if (isMounted && devices.length === 0 && !isLoading) {
          console.log('No devices found, requesting permission...');
          const success = await requestPermission();
          console.log('Permission request result:', success);
        }
      } catch (err) {
        console.error('Error initializing microphone:', err);
      }
    }
    
    initMicrophone();
    
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - run only once on mount
  
  // Play a preview of the translation
  const handlePreviewAudio = (audioUrl: string) => {
    if (audioUrl) {
      translation.playAudio(audioUrl);
    }
  };
  
  // Format latency for display
  const getLatencyClass = (latency: number) => {
    if (latency < 1500) return 'text-success';
    if (latency < 3000) return 'text-warning';
    return 'text-error';
  };
  
  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Audio Input Section */}
      <div className="flex-1">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-bold text-lg mb-4 flex items-center">
              <Mic className="h-5 w-5 mr-2 text-primary" />
              Audio Input
            </h2>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Microphone</Label>
                <div className="flex items-center">
                  {isLoading ? (
                    <span className="text-xs text-gray-500">Loading...</span>
                  ) : devices.length === 0 ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mr-2 text-xs"
                      onClick={requestPermission}
                    >
                      Allow Mic Access
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {isRecording ? 
                          <span className="text-success">Recording</span> : 
                          <span className="text-gray-600">Enabled</span>
                        }
                      </span>
                      {isRecording ? (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="px-2 py-1 h-7 text-xs"
                          onClick={() => {
                            console.log('Stop recording button clicked');
                            
                            try {
                              // Stop transcription service first
                              console.log('Stopping transcription service:', transcriptionService);
                              transcriptionSvc.stop();
                            
                              // First attempt - normal stop via hook
                              console.log('1. Trying normal stopRecording method');
                              const result = stopRecording();
                              console.log('Normal stop result:', result);
                              
                              // Second attempt - if still recording, use forceStop
                              setTimeout(() => {
                                if (isRecording) {
                                  console.log('2. Still recording! Trying forceStop method');
                                  forceStop();
                                }
                              }, 300);
                            } catch (err) {
                              console.error('Error stopping recording:', err);
                            }
                          }}
                        >
                          Stop
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="default"
                          className="px-3 py-1 h-7 text-xs"
                          onClick={() => {
                            console.log('Start recording button clicked');
                            
                            try {
                              // First start the transcription service
                              console.log('Starting transcription service:', transcriptionService);
                              transcriptionSvc.start();
                              
                              // Then start audio recording
                              console.log('Starting audio recording...');
                              startRecording();
                            } catch (err) {
                              console.error('Error starting recording:', err);
                            }
                          }}
                        >
                          Record
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {devices.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs text-gray-500 mb-1" htmlFor="audioDevice">
                    Audio Device
                  </Label>
                  <Select
                    value={selectedDeviceId}
                    onValueChange={selectDevice}
                  >
                    <SelectTrigger 
                      id="audioDevice" 
                      className="w-full text-xs h-8"
                    >
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map(device => (
                        <SelectItem 
                          key={device.deviceId} 
                          value={device.deviceId}
                          className="text-xs"
                        >
                          {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="mb-4">
                <Label className="text-xs text-gray-500 mb-1" htmlFor="inputLanguage">
                  Speech Language
                </Label>
                <Select
                  value={selectedInputLanguage}
                  onValueChange={setSelectedInputLanguage}
                >
                  <SelectTrigger 
                    id="inputLanguage" 
                    className="w-full text-xs h-8"
                  >
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {inputLanguages.map(language => (
                      <SelectItem 
                        key={language.code} 
                        value={language.code}
                        className="text-xs"
                      >
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-500" htmlFor="transcriptionService">
                    Transcription Service
                  </Label>
                </div>
                <div className="bg-blue-50 text-blue-800 p-2 text-xs rounded">
                  Using Browser Speech API (Web Speech) - compatible with all browsers
                </div>
              </div>
              
              {isRecording && (
                <div className="mb-4">
                  <Label className="text-xs text-gray-500 mb-1">
                    Audio Levels
                  </Label>
                  <AudioWaveform 
                    audioSourceId={selectedDeviceId} 
                    className="h-12 border rounded p-2"
                  />
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 rounded p-3 border">
              <h3 className="text-sm font-medium mb-2 flex justify-between">
                <span>Speech Recognition</span>
                <span className="text-xs text-gray-500">
                  Direct Browser API (No OpenAI)
                </span>
              </h3>
              
              {/* Simple browser speech recognition UI */}
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-sm font-medium mb-2">Speech Recognition Status:</div>
                <div className="mb-3">
                  {isRecording ? (
                    <div className="text-success flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                      Recording active - Speech will appear here
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      Press the "Record" button above to start speech recognition
                    </div>
                  )}
                </div>
              </div>
              
              {/* Debug panel for verifying speech recognition */}
              <div className="mt-3 p-2 border border-dashed border-yellow-300 bg-yellow-50 rounded text-xs">
                <details>
                  <summary className="font-medium text-yellow-700 cursor-pointer">Debug Info</summary>
                  <div className="mt-2 space-y-1">
                    <div><strong>displayedSpeech:</strong> {displayedSpeech || '(empty)'}</div>
                    <div><strong>translation.currentSpeech:</strong> {translation.currentSpeech || '(empty)'}</div>
                    <div><strong>WebSocket Status:</strong> {translation.status}</div>
                    <div><strong>Translation Count:</strong> {translation.metrics.translationsCount}</div>
                    
                    {/* Transcription Service Status */}
                    <div className="mt-2 pt-2 border-t border-yellow-200">
                      <div><strong>Service Type:</strong> {transcriptionService}</div>
                      <div><strong>Status:</strong> {transcriptionSvc.isActive ? 
                        <span className="text-green-600">Active</span> : 
                        <span className="text-gray-500">Standby</span>}
                      </div>
                      <div><strong>Current Transcript:</strong> {transcriptionSvc.currentText || transcriptionSvc.finalText || '(empty)'}</div>
                      {transcriptionSvc.error && (
                        <div className="text-red-500"><strong>Error:</strong> {String(transcriptionSvc.error)}</div>
                      )}
                    </div>
                    
                    <button 
                      onClick={() => setDisplayedSpeech('This is a test speech to verify the UI updates correctly.')}
                      className="mt-2 px-2 py-1 bg-yellow-200 hover:bg-yellow-300 rounded text-yellow-800"
                    >
                      Test Display Update
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Translation Output Section */}
      <div className="flex-1">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-bold text-lg mb-4 flex items-center">
              <Languages className="h-5 w-5 mr-2 text-primary" />
              Translation Output
            </h2>
            
            <div className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Languages */}
                {targetLanguages.map(language => (
                  <div key={language.code} className="p-3 rounded border bg-white hover:shadow-sm transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{language.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-success text-white">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 flex items-center">
                      <Timer className="h-3 w-3 mr-1" />
                      Latency: 
                      <span className={`font-medium ml-1 ${getLatencyClass(translation.metrics.averageLatency)}`}>
                        {formatLatency(translation.metrics.averageLatency)}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs text-primary hover:text-primary/90 font-medium p-0 h-auto"
                      onClick={() => translation.audioUrl && handlePreviewAudio(translation.audioUrl)}
                      disabled={!translation.audioUrl}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Preview audio
                    </Button>
                  </div>
                ))}
                
                {/* Add Languages Button */}
                <div className="p-3 rounded border border-dashed bg-gray-50 hover:bg-gray-100 cursor-pointer transition flex items-center justify-center h-[96px]">
                  <Plus className="h-4 w-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-500">Add language</span>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Performance</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded p-2 border">
                  <div className="text-xl font-medium text-success">
                    {formatLatency(translation.metrics.averageLatency)}
                  </div>
                  <div className="text-xs text-gray-500">Avg. Latency</div>
                </div>
                <div className="bg-gray-50 rounded p-2 border">
                  <div className="text-xl font-medium text-primary">
                    {translation.metrics.translationsCount}
                  </div>
                  <div className="text-xs text-gray-500">Translations</div>
                </div>
                <div className="bg-gray-50 rounded p-2 border">
                  <div className="text-xl font-medium text-info">
                    {formatDuration(translation.getSessionDuration())}
                  </div>
                  <div className="text-xs text-gray-500">Session Time</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded p-3 border">
              <h3 className="text-sm font-medium mb-2">System Status</h3>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">API Connection</span>
                  <span className="text-xs font-medium flex items-center text-success">
                    <span className="inline-block w-2 h-2 rounded-full bg-success mr-1"></span>
                    Connected
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">WebSocket</span>
                  <span className={`text-xs font-medium flex items-center ${
                    translation.status === 'connected' ? 'text-success' : 'text-error'
                  }`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                      translation.status === 'connected' ? 'bg-success' : 'bg-error'
                    }`}></span>
                    {translation.status === 'connected' 
                      ? 'Connected' 
                      : translation.status === 'connecting' 
                        ? 'Connecting...' 
                        : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Audio Processing</span>
                  <span className="text-xs font-medium flex items-center text-success">
                    <span className="inline-block w-2 h-2 rounded-full bg-success mr-1"></span>
                    Operational
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherInterface;