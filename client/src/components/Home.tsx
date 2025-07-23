import React from 'react';
import { Link } from 'wouter';

const Home: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
        AI Voice Translator
      </h1>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
        <div className="card">
          <h2>Teacher Interface</h2>
          <p>Start a teaching session and have your speech translated for students in real-time.</p>
          <Link href="/teacher" className="btn">Enter Teacher Interface</Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 