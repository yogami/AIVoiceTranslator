import React, { useState, useEffect } from 'react';
import { TranscriptionServiceType } from '../lib/transcription/TranscriptionFactory';

// Define props for the component
interface TranscriptionServiceSelectorProps {
  initialValue?: TranscriptionServiceType;
  onChange: (serviceType: TranscriptionServiceType) => void;
  disabled?: boolean;
}

/**
 * Component for selecting the transcription service to use
 */
const TranscriptionServiceSelector: React.FC<TranscriptionServiceSelectorProps> = ({
  initialValue = 'web_speech',
  onChange,
  disabled = false
}) => {
  // Local state to manage the selected service
  const [selectedService, setSelectedService] = useState<TranscriptionServiceType>(initialValue);
  
  // Available service options
  const serviceOptions: { value: TranscriptionServiceType; label: string; description: string }[] = [
    {
      value: 'web_speech',
      label: 'Web Speech API',
      description: 'Built-in browser transcription. No API key required but limited accuracy.'
    },
    {
      value: 'openai_realtime',
      label: 'OpenAI Real-Time',
      description: 'High accuracy, real-time transcription using OpenAI API. Requires API key.'
    },
    {
      value: 'whisper',
      label: 'OpenAI Whisper',
      description: 'High accuracy but higher latency. Requires API key.'
    }
  ];
  
  // Handle change in the select element
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value as TranscriptionServiceType;
    setSelectedService(newValue);
    onChange(newValue);
  };
  
  // If initialValue changes, update local state
  useEffect(() => {
    setSelectedService(initialValue);
  }, [initialValue]);
  
  return (
    <div className="mb-4">
      <label htmlFor="transcription-service" className="block text-sm font-medium mb-1">
        Transcription Service
      </label>
      <select
        id="transcription-service"
        className="w-full p-2 border rounded-md bg-background"
        value={selectedService}
        onChange={handleServiceChange}
        disabled={disabled}
      >
        {serviceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      <p className="text-xs text-muted-foreground mt-1">
        {serviceOptions.find(option => option.value === selectedService)?.description}
      </p>
    </div>
  );
};

export default TranscriptionServiceSelector;