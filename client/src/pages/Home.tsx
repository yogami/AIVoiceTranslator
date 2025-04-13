import React, { useState } from 'react';
import Header from '@/components/Header';
import TeacherInterface from '@/components/TeacherInterface';
import StudentInterface from '@/components/StudentInterface';
import HelpModal from '@/components/HelpModal';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Info } from 'lucide-react';

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
        {/* Mode Tabs */}
        <Tabs 
          value={activeMode} 
          onValueChange={(value) => setActiveMode(value as 'teacher' | 'student')}
          className="mb-6"
        >
          <div className="bg-white rounded-t-lg shadow-sm mb-0 border-b border-gray-200">
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
