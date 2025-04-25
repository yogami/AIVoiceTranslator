import React from 'react';
import { Link } from 'wouter';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Benedictaitor - Speech Translation System</h1>
        
        <div className="text-center mb-8">
          <p className="mb-4">
            A lightweight multilingual communication system for classrooms, focused on simplifying 
            speech recognition and translation with minimal dependencies.
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
          </div>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Documentation & Usage Guide</h2>
          <p className="text-gray-600 mb-4">
            Learn how the system works and how to use it effectively.
          </p>
          <div className="flex justify-center mt-4">
            <Link href="/guide">
              <a className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium text-center">
                Usage Guide
              </a>
            </Link>
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