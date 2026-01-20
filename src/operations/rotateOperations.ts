import { useCallback } from 'react';
import type { ViewportTransformations } from '../types';

interface RotateOperationsOptions {
  getTransformations: (viewportId: string) => ViewportTransformations;
  updateTransformations: (viewportId: string, updates: Partial<ViewportTransformations>) => void;
  applyTransformations: (viewportId: string) => void;
}

/**
 * Rotate operations for DICOM viewport
 */
export const useRotateOperations = ({
  getTransformations,
  updateTransformations,
  applyTransformations,
}: RotateOperationsOptions) => {
  /**
   * Rotate clockwise by angle (default 90 degrees)
   */
  const rotateClockwise = useCallback((viewportId: string, angle: number = 90) => {
    const current = getTransformations(viewportId);
    let newRotation = current.rotation + angle;
    // Normalize to [0, 360) range
    newRotation = ((newRotation % 360) + 360) % 360;
    updateTransformations(viewportId, { rotation: newRotation });
    applyTransformations(viewportId);
  }, [getTransformations, updateTransformations, applyTransformations]);

  /**
   * Rotate counter-clockwise by angle (default 90 degrees)
   */
  const rotateCounterClockwise = useCallback((viewportId: string, angle: number = 90) => {
    const current = getTransformations(viewportId);
    let newRotation = current.rotation - angle;
    // Normalize to [0, 360) range
    newRotation = ((newRotation % 360) + 360) % 360;
    updateTransformations(viewportId, { rotation: newRotation });
    applyTransformations(viewportId);
  }, [getTransformations, updateTransformations, applyTransformations]);

  /**
   * Set rotation to specific angle
   */
  const setRotation = useCallback((viewportId: string, angle: number) => {
    // Normalize to [0, 360) range
    const normalizedAngle = ((angle % 360) + 360) % 360;
    updateTransformations(viewportId, { rotation: normalizedAngle });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Reset rotation to 0
   */
  const resetRotation = useCallback((viewportId: string) => {
    updateTransformations(viewportId, { rotation: 0 });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Get current rotation angle
   */
  const getRotation = useCallback((viewportId: string): number => {
    const current = getTransformations(viewportId);
    return current.rotation;
  }, [getTransformations]);

  return {
    rotateClockwise,
    rotateCounterClockwise,
    setRotation,
    resetRotation,
    getRotation,
  };
};
