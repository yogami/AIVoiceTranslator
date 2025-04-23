import React from 'react';

const SimpleSpeechTest: React.FC = () => {
  // We'll just redirect to our standalone HTML implementation
  React.useEffect(() => {
    window.location.href = '/simple-speech-test.html';
  }, []);

  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Redirecting to Simple Speech Test...</h1>
      <p>If you are not redirected automatically, <a href="/simple-speech-test.html" className="text-blue-500 hover:underline">click here</a>.</p>
    </div>
  );
};

export default SimpleSpeechTest;