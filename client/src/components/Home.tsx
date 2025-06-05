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
        
        <div className="card">
          <h2>Student Interface</h2>
          <p>Join a teacher's session and receive translations in your preferred language.</p>
          <Link href="/student" className="btn">Enter Student Interface</Link>
        </div>
      </div>
      
      {/* QR Code Section */}
      <div style={{ marginTop: '40px', textAlign: 'center', padding: '20px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2 style={{ color: '#2563eb', marginBottom: '15px' }}>Mobile Access</h2>
        <p style={{ marginBottom: '20px' }}>Scan this QR code with your phone to access the student interface on your mobile device:</p>
        <div>
          <img src="/student-interface-qr.png" alt="QR Code for Student Interface" style={{ maxWidth: '200px', height: 'auto', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px' }} />
        </div>
        <p style={{ fontSize: '15px', color: '#666' }}>Scan to use the student interface on your mobile device</p>
        <a href="/public/simple-student.html" className="btn" style={{ marginTop: '10px', backgroundColor: '#2563eb' }}>Or Open Student Interface Here</a>
      </div>
      
      {/* Diagnostics Link */}
      <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <Link href="/diagnostics" className="metrics-link">📊 View Application Diagnostics</Link>
      </div>
    </div>
  );
};

export default Home; 