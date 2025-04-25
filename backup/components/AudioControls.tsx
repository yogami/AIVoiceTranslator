import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Pause, Play, Download } from 'lucide-react';

interface AudioControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onVolumeChange: (value: number) => void;
  onDownload?: () => void;
  disabled?: boolean;
  showDownload?: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  isPaused,
  volume,
  onPlay,
  onPause,
  onVolumeChange,
  onDownload,
  disabled = false,
  showDownload = false
}) => {
  const handleVolumeChange = (values: number[]) => {
    onVolumeChange(values[0]);
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        {isPaused || !isPlaying ? (
          <Button
            variant="default"
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={onPlay}
            disabled={disabled}
          >
            <Play className="h-4 w-4 mr-2" />
            Resume
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onPause}
            disabled={disabled}
          >
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </Button>
        )}
        
        {showDownload && onDownload && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onDownload}
            disabled={disabled}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-700">Volume</Label>
          <span className="text-xs text-gray-500">{volume}%</span>
        </div>
        <Slider
          value={[volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={handleVolumeChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default AudioControls;
