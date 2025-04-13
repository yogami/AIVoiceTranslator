import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AudioWaveform from '@/components/AudioWaveform';
import LanguageSelector from '@/components/LanguageSelector';
import { apiRequest } from '@/lib/queryClient';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLatency, formatDuration } from '@/lib/openai';
import { Mic, Languages, Play, Timer, Plus, CheckCircle } from 'lucide-react';

interface Languages {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export const TeacherInterface: React.FC = () => {
  const [selectedInputLanguage, setSelectedInputLanguage] = useState('en-US');
  
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
    startRecording,
    stopRecording,
    toggleRecording,
    selectDevice,
    loadDevices,
    requestPermission
  } = useAudioCapture({
    onDataAvailable: (base64Data) => {
      translation.sendAudioData(base64Data);
    }
  });
  
  // Translation setup
  const translation = useTranslation({
    role: 'teacher',
    languageCode: selectedInputLanguage,
    autoConnect: true
  });
  
  // Request microphone permission on mount
  useEffect(() => {
    requestPermission().then(() => {
      loadDevices();
    });
  }, [requestPermission, loadDevices]);
  
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
                <Switch
                  checked={isRecording}
                  onCheckedChange={toggleRecording}
                />
              </div>
              <Select
                value={selectedDeviceId}
                onValueChange={selectDevice}
                disabled={isRecording || devices.length === 0}
              >
                <SelectTrigger className="w-full p-2 bg-gray-50">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-6">
              <LanguageSelector
                languages={inputLanguages}
                selectedLanguage={selectedInputLanguage}
                onChange={setSelectedInputLanguage}
                label="Input Languages"
                disabled={isRecording}
              />
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Input Monitor</Label>
              </div>
              <div className="border rounded p-3 bg-gray-50 relative">
                <AudioWaveform isActive={isRecording} />
                <div className="text-xs text-gray-500 mt-2">
                  {isRecording ? 'Recording...' : 'Not recording'}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded p-3 border">
              <h3 className="text-sm font-medium mb-2">Current Speech</h3>
              <p className="text-sm text-gray-700 min-h-[60px]">
                {translation.currentSpeech || 
                 'The transcript of your speech will appear here in real-time...'}
              </p>
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
