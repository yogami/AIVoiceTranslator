import React from 'react';
import { Link } from 'wouter';

const UsageGuidePage: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Usage Guide</h1>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">For Teachers</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Step 1: Start a Session</h3>
              <p>Click the "Start Teaching" button to begin a new translation session.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 2: Allow Microphone Access</h3>
              <p>When prompted, allow the browser to access your microphone.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 3: Speak Naturally</h3>
              <p>Speak naturally. Your voice will be captured, transcribed, and translated in real-time.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 4: Share Session Link</h3>
              <p>Share the provided session link with your students so they can join and listen in their preferred language.</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">For Students</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Step 1: Join a Session</h3>
              <p>Use the link provided by your teacher to join the translation session.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 2: Select Your Language</h3>
              <p>Choose your preferred language from the dropdown menu.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 3: Listen to Translations</h3>
              <p>As the teacher speaks, you'll receive real-time translations both as text and audio in your selected language.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Step 4: Adjust Audio Settings</h3>
              <p>Use the controls to adjust the volume or pause audio playback as needed.</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Troubleshooting</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Audio Not Working</h3>
              <p>Make sure your device's audio is not muted and that you've allowed the necessary browser permissions.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Translation Delays</h3>
              <p>If translations seem delayed, check your internet connection. The system requires a stable connection for optimal performance.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium">Browser Compatibility</h3>
              <p>For the best experience, use the latest version of Chrome, Edge, or Firefox.</p>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <Link to="/">
            <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
              Back to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UsageGuidePage;