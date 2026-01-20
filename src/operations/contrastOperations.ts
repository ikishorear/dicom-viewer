import { useCallback } from 'react';
import type { ViewportTransformations } from '../types';

interface ContrastOperationsOptions {
  getTransformations: (viewportId: string) => ViewportTransformations;
  updateTransformations: (viewportId: string, updates: Partial<ViewportTransformations>) => void;
  applyTransformations: (viewportId: string) => void;
}

/**
 * Contrast adjustment operations for DICOM viewport
 */
export const useContrastOperations = ({
  getTransformations,
  updateTransformations,
  applyTransformations,
}: ContrastOperationsOptions) => {
  /**
   * Set contrast value (0.1 to 3.0)
   */
  const setContrast = useCallback((viewportId: string, value: number) => {
    const clampedValue = Math.max(0.1, Math.min(3.0, value));
    updateTransformations(viewportId, { contrast: clampedValue });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Increase contrast by a step
   */
  const increaseContrast = useCallback((viewportId: string, step: number = 0.1) => {
    const current = getTransformations(viewportId);
    const newValue = Math.min(3.0, (current.contrast || 1.0) + step);
    setContrast(viewportId, newValue);
  }, [getTransformations, setContrast]);

  /**
   * Decrease contrast by a step
   */
  const decreaseContrast = useCallback((viewportId: string, step: number = 0.1) => {
    const current = getTransformations(viewportId);
    const newValue = Math.max(0.1, (current.contrast || 1.0) - step);
    setContrast(viewportId, newValue);
  }, [getTransformations, setContrast]);

  /**
   * Reset contrast to default (1.0)
   */
  const resetContrast = useCallback((viewportId: string) => {
    setContrast(viewportId, 1.0);
  }, [setContrast]);

  /**
   * Get current contrast value
   */
  const getContrast = useCallback((viewportId: string): number => {
    const current = getTransformations(viewportId);
    return current.contrast || 1.0;
  }, [getTransformations]);

  return {
    setContrast,
    increaseContrast,
    decreaseContrast,
    resetContrast,
    getContrast,
  };
};
