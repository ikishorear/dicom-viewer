import { useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';

interface PanOperationsOptions {
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
}

/**
 * Pan operations for DICOM viewport
 */
export const usePanOperations = ({
  getViewport,
}: PanOperationsOptions) => {
  /**
   * Pan the viewport by delta pixels
   */
  const pan = useCallback((viewportId: string, deltaX: number, deltaY: number) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const camera = viewport.getCamera();
      if (!camera.focalPoint || !camera.position) return;
      
      // Convert screen delta to world delta
      const startWorld = viewport.canvasToWorld([0, 0]) as [number, number, number];
      const endWorld = viewport.canvasToWorld([deltaX, deltaY]) as [number, number, number];

      const worldDelta = [
        startWorld[0] - endWorld[0],
        startWorld[1] - endWorld[1],
        startWorld[2] - endWorld[2],
      ];

      // Calculate new focal point and position
      const newFocalPoint: [number, number, number] = [
        camera.focalPoint[0] + worldDelta[0],
        camera.focalPoint[1] + worldDelta[1],
        camera.focalPoint[2] + worldDelta[2],
      ];

      const newPosition: [number, number, number] = [
        camera.position[0] + worldDelta[0],
        camera.position[1] + worldDelta[1],
        camera.position[2] + worldDelta[2],
      ];

      viewport.setCamera({
        focalPoint: newFocalPoint,
        position: newPosition,
      });
      viewport.render();
    } catch (error) {
      console.error('Error panning viewport:', error);
    }
  }, [getViewport]);

  /**
   * Reset pan to center
   */
  const resetPan = useCallback((viewportId: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      viewport.resetCamera();
      viewport.render();
    } catch (error) {
      console.error('Error resetting pan:', error);
    }
  }, [getViewport]);

  /**
   * Pan to a specific world coordinate
   */
  const panTo = useCallback((viewportId: string, worldX: number, worldY: number, worldZ: number) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const camera = viewport.getCamera();
      const currentFocalPoint = camera.focalPoint;
      const currentPosition = camera.position;
      
      if (!currentFocalPoint || !currentPosition) return;

      const deltaX = worldX - currentFocalPoint[0];
      const deltaY = worldY - currentFocalPoint[1];
      const deltaZ = worldZ - currentFocalPoint[2];

      viewport.setCamera({
        focalPoint: [worldX, worldY, worldZ] as [number, number, number],
        position: [
          currentPosition[0] + deltaX,
          currentPosition[1] + deltaY,
          currentPosition[2] + deltaZ,
        ] as [number, number, number],
      });
      viewport.render();
    } catch (error) {
      console.error('Error panning to coordinate:', error);
    }
  }, [getViewport]);

  return {
    pan,
    resetPan,
    panTo,
  };
};
