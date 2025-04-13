import React, { useState, useEffect } from 'react';

interface AudioWaveformProps {
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isActive,
  barCount = 10,
  className = ''
}) => {
  const [bars, setBars] = useState<number[]>([]);

  // Generate random durations for animation
  useEffect(() => {
    const generateBars = () => {
      return Array.from({ length: barCount }, () => {
        return 400 + Math.floor(Math.random() * 100); // Between 400ms and 500ms
      });
    };
    
    setBars(generateBars());
  }, [barCount]);

  return (
    <div 
      className={`flex items-center h-10 ${isActive ? 'active-wave' : 'paused-wave'} ${className}`}
      aria-hidden="true"
    >
      {bars.map((duration, i) => (
        <div 
          key={i} 
          className="bar w-[3px] mx-[1px] bg-primary rounded-[1px]"
          style={{ 
            animationDuration: `${duration}ms`,
            height: isActive ? undefined : '5px' 
          }}
        />
      ))}
      
      <style>{`
        .active-wave .bar {
          animation-name: sound;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-direction: alternate;
          animation-play-state: running;
        }
        
        .paused-wave .bar {
          animation-play-state: paused;
          height: 5px;
        }
        
        @keyframes sound {
          0% {
            height: 5px;
          }
          100% {
            height: 30px;
          }
        }
      `}</style>
    </div>
  );
};

export default AudioWaveform;
