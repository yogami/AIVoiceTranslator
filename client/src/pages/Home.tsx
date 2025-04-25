import React from 'react';
import { Link } from 'wouter';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Benedictaitor - Speech Translation System</h1>
        
        <div className="text-center mb-8">
          <p className="mb-4">
            The React-based implementation of speech recognition has persistent issues across browsers and platforms. 
            We've created simple HTML-based implementations that work more reliably with direct WebSocket connections.
          </p>
          <p className="mb-4">
            <strong>For Best Results:</strong> Use the Teacher Interface on your computer and the Student Interface on mobile devices.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <a href="/simple-speech-test.html" className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition">
              Teacher Interface
            </a>
            <a href="/simple-student.html" className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
              Student Interface
            </a>
            <a href="/direct-speech-test.html" className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition">
              Advanced Testing
            </a>
          </div>
        </div>
        
        <hr className="my-8" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Original React Version</h2>
            <p className="text-gray-600 mb-4">
              The original React implementation with all features but less reliable speech recognition.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/teacher">
                <a className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-center">
                  Teacher View
                </a>
              </Link>
              <Link href="/student">
                <a className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-center">
                  Student View
                </a>
              </Link>
              <Link href="/test">
                <a className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-center">
                  WebSocket Test
                </a>
              </Link>
              <Link href="/speechtest">
                <a className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-center">
                  Speech Test
                </a>
              </Link>
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Documentation & Usage Guide</h2>
            <p className="text-gray-600 mb-4">
              Learn how the system works and how to use it effectively.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Link href="/guide">
                <a className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-center">
                  Usage Guide
                </a>
              </Link>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-gray-600">
          <p>Benedictaitor - Built for simplified classroom translation</p>
        </div>
      </div>
    </div>
  );
};

export default Home;