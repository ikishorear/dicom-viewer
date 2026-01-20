import * as cornerstone from '@cornerstonejs/core';

interface PinchToZoomConfig {
  viewportId: string;
  viewportElement: HTMLElement;
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
  fitParallelScaleRef: React.MutableRefObject<{ [key: string]: number }>;
}

/**
 * Setup pinch-to-zoom handler for mobile devices
 * Provides zoom-only functionality with focal point preservation
 */
export const setupPinchToZoom = ({
  viewportId,
  viewportElement,
  getViewport,
  fitParallelScaleRef,
}: PinchToZoomConfig): (() => void) => {
  const MAX_SCALE = 5; // Maximum zoom (5x)
  
  // Helper functions
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  const getCanvasCoordinates = (screenX: number, screenY: number): { x: number; y: number } => {
    const canvas = viewportElement.querySelector('canvas');
    if (!canvas) {
      const rect = viewportElement.getBoundingClientRect();
      return { x: screenX - rect.left, y: screenY - rect.top };
    }
    const canvasRect = canvas.getBoundingClientRect();
    return {
      x: screenX - canvasRect.left,
      y: screenY - canvasRect.top,
    };
  };

  // Gesture state
  let initialDistance = 0;
  let initialParallelScale = 1;
  let touches: Touch[] = [];
  let isPinching = false;
  let lastTapTime = 0;
  let tapCount = 0;
  let pinchCenterCanvas: { x: number; y: number } | null = null;
  let worldPointAtPinchCenter: [number, number, number] | null = null;
  let initialCamera: { parallelScale: number; focalPoint: [number, number, number]; position: [number, number, number] } | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    if (e.touches.length === 2) {
      touches = Array.from(e.touches);
      initialDistance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      pinchCenterCanvas = getCanvasCoordinates(center.x, center.y);
      
      try {
        const camera = viewport.getCamera();
        initialParallelScale = camera.parallelScale || 1;
        initialCamera = {
          parallelScale: camera.parallelScale ?? 1,
          focalPoint: camera.focalPoint ? [...camera.focalPoint] as [number, number, number] : [0, 0, 0],
          position: camera.position ? [...camera.position] as [number, number, number] : [0, 0, 0],
        };
        
        worldPointAtPinchCenter = viewport.canvasToWorld([pinchCenterCanvas.x, pinchCenterCanvas.y]) as [number, number, number];
        
        if (!fitParallelScaleRef.current[viewportId]) {
          fitParallelScaleRef.current[viewportId] = initialParallelScale;
        }
      } catch (err) {
        console.warn('Error getting initial camera:', err);
        return;
      }
      
      isPinching = true;
      tapCount = 0;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      // Double-tap to reset zoom
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime;
      
      if (timeDiff < 300 && tapCount === 1) {
        try {
          const camera = viewport.getCamera();
          const currentZoom = camera.parallelScale || 1;
          const fitScale = fitParallelScaleRef.current[viewportId] || currentZoom;
          
          if (currentZoom < fitScale) {
            viewport.resetCamera();
            const resetCamera = viewport.getCamera();
            fitParallelScaleRef.current[viewportId] = resetCamera.parallelScale ?? 1;
            viewport.render();
          }
          tapCount = 0;
          e.preventDefault();
          return;
        } catch (err) {
          console.warn('Error in double-tap reset:', err);
        }
      } else {
        tapCount = 1;
      }
      lastTapTime = currentTime;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    if (e.touches.length === 2 && isPinching && pinchCenterCanvas && worldPointAtPinchCenter && initialCamera) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance;
      
      let fitScale = fitParallelScaleRef.current[viewportId];
      if (!fitScale) {
        fitScale = initialParallelScale;
        fitParallelScaleRef.current[viewportId] = fitScale;
      }
      
      const desiredParallelScale = initialParallelScale / scale;
      const minParallelScale = fitScale / MAX_SCALE;
      const maxParallelScale = fitScale;
      const newParallelScale = Math.max(minParallelScale, Math.min(maxParallelScale, desiredParallelScale));

      try {
        if (newParallelScale >= fitScale && desiredParallelScale > fitScale) {
          return;
        }
        
        const scaleFactor = initialParallelScale / newParallelScale;
        
        const offsetFromInitialFocal = [
          worldPointAtPinchCenter[0] - initialCamera.focalPoint[0],
          worldPointAtPinchCenter[1] - initialCamera.focalPoint[1],
          worldPointAtPinchCenter[2] - initialCamera.focalPoint[2],
        ];
        
        const newFocalPoint: [number, number, number] = [
          initialCamera.focalPoint[0] + offsetFromInitialFocal[0] * (1 - 1 / scaleFactor),
          initialCamera.focalPoint[1] + offsetFromInitialFocal[1] * (1 - 1 / scaleFactor),
          initialCamera.focalPoint[2] + offsetFromInitialFocal[2] * (1 - 1 / scaleFactor),
        ];
        
        const currentCamera = viewport.getCamera();
        
        viewport.setCamera({
          parallelScale: newParallelScale,
          focalPoint: newFocalPoint,
          position: currentCamera.position,
        });
        viewport.render();
      } catch (err) {
        console.warn('Error setting zoom:', err);
      }
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      isPinching = false;
      touches = [];
      initialDistance = 0;
      initialParallelScale = 1;
      pinchCenterCanvas = null;
      worldPointAtPinchCenter = null;
      initialCamera = null;
    }
    
    if (e.touches.length === 0) {
      setTimeout(() => {
        if (Date.now() - lastTapTime > 300) {
          tapCount = 0;
        }
      }, 300);
    }
  };

  viewportElement.addEventListener('touchstart', handleTouchStart, { passive: false });
  viewportElement.addEventListener('touchmove', handleTouchMove, { passive: false });
  viewportElement.addEventListener('touchend', handleTouchEnd, { passive: false });
  viewportElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });

  // Return cleanup function
  return () => {
    viewportElement.removeEventListener('touchstart', handleTouchStart);
    viewportElement.removeEventListener('touchmove', handleTouchMove);
    viewportElement.removeEventListener('touchend', handleTouchEnd);
    viewportElement.removeEventListener('touchcancel', handleTouchEnd);
  };
};
