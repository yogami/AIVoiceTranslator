import React, { useState } from 'react';
import { Link } from "wouter";
import Header from '@/components/Header';
import TeacherInterface from '@/components/TeacherInterface';
import StudentInterface from '@/components/StudentInterface';
import HelpModal from '@/components/HelpModal';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Info, ExternalLink, Headphones, Mic, QrCode, HelpCircle } from 'lucide-react';

export const Home: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'teacher' | 'student'>('teacher');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  // Initialize WebSocket
  const { status: connectionStatus } = useWebSocket({
    autoConnect: true
  });
  
  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };
  
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <Header 
        connectionStatus={connectionStatus}
        onHelpClick={toggleHelpModal}
      />
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="flex justify-end space-x-2 mb-4">
          <Link href="/guide">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              How to Use
            </Button>
          </Link>
          <Link href="/qrcode">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Codes for Mobile Access
            </Button>
          </Link>
        </div>
        
        {/* Developer Testing Tools */}
        <div className="mb-6 p-4 border rounded-md bg-gray-50">
          <h3 className="text-sm font-semibold mb-2 text-gray-500">Developer Testing Tools</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/simplespeech">
              <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">Simple Speech Test (New!)</Button>
            </Link>
            <Link href="/speechtest">
              <Button variant="outline" size="sm">Speech Test</Button>
            </Link>
            <Link href="/test">
              <Button variant="outline" size="sm">WebSocket Test</Button>
            </Link>
            <Link href="/simple-test.html">
              <Button variant="outline" size="sm">Simple Teacher Test</Button>
            </Link>
            <Link href="/simple-test-student.html">
              <Button variant="outline" size="sm">Simple Student Test</Button>
            </Link>
            <Link href="/websocket-diagnostics.html">
              <Button variant="outline" size="sm">WebSocket Diagnostics</Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 mb-6">
          <Card className="flex-1">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-3">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Teacher Mode</h2>
                <p className="text-gray-600 mt-2 mb-4">
                  Broadcast your voice in multiple languages to your students
                </p>
                <Link href="/teacher">
                  <Button className="w-full flex items-center justify-center gap-2">
                    Open Teacher Interface
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-3">
                  <Headphones className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Student Mode</h2>
                <p className="text-gray-600 mt-2 mb-4">
                  Receive translations in your preferred language
                </p>
                <Link href="/student">
                  <Button className="w-full flex items-center justify-center gap-2">
                    Open Student Interface
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Classic Mode with Tabs */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <h2 className="font-bold text-lg mb-4">All-In-One Mode</h2>
            <Tabs 
              value={activeMode} 
              onValueChange={(value) => setActiveMode(value as 'teacher' | 'student')}
            >
              <div className="bg-white rounded-lg shadow-sm mb-4 border">
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none">
                  <TabsTrigger 
                    value="teacher"
                    className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                  >
                    Teacher Mode
                  </TabsTrigger>
                  <TabsTrigger 
                    value="student"
                    className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none"
                  >
                    Student Mode
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="teacher" className="mt-0">
                <TeacherInterface />
              </TabsContent>
              
              <TabsContent value="student" className="mt-0">
                <StudentInterface />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Information Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-500 mb-1">About Benedictaitor</h3>
                <p className="text-sm text-gray-700 mb-2">
                  This platform provides real-time speech-to-speech translation for classrooms. 
                  Teachers speak in their native language, and students receive audio in their 
                  preferred language with minimal latency.
                </p>
                <div className="text-sm">
                  <span className="font-medium">Current Version:</span> <span className="text-gray-600">1.0.0 (Beta)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      
      {/* Help Modal */}
      <HelpModal 
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};

export default Home;
