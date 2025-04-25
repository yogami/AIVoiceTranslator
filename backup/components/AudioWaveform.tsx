import React, { useState, useEffect, useRef } from 'react';

interface AudioWaveformProps {
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isActive,
  barCount = 20,
  className = ''
}) => {
  const [bars, setBars] = useState<number[]>([]);
  const animationIntervalRef = useRef<number | null>(null);

  // Generate random heights for animation
  useEffect(() => {
    // Initialize bars with random heights
    const generateBars = () => {
      return Array.from({ length: barCount }, () => {
        return 5 + Math.floor(Math.random() * 10); // Base heights between 5-15px
      });
    };
    
    // Create initial bars
    if (bars.length === 0) {
      setBars(generateBars());
    }
    
    // Set up animation interval when active
    if (isActive) {
      // Clear any existing interval
      if (animationIntervalRef.current !== null) {
        window.clearInterval(animationIntervalRef.current);
      }
      
      // Create animation interval - update random bars several times per second
      animationIntervalRef.current = window.setInterval(() => {
        setBars(prevBars => {
          const newBars = [...prevBars];
          // Update 30% of the bars each interval with new random heights
          const barsToUpdate = Math.max(1, Math.floor(barCount * 0.3));
          
          for (let i = 0; i < barsToUpdate; i++) {
            const randomIndex = Math.floor(Math.random() * barCount);
            newBars[randomIndex] = isActive 
              ? 5 + Math.floor(Math.random() * 25) // Active heights between 5-30px
              : 5; // Inactive fixed height
          }
          
          return newBars;
        });
      }, 100); // Update every 100ms for smooth animation
    } else {
      // Clear animation interval when inactive
      if (animationIntervalRef.current !== null) {
        window.clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
        
        // Reset all bars to base height when inactive
        setBars(prevBars => prevBars.map(() => 5));
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (animationIntervalRef.current !== null) {
        window.clearInterval(animationIntervalRef.current);
      }
    };
  }, [isActive, barCount, bars.length]);

  return (
    <div 
      className={`flex items-center justify-center gap-[2px] h-12 ${className}`}
      aria-hidden="true"
    >
      {bars.map((height, i) => (
        <div 
          key={i} 
          className={`bar w-[3px] rounded-[1px] transition-height duration-100 ${
            isActive ? 'bg-primary' : 'bg-gray-300'
          }`}
          style={{ 
            height: `${height}px`,
            transitionProperty: 'height'
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;
