import { useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';

interface ZoomOperationsOptions {
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
  fitParallelScaleRef: React.MutableRefObject<{ [key: string]: number }>;
}

/**
 * Zoom operations for DICOM viewport
 */
export const useZoomOperations = ({
  getViewport,
  fitParallelScaleRef,
}: ZoomOperationsOptions) => {
  /**
   * Reset zoom to fit viewport
   */
  const resetZoom = useCallback((viewportId: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      viewport.resetCamera();
      const camera = viewport.getCamera();
      if (camera && camera.parallelScale) {
        fitParallelScaleRef.current[viewportId] = camera.parallelScale;
      }
      viewport.render();
    } catch (error) {
      console.error('Error resetting zoom:', error);
    }
  }, [getViewport, fitParallelScaleRef]);

  /**
   * Zoom in by a factor
   */
  const zoomIn = useCallback((viewportId: string, factor: number = 1.2) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const camera = viewport.getCamera();
      const currentParallelScale = camera.parallelScale || 1;
      const fitScale = fitParallelScaleRef.current[viewportId] || currentParallelScale;
      
      const newParallelScale = currentParallelScale / factor;
      const minParallelScale = fitScale / 5; // Max 5x zoom
      
      if (newParallelScale >= minParallelScale) {
        viewport.setCamera({
          parallelScale: newParallelScale,
        });
        viewport.render();
      }
    } catch (error) {
      console.error('Error zooming in:', error);
    }
  }, [getViewport, fitParallelScaleRef]);

  /**
   * Zoom out by a factor
   */
  const zoomOut = useCallback((viewportId: string, factor: number = 1.2) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const camera = viewport.getCamera();
      const currentParallelScale = camera.parallelScale || 1;
      const fitScale = fitParallelScaleRef.current[viewportId] || currentParallelScale;
      
      const newParallelScale = currentParallelScale * factor;
      const maxParallelScale = fitScale; // Never zoom out beyond fit
      
      if (newParallelScale <= maxParallelScale) {
        viewport.setCamera({
          parallelScale: newParallelScale,
        });
        viewport.render();
      }
    } catch (error) {
      console.error('Error zooming out:', error);
    }
  }, [getViewport, fitParallelScaleRef]);

  /**
   * Zoom to a specific scale (1.0 = fit, 2.0 = 2x zoom, etc.)
   */
  const zoomTo = useCallback((viewportId: string, scale: number) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const fitScale = fitParallelScaleRef.current[viewportId];
      if (!fitScale) {
        resetZoom(viewportId);
        return;
      }

      const newParallelScale = fitScale / scale;
      const minParallelScale = fitScale / 5; // Max 5x zoom
      const maxParallelScale = fitScale; // Never zoom out beyond fit
      
      const clampedScale = Math.max(minParallelScale, Math.min(maxParallelScale, newParallelScale));
      
      viewport.setCamera({
        parallelScale: clampedScale,
      });
      viewport.render();
    } catch (error) {
      console.error('Error zooming to scale:', error);
    }
  }, [getViewport, fitParallelScaleRef, resetZoom]);

  return {
    resetZoom,
    zoomIn,
    zoomOut,
    zoomTo,
  };
};
