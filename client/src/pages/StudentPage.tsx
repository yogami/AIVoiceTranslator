import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useToast } from '../hooks/use-toast';
import { useLanguageSupport } from '../hooks/use-language-support';
import { useStudentWebSocket, TranslationMessage } from '../lib/websocket';

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';

// Define audio data cache type
interface AudioCacheItem {
  data: string;
  url: string;
  blob: Blob;
  type: string;
}

const StudentPage: React.FC = () => {
  // Get toast functionality
  const { toast } = useToast();
  
  // Get language support
  const {
    selectedLanguage,
    setSelectedLanguage,
    availableLanguages,
    currentLanguage,
    showAllLanguages,
    toggleLanguageView
  } = useLanguageSupport();
  
  // WebSocket integration
  const {
    connectionState,
    sessionId,
    translations,
    teacherActive,
    teacherLanguage
  } = useStudentWebSocket(selectedLanguage);
  
  // Local state
  const [lastTranslation, setLastTranslation] = useState<TranslationMessage | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioSource, setAudioSource] = useState<'browser' | 'openai'>('openai');
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCache = useRef<Record<string, AudioCacheItem>>({});
  
  // Update the last translation when new translations come in
  useEffect(() => {
    if (translations.length > 0) {
      const latest = translations[translations.length - 1];
      setLastTranslation(latest);
    }
  }, [translations]);
  
  // Play audio when a new translation arrives
  useEffect(() => {
    if (lastTranslation?.audioData && audioRef.current) {
      try {
        // Process the audio data
        const audioData = lastTranslation.audioData;
        
        // Check if we already have this audio cached
        const cacheKey = `${lastTranslation.text}-${audioSource}`;
        if (!audioCache.current[cacheKey]) {
          // Create blob and URL for the audio
          const type = 'audio/mp3';
          const byteCharacters = atob(audioData);
          const byteNumbers = new Array(byteCharacters.length);
          
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type });
          const url = URL.createObjectURL(blob);
          
          // Store in cache
          audioCache.current[cacheKey] = {
            data: audioData,
            blob,
            url,
            type
          };
        }
        
        // Set the audio source
        audioRef.current.src = audioCache.current[cacheKey].url;
        audioRef.current.volume = volume;
        
        // Play the audio
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          toast({ 
            title: 'Audio Playback Error', 
            description: 'Unable to play audio. Please check your device settings.',
            variant: 'destructive'
          });
        });
        
        setIsPlaying(true);
      } catch (error) {
        console.error('Error processing audio data:', error);
        toast({ 
          title: 'Audio Processing Error', 
          description: 'Error processing audio data',
          variant: 'destructive'
        });
      }
    }
  }, [lastTranslation, volume, audioSource, toast]);
  
  // Handle audio source change
  const handleAudioSourceChange = (source: 'browser' | 'openai') => {
    setAudioSource(source);
    toast({ 
      title: 'Audio Source Changed', 
      description: `Now using ${source === 'browser' ? 'Browser' : 'OpenAI'} for text-to-speech`
    });
  };
  
  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };
  
  // Create status message based on connection state
  const getStatusMessage = () => {
    if (connectionState === 'connecting') {
      return 'Connecting to translation service...';
    } else if (connectionState === 'connected' && !teacherActive) {
      return 'Connected. Waiting for teacher to start...';
    } else if (connectionState === 'connected' && teacherActive) {
      return 'Teacher is active and speaking...';
    } else if (connectionState === 'error') {
      return 'Connection error. Please refresh the page.';
    } else {
      return 'Disconnected. Please refresh the page.';
    }
  };

  // Get status color based on connection state
  const getStatusColor = () => {
    if (connectionState === 'connected' && teacherActive) {
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
            <CardTitle>Student Interface</CardTitle>
            <CardDescription>
              Listen to real-time translations in your preferred language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select Your Language</label>
              <div className="relative">
                <select 
                  className="w-full p-2 border rounded-md pr-8"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag ? `${lang.flag} ` : ''}{lang.name} {lang.localName ? `(${lang.localName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <button 
                  onClick={toggleLanguageView}
                  className="text-sm text-blue-500 hover:underline"
                >
                  {showAllLanguages ? 'Show Common Languages' : 'Show All Languages'}
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Audio Source</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input 
                    type="radio" 
                    name="audioSource" 
                    checked={audioSource === 'openai'} 
                    onChange={() => handleAudioSourceChange('openai')}
                    className="mr-1"
                  />
                  <span>OpenAI TTS</span>
                </label>
                <label className="inline-flex items-center">
                  <input 
                    type="radio" 
                    name="audioSource" 
                    checked={audioSource === 'browser'} 
                    onChange={() => handleAudioSourceChange('browser')}
                    className="mr-1"
                  />
                  <span>Browser TTS</span>
                </label>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Volume: {Math.round(volume * 100)}%</label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume}
                onChange={handleVolumeChange}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Translation</CardTitle>
            <CardDescription>
              {teacherLanguage ? `Original language: ${teacherLanguage}` : 'Waiting for translation...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastTranslation ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-100 rounded">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Original Text:</h3>
                  <p className="text-gray-700">{lastTranslation.originalText}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">
                    Translation ({currentLanguage.name}):
                  </h3>
                  <p className="text-blue-900 font-medium">{lastTranslation.text}</p>
                </div>
                <div className="text-center">
                  <Button
                    onClick={() => {
                      if (audioRef.current) {
                        if (audioRef.current.paused) {
                          audioRef.current.play();
                          setIsPlaying(true);
                        } else {
                          audioRef.current.pause();
                          setIsPlaying(false);
                        }
                      }
                    }}
                  >
                    {isPlaying ? 'Pause Audio' : 'Play Audio'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <p>No translations received yet. Waiting for the teacher to speak...</p>
              </div>
            )}
            <audio 
              ref={audioRef} 
              onEnded={handleAudioEnded}
              className="hidden"
            />
          </CardContent>
          <CardFooter className="border-t pt-4">
            <div className="w-full text-center">
              <p className="text-xs text-gray-500 mb-2">
                Session ID: {sessionId || 'Not connected'}
              </p>
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

export default StudentPage;