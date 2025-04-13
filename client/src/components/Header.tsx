import React from 'react';
import { Button } from '@/components/ui/button';
import { Languages, HelpCircle, Wifi, WifiOff } from 'lucide-react';
import { WebSocketStatus } from '@/lib/websocket';

interface HeaderProps {
  connectionStatus: WebSocketStatus;
  onHelpClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  connectionStatus, 
  onHelpClick 
}) => {
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Languages className="h-6 w-6" />
          <h1 className="text-xl font-bold">Benedictaitor</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`
            flex items-center px-3 py-1 rounded-full text-sm
            ${connectionStatus === 'connected' 
              ? 'bg-primary-dark' 
              : 'bg-red-700'}
          `}>
            {connectionStatus === 'connected' 
              ? <Wifi className="h-4 w-4 mr-1" /> 
              : <WifiOff className="h-4 w-4 mr-1" />}
            <span>
              {connectionStatus === 'connected' 
                ? 'Connected' 
                : connectionStatus === 'connecting' 
                  ? 'Connecting...' 
                  : 'Disconnected'}
            </span>
          </div>
          <Button 
            variant="secondary"
            size="sm"
            className="bg-accent hover:bg-accent/90 text-white"
            onClick={onHelpClick}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Help
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
