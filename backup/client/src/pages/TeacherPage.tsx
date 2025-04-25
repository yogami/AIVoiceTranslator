import React from 'react';
import { Link } from "wouter";
import TeacherInterface from '@/components/TeacherInterface';
import Header from '@/components/Header';
import HelpModal from '@/components/HelpModal';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Home, ArrowLeft } from 'lucide-react';

const TeacherPage: React.FC = () => {
  const [isHelpModalOpen, setIsHelpModalOpen] = React.useState(false);
  
  // Use a basic status indicator without initializing another WebSocket connection
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // This will get updated by the TeacherInterface component
  React.useEffect(() => {
    const wsClient = window.wsClient;
    const updateStatus = (status: any) => {
      setConnectionStatus(status);
    };
    
    if (wsClient) {
      wsClient.addEventListener('status', updateStatus);
      // Initial status
      setConnectionStatus(wsClient.getStatus());
    }
    
    return () => {
      if (wsClient) {
        wsClient.removeEventListener('status', updateStatus);
      }
    };
  }, []);
  
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <Header 
        connectionStatus={connectionStatus}
        onHelpClick={() => setIsHelpModalOpen(true)}
      />
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-primary">Teacher Mode</h1>
        </div>
        
        <TeacherInterface />
      </main>
      
      {/* Help Modal */}
      <HelpModal 
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};

export default TeacherPage;