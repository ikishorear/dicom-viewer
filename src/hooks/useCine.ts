import { useCallback, useRef, useState, useEffect } from 'react';
import * as cornerstone from '@cornerstonejs/core';

interface UseCineOptions {
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
  activeViewportId: string;
  applyTransformations: (viewportId: string) => void;
  setCurrentImageIndex: (index: number) => void;
  cineSpeed: number;
}

export const useCine = ({
  getViewport,
  activeViewportId,
  applyTransformations,
  setCurrentImageIndex,
  cineSpeed,
}: UseCineOptions) => {
  const [isCinePlaying, setIsCinePlaying] = useState<{ [viewportId: string]: boolean }>({});
  const cineIntervalRef = useRef<{ [viewportId: string]: number | null }>({});

  const handleCineToggle = useCallback((viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const isPlaying = isCinePlaying[vpId] || false;
    
    // Stop cine if playing
    if (isPlaying) {
      if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
        window.clearInterval(cineIntervalRef.current[vpId]!);
        cineIntervalRef.current[vpId] = null;
      }
      setIsCinePlaying(prev => ({
        ...prev,
        [vpId]: false,
      }));
      return;
    }
    
    // Start cine
    const viewport = getViewport(vpId);
    if (!viewport) return;
    
    const imageIds = viewport.getImageIds();
    if (!imageIds || imageIds.length <= 1) return;
    
    setIsCinePlaying(prev => ({
      ...prev,
      [vpId]: true,
    }));
    
    const interval = window.setInterval(() => {
      const currentViewport = getViewport(vpId);
      if (!currentViewport) {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
        return;
      }
      
      const currentIndex = currentViewport.getCurrentImageIdIndex();
      const currentImageIds = currentViewport.getImageIds();
      if (!currentImageIds || currentImageIds.length === 0) {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
        return;
      }
      
      const nextIndex = (currentIndex + 1) % currentImageIds.length;
      currentViewport.setImageIdIndex(nextIndex).then(() => {
        if (vpId === activeViewportId) {
          setCurrentImageIndex(nextIndex);
        }
        applyTransformations(vpId);
      }).catch(() => {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
      });
    }, 1000 / cineSpeed);
    
    cineIntervalRef.current[vpId] = interval;
  }, [isCinePlaying, getViewport, activeViewportId, applyTransformations, cineSpeed, setCurrentImageIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(cineIntervalRef.current).forEach(interval => {
        if (interval !== null && interval !== undefined) {
          window.clearInterval(interval);
        }
      });
      cineIntervalRef.current = {};
    };
  }, []);

  return {
    isCinePlaying,
    handleCineToggle,
    cineIntervalRef,
  };
};
