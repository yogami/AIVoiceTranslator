import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronRight, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Benedictaitor Help</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-2 text-primary">Teacher Mode</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Microphone Toggle:</strong> Click to start/stop recording your voice for translation.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Microphone Selection:</strong> Choose which microphone device to use.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Input Language:</strong> Select the language you'll be speaking in.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Translation Languages:</strong> View active translations and their performance.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Preview Audio:</strong> Listen to how your voice sounds in each translated language.</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-2 text-primary">Student Mode</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Language Selection:</strong> Choose your preferred language for translation.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Audio Controls:</strong> Pause, resume, and adjust volume of the translated audio.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Transcript:</strong> View and download a text transcript of the translated content.</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-2 text-primary">Troubleshooting</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Connection Issues:</strong> If WebSocket shows disconnected, try refreshing the page.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Audio Not Working:</strong> Check browser permissions and ensure your microphone is enabled.</span>
              </li>
              <li className="flex items-start">
                <ChevronRight className="h-4 w-4 text-gray-500 mt-1 mr-2 flex-shrink-0" />
                <span><strong>High Latency:</strong> If translations are delayed, check your network connection speed.</span>
              </li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
