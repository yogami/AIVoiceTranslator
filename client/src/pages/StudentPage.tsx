import React, { useState, useEffect, useRef } from 'react';
import { webSocketClient } from '@/lib/websocket';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

// Language Support manager to be implemented as a hook
import { useLanguageSupport } from '@/hooks/use-language-support';

interface TranslationData {
  text: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  audioData?: string;
  useClientSpeech?: boolean;
  ttsServiceType?: string;
}

interface AudioCacheItem {
  data: string;
  url: string;
  blob: Blob;
  type: string;
  size: number;
}

interface AudioCache {
  lastTranslation: {
    text: string;
    originalText: string;
    audios: Record<string, AudioCacheItem>;
  };
}

const StudentPage: React.FC = () => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // State for the main functionality
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [translation, setTranslation] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [audioCache, setAudioCache] = useState<AudioCache>({
    lastTranslation: {
      text: '',
      originalText: '',
      audios: {}
    }
  });
  const [ttsService, setTtsService] = useState('browser');
  
  // Get language support functions
  const { 
    isLanguageSupported, 
    supportedLanguages,
    languageOptions 
  } = useLanguageSupport(ttsService);

  // Function to log messages to the debug console
  const log = (message: string) => {
    setLogMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(message);
    
    // Scroll to bottom of log container
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 10);
  };

  // Connect to WebSocket on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (webSocketClient) {
        webSocketClient.disconnect();
      }
    };
  }, []);
  
  // When connected status changes, update UI
  useEffect(() => {
    updateConnectionUI(isConnected);
    
    // If connected, register as student with selected language
    if (isConnected) {
      registerAsStudent(selectedLanguage);
    }
  }, [isConnected, selectedLanguage]);
  
  // When TTS service changes, update language support
  useEffect(() => {
    // Update UI to reflect language compatibility with selected TTS service
    if (isConnected) {
      registerAsStudent(selectedLanguage);
    }
  }, [ttsService]);

  // Function to connect to WebSocket
  const connectWebSocket = async () => {
    try {
      log('Connecting to WebSocket...');
      
      // Set up event listeners before connecting
      webSocketClient.addEventListener('open', () => {
        log('WebSocket connection established');
        setIsConnected(true);
        toast({
          title: 'Connected',
          description: 'Connected to classroom',
        });
      });
      
      webSocketClient.addEventListener('close', () => {
        log('WebSocket connection closed');
        setIsConnected(false);
      });
      
      webSocketClient.addEventListener('error', (error) => {
        log(`WebSocket error: ${JSON.stringify(error)}`);
        setIsConnected(false);
        toast({
          title: 'Error',
          description: 'Connection error. Please try again.',
          variant: 'destructive',
        });
      });
      
      webSocketClient.addEventListener('message', handleWebSocketMessage);
      
      // Connect to WebSocket
      await webSocketClient.connect();
      
    } catch (error) {
      log(`Error creating WebSocket: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: 'Connection Failed',
        description: `Failed to establish connection: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  // Function to handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    const message = data;
    log(`Received message: ${JSON.stringify(message).substring(0, 200)}${JSON.stringify(message).length > 200 ? '... (truncated)' : ''}`);
    
    // Handle connection message with session ID
    if (message.type === 'connection' && message.sessionId) {
      setSessionId(message.sessionId);
      log(`Session ID: ${message.sessionId}`);
    }
    
    // Handle translation message
    if (message.type === 'translation') {
      // Check if this is audio data from a server TTS service
      const hasAudioData = message.audioData && message.audioData.length > 0;
      const useClientSpeech = message.useClientSpeech === true;
      const ttsServiceType = message.ttsServiceType || 'browser';
      
      log(`Received translation with TTS service: ${ttsServiceType}, hasAudio: ${hasAudioData}, useClientSpeech: ${useClientSpeech}`);
      
      // Store translation data
      setTranslation(message.text);
      setOriginalText(message.originalText);
      
      // If audio data is included, cache it
      if (hasAudioData) {
        handleReceivedAudio(message.text, message.targetLanguage, ttsServiceType, message.audioData);
      }
      
      // Handle text-to-speech based on service type
      if (useClientSpeech) {
        speakWithBrowserTTS(message.text, message.targetLanguage);
      } else if (hasAudioData) {
        playAudio(message.audioData);
      }
    }
    
    // Handle TTS service audio response
    if (message.type === 'tts_response') {
      const ttsService = message.ttsService || 'openai';
      const audioData = message.audioData;
      
      log(`Received TTS audio response from ${ttsService} service`);
      
      if (audioData && audioData.length > 0) {
        try {
          playAudio(audioData, ttsService);
        } catch (error) {
          log(`Error processing ${ttsService} audio: ${error instanceof Error ? error.message : String(error)}`);
          toast({
            title: 'Audio Error',
            description: `Failed to process ${getTtsServiceName(ttsService)} audio`,
            variant: 'destructive',
          });
        }
      } else {
        log(`No audio data received from ${ttsService} service`);
        toast({
          title: 'Audio Error',
          description: `No audio received from ${getTtsServiceName(ttsService)}`,
          variant: 'destructive',
        });
      }
    }
  };

  // Function to update the UI based on connection status
  const updateConnectionUI = (connected: boolean) => {
    // This will be handled by React state and conditional rendering
  };

  // Function to register as a student
  const registerAsStudent = (languageCode: string) => {
    if (!isConnected) {
      log('Cannot register, WebSocket not connected');
      toast({
        title: 'Not Connected',
        description: 'Not connected to classroom',
        variant: 'destructive',
      });
      return;
    }
    
    const message = {
      type: 'register',
      role: 'student',
      languageCode: languageCode,
      settings: {
        ttsServiceType: ttsService
      }
    };
    
    webSocketClient.register('student', languageCode);
    log(`Registered as student with language ${languageCode} and TTS service ${ttsService}`);
  };

  // Function to handle language selection change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    
    if (isConnected) {
      registerAsStudent(newLanguage);
    }
  };
  
  // Function to handle TTS service change
  const handleTtsServiceChange = (service: string) => {
    setTtsService(service);
    
    // If current language not supported by new service, switch to a supported one
    if (!isLanguageSupported(selectedLanguage, service)) {
      const firstSupported = supportedLanguages[0] || 'en-US';
      setSelectedLanguage(firstSupported);
    }
  };

  // Function to speak text using browser's built-in TTS
  const speakWithBrowserTTS = (text: string, languageCode: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      window.speechSynthesis.speak(utterance);
    } else {
      log('Browser speech synthesis not supported');
      toast({
        title: 'Speech Error',
        description: 'Your browser does not support speech synthesis',
        variant: 'destructive',
      });
    }
  };

  // Function to play audio from base64 data
  const playAudio = (audioData: string, serviceType = 'openai') => {
    try {
      // Convert base64 to blob for playback
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob and URL
      const blob = new Blob([bytes.buffer], { type: 'audio/mp3' }); 
      const audioURL = URL.createObjectURL(blob);
      
      // Update cache with new audio data
      setAudioCache(prev => ({
        ...prev,
        lastTranslation: {
          ...prev.lastTranslation,
          audios: {
            ...prev.lastTranslation.audios,
            [serviceType]: {
              data: audioData,
              url: audioURL,
              blob: blob,
              type: 'server',
              size: blob.size / 1024 // Size in KB
            }
          }
        }
      }));
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = audioURL;
        audioRef.current.play();
      }
      
      toast({
        title: 'Playing Audio',
        description: `Playing with ${getTtsServiceName(serviceType)}`,
      });
    } catch (error) {
      log(`Error playing audio: ${error instanceof Error ? error.message : String(error)}`);
      toast({
        title: 'Audio Error',
        description: 'Failed to play audio',
        variant: 'destructive',
      });
    }
  };

  // Function to handle received audio data
  const handleReceivedAudio = (text: string, targetLanguage: string, ttsServiceType: string, audioData: string) => {
    const cacheKey = `${text}_${targetLanguage}_${ttsServiceType}`;
    
    // Process and cache audio data
    if (audioData && audioData.length > 0) {
      try {
        // Convert base64 to blob for playback
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and URL
        const blob = new Blob([bytes.buffer], { type: 'audio/mp3' }); 
        const audioURL = URL.createObjectURL(blob);
        
        // Update cache
        setAudioCache(prev => ({
          ...prev,
          lastTranslation: {
            text,
            originalText,
            audios: {
              ...prev.lastTranslation.audios,
              [ttsServiceType]: {
                data: audioData,
                url: audioURL,
                blob: blob,
                type: 'server',
                size: blob.size / 1024 // Size in KB
              }
            }
          }
        }));
      } catch (error) {
        log(`Error processing audio: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  // Function to get display name for TTS service
  const getTtsServiceName = (service: string): string => {
    const names: Record<string, string> = {
      browser: 'Browser Speech',
      openai: 'OpenAI TTS',
      silent: 'Silent Mode'
    };
    
    return names[service] || service;
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-green-500 text-transparent bg-clip-text">
          AIVoiceTranslator - Student View
        </h1>
        <div className="flex gap-4">
          <a href="/guide" className="text-blue-500 hover:text-blue-700 transition-colors">Usage Guide</a>
          <a href="/" className="text-blue-500 hover:text-blue-700 transition-colors">Home</a>
        </div>
      </div>
      
      <Card className="mb-6 p-6 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
        <div className="flex items-center mb-4 p-3 rounded-md bg-opacity-5 transition-colors">
          <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-semibold text-lg">
            {isConnected ? 'Connected to Classroom' : 'Disconnected'}
          </span>
        </div>
        
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="w-full md:flex-1">
            <label htmlFor="language-select" className="block text-sm font-medium mb-2">Select Language</label>
            <select 
              id="language-select"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="w-full p-3 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {languageOptions.map(option => (
                <option 
                  key={option.value} 
                  value={option.value}
                  disabled={!isLanguageSupported(option.value, ttsService)}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="w-full md:flex-1">
            <label className="block text-sm font-medium mb-2">TTS Service</label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="tts-service" 
                  value="browser" 
                  checked={ttsService === 'browser'} 
                  onChange={() => handleTtsServiceChange('browser')}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Browser</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="tts-service" 
                  value="openai" 
                  checked={ttsService === 'openai'} 
                  onChange={() => handleTtsServiceChange('openai')}
                  className="h-4 w-4 text-blue-600"
                />
                <span>OpenAI</span>
              </label>
              
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="tts-service" 
                  value="silent" 
                  checked={ttsService === 'silent'} 
                  onChange={() => handleTtsServiceChange('silent')}
                  className="h-4 w-4 text-blue-600"
                />
                <span>Silent</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="min-h-[150px] bg-gray-50 p-5 rounded-md border mb-6 relative">
          {translation ? (
            <p className="text-lg">{translation}</p>
          ) : (
            <p className="text-gray-400 italic absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              Teacher's speech will appear here...
            </p>
          )}
        </div>
        
        {translation && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 text-gray-500">Original Text:</h3>
            <p className="text-sm text-gray-600 italic">{originalText}</p>
          </div>
        )}
        
        <audio ref={audioRef} controls className="w-full mb-4" />
        
        <div className="mt-4">
          <details>
            <summary className="cursor-pointer font-medium mb-2 text-blue-600">Debug Log</summary>
            <div 
              ref={logContainerRef}
              className="h-48 overflow-y-auto p-4 bg-gray-900 text-gray-200 rounded-md font-mono text-sm"
            >
              {logMessages.map((msg, index) => (
                <div key={index} className="mb-1 pb-1 border-b border-gray-700">{msg}</div>
              ))}
              {logMessages.length === 0 && <div className="text-gray-400">No log entries yet</div>}
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
};

export default StudentPage;