import React from 'react';
import BrowserSpeechRecognition from '@/components/BrowserSpeechRecognition';

const TestPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Speech Recognition Test</h1>
      <p className="mb-6 text-gray-600">
        This is a simple test page to verify that your browser's speech recognition functionality works properly.
        This implementation is completely independent from the rest of the application and uses only
        the most basic Web Speech API features.
      </p>
      
      <div className="mb-8">
        <BrowserSpeechRecognition />
      </div>
      
      <div className="mt-8 text-sm text-gray-500">
        <h3 className="font-medium mb-2">Troubleshooting Tips</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Make sure your microphone is working in other applications</li>
          <li>Check that you've allowed microphone access in your browser permissions</li>
          <li>Try using Chrome or Edge, which have the best speech recognition support</li>
          <li>If you're on macOS, verify that your system privacy settings allow microphone access</li>
          <li>Speak clearly and at a normal pace when testing</li>
        </ul>
      </div>
    </div>
  );
};

export default TestPage;