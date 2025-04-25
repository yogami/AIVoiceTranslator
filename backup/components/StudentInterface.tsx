import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import AudioWaveform from '@/components/AudioWaveform';
import LanguageSelector from '@/components/LanguageSelector';
import AudioControls from '@/components/AudioControls';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLatency, formatDuration } from '@/lib/openai';
import { Headphones, Star } from 'lucide-react';

interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface Transcript {
  text: string;
  timestamp: string;
}

export const StudentInterface: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  
  // Fetch available languages
  const { data: allLanguages = [] } = useQuery<Language[]>({
    queryKey: ['/api/languages'],
  });
  
  // Filter for target languages (non-English)
  const languages = allLanguages.filter(lang => 
    !lang.code.startsWith('en-') && lang.isActive
  );
  
  // Update state if languages change and selected is not available
  useEffect(() => {
    if (languages.length > 0 && !languages.some(l => l.code === selectedLanguage)) {
      setSelectedLanguage(languages[0].code);
    }
  }, [languages, selectedLanguage]);
  
  // Translation setup
  const translation = useTranslation({
    role: 'student',
    languageCode: selectedLanguage,
    autoConnect: true
  });
  
  // Update language when changed in UI
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
  };
  
  // Format timestamp for transcript display
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-4">
          <h2 className="font-bold text-lg mb-4 flex items-center">
            <Headphones className="h-5 w-5 mr-2 text-primary" />
            Audio Reception
          </h2>
          
          <div className="mb-6">
            <LanguageSelector
              languages={languages}
              selectedLanguage={selectedLanguage}
              onChange={handleLanguageChange}
              label="Select Your Language"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Live Translation</h3>
                <div className="px-2 py-0.5 bg-success text-white text-xs rounded-full flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-white mr-1"></span>
                  Live
                </div>
              </div>
              
              <div className="mb-4">
                <AudioWaveform isActive={translation.isPlaying && !translation.isPaused} />
              </div>
              
              <AudioControls
                isPlaying={translation.isPlaying}
                isPaused={translation.isPaused}
                volume={translation.volume}
                onPlay={translation.resumeAudio}
                onPause={translation.pauseAudio}
                onVolumeChange={translation.changeVolume}
              />
            </div>
            
            <div className="flex-1 border rounded-lg p-4">
              <h3 className="font-medium mb-4">Translation Transcript</h3>
              <div className="bg-gray-50 rounded p-3 border mb-4 h-[180px] overflow-y-auto">
                {translation.transcripts.length > 0 ? (
                  translation.transcripts.map((transcript, index) => (
                    <div key={index} className="mb-2 border-b pb-2 last:border-b-0">
                      <div className="text-xs text-gray-500 mb-1">
                        {formatTimestamp(transcript.timestamp)}
                      </div>
                      <p className="text-sm">{transcript.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 flex items-center justify-center h-full">
                    No translations yet. Waiting for teacher to speak...
                  </div>
                )}
              </div>
              <AudioControls
                isPlaying={false}
                isPaused={true}
                volume={0}
                onPlay={() => {}}
                onPause={() => {}}
                onVolumeChange={() => {}}
                onDownload={translation.downloadTranscript}
                showDownload={true}
                disabled={translation.transcripts.length === 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Connection Status</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">WebSocket Connection</span>
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Audio Stream</span>
                <span className={`text-xs font-medium flex items-center ${
                  translation.status === 'connected' ? 'text-success' : 'text-warning'
                }`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                    translation.status === 'connected' ? 'bg-success' : 'bg-warning'
                  }`}></span>
                  {translation.status === 'connected' ? 'Active' : 'Waiting'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Latency</span>
                <span className="text-xs font-medium">
                  {formatLatency(translation.metrics.averageLatency)}
                </span>
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Preferred Language</span>
                <span className="text-xs font-medium">
                  {languages.find(l => l.code === selectedLanguage)?.name || selectedLanguage}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Translation Quality</span>
                <div className="flex">
                  {[1, 2, 3, 4].map(i => (
                    <Star key={i} className="h-3 w-3 text-warning fill-warning" />
                  ))}
                  <Star className="h-3 w-3 text-gray-300" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Session Duration</span>
                <span className="text-xs font-medium">
                  {formatDuration(translation.getSessionDuration())}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentInterface;
