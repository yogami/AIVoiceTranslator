import React, { useEffect, useState } from 'react';
import { useLocation, Link } from "wouter";
import Header from '@/components/Header';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Smartphone, Laptop } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

const QRCodePage: React.FC = () => {
  const [, navigate] = useLocation();
  const [currentUrl, setCurrentUrl] = useState<string>('');
  
  // Initialize WebSocket
  const { status: connectionStatus } = useWebSocket({
    autoConnect: true
  });
  
  useEffect(() => {
    // Get the base URL (without /qrcode)
    const baseUrl = window.location.origin;
    setCurrentUrl(baseUrl);
  }, []);
  
  const studentUrl = `${currentUrl}/student`;
  const teacherUrl = `${currentUrl}/teacher`;
  
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <Header 
        connectionStatus={connectionStatus}
        onHelpClick={() => {}}
      />
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-4 flex items-center">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-primary ml-4">QR Codes for Mobile Access</h1>
        </div>
        
        <p className="text-gray-600 mb-6">
          Scan these QR codes with your phone to access the Benedictaitor interfaces. 
          This makes it easy to test teacher and student modes on different devices simultaneously.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center mb-4">
              <Smartphone className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-xl font-semibold">Student Interface</h2>
            </div>
            <QRCodeDisplay 
              url={studentUrl} 
              title="Student Mode" 
              description="Scan with your phone to join as a student and receive translations."
            />
          </div>
          
          <div>
            <div className="flex items-center mb-4">
              <Laptop className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-xl font-semibold">Teacher Interface</h2>
            </div>
            <QRCodeDisplay 
              url={teacherUrl} 
              title="Teacher Mode" 
              description="Scan with your phone to join as a teacher and broadcast translations."
            />
          </div>
        </div>
        
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-medium text-blue-500 mb-1">How to Test</h3>
            <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-2">
              <li>Use your computer to open the Teacher Interface</li>
              <li>Scan the Student Interface QR code with your phone</li>
              <li>Start recording on the Teacher Interface</li>
              <li>Speak in English</li>
              <li>Listen to the translation on your phone</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default QRCodePage;