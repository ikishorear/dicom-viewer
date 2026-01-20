import { useCallback } from 'react';
import type { ViewportTransformations } from '../types';

interface FlipOperationsOptions {
  getTransformations: (viewportId: string) => ViewportTransformations;
  updateTransformations: (viewportId: string, updates: Partial<ViewportTransformations>) => void;
  applyTransformations: (viewportId: string) => void;
}

/**
 * Flip operations for DICOM viewport
 */
export const useFlipOperations = ({
  getTransformations,
  updateTransformations,
  applyTransformations,
}: FlipOperationsOptions) => {
  /**
   * Toggle horizontal flip
   */
  const toggleHorizontalFlip = useCallback((viewportId: string) => {
    const current = getTransformations(viewportId);
    updateTransformations(viewportId, { flipHorizontal: !current.flipHorizontal });
    applyTransformations(viewportId);
  }, [getTransformations, updateTransformations, applyTransformations]);

  /**
   * Toggle vertical flip
   */
  const toggleVerticalFlip = useCallback((viewportId: string) => {
    const current = getTransformations(viewportId);
    updateTransformations(viewportId, { flipVertical: !current.flipVertical });
    applyTransformations(viewportId);
  }, [getTransformations, updateTransformations, applyTransformations]);

  /**
   * Set horizontal flip state
   */
  const setHorizontalFlip = useCallback((viewportId: string, flipped: boolean) => {
    updateTransformations(viewportId, { flipHorizontal: flipped });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Set vertical flip state
   */
  const setVerticalFlip = useCallback((viewportId: string, flipped: boolean) => {
    updateTransformations(viewportId, { flipVertical: flipped });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Reset all flips
   */
  const resetFlips = useCallback((viewportId: string) => {
    updateTransformations(viewportId, {
      flipHorizontal: false,
      flipVertical: false,
    });
    applyTransformations(viewportId);
  }, [updateTransformations, applyTransformations]);

  /**
   * Get current flip state
   */
  const getFlipState = useCallback((viewportId: string) => {
    const current = getTransformations(viewportId);
    return {
      flipHorizontal: current.flipHorizontal,
      flipVertical: current.flipVertical,
    };
  }, [getTransformations]);

  return {
    toggleHorizontalFlip,
    toggleVerticalFlip,
    setHorizontalFlip,
    setVerticalFlip,
    resetFlips,
    getFlipState,
  };
};
