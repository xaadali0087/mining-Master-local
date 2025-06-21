import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the context interface
interface MiningContextType {
  isMining: boolean;
  timeLeft: number;
  startMining: (duration: number) => void;
  stopMining: () => void;
  formatTime: (seconds: number) => string;
}

// Create the context with default values
const MiningContext = createContext<MiningContextType>({
  isMining: false,
  timeLeft: 0,
  startMining: () => {},
  stopMining: () => {},
  formatTime: () => '',
});

// Custom hook to use the mining context
export const useMining = () => useContext(MiningContext);

interface MiningProviderProps {
  children: ReactNode;
}

export const MiningProvider: React.FC<MiningProviderProps> = ({ children }) => {
  const [isMining, setIsMining] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Setup timer when mining is active
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMining && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isMining) {
      setIsMining(false);
    }

    return () => clearInterval(timer);
  }, [isMining, timeLeft]);

  // Format time as MM:SS or HH:MM:SS based on duration
  const formatTime = (seconds: number) => {
    if (seconds < 0) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start a mining expedition
  const startMining = (duration: number) => {
    setTimeLeft(duration);
    setIsMining(true);
  };

  // Stop a mining expedition (early return or manually)
  const stopMining = () => {
    setIsMining(false);
    setTimeLeft(0);
  };

  const value = {
    isMining,
    timeLeft,
    startMining,
    stopMining,
    formatTime,
  };

  return <MiningContext.Provider value={value}>{children}</MiningContext.Provider>;
};
