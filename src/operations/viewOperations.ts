import { useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import type { Orientation, Series } from '../types';
import { getSeriesByOrientation } from '../utils/orientationMapping';

interface ViewOperationsOptions {
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
  applyTransformations: (viewportId: string) => void;
  setCurrentImageIndex: (index: number) => void;
  activeViewportId: string;
}

/**
 * View change operations for DICOM viewport
 * Handles orientation changes, stack navigation, and view switching
 */
export const useViewOperations = ({
  getViewport,
  applyTransformations,
  setCurrentImageIndex,
  activeViewportId,
}: ViewOperationsOptions) => {
  /**
   * Navigate to next image in stack
   */
  const navigateToNext = useCallback((viewportId?: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const currentIndex = viewport.getCurrentImageIdIndex();
      const imageIds = viewport.getImageIds();
      if (!imageIds || imageIds.length === 0) return;

      if (currentIndex < imageIds.length - 1) {
        const newIndex = currentIndex + 1;
        viewport.setImageIdIndex(newIndex).then(() => {
          if (!viewportId || viewportId === activeViewportId) {
            setCurrentImageIndex(newIndex);
          }
          applyTransformations(viewportId || activeViewportId);
        }).catch((error) => {
          console.error('Error navigating to next image:', error);
        });
      }
    } catch (error) {
      console.error('Error in navigateToNext:', error);
    }
  }, [getViewport, activeViewportId, applyTransformations, setCurrentImageIndex]);

  /**
   * Navigate to previous image in stack
   */
  const navigateToPrevious = useCallback((viewportId?: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const currentIndex = viewport.getCurrentImageIdIndex();
      const imageIds = viewport.getImageIds();
      if (!imageIds || imageIds.length === 0) return;

      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        viewport.setImageIdIndex(newIndex).then(() => {
          if (!viewportId || viewportId === activeViewportId) {
            setCurrentImageIndex(newIndex);
          }
          applyTransformations(viewportId || activeViewportId);
        }).catch((error) => {
          console.error('Error navigating to previous image:', error);
        });
      }
    } catch (error) {
      console.error('Error in navigateToPrevious:', error);
    }
  }, [getViewport, activeViewportId, applyTransformations, setCurrentImageIndex]);

  /**
   * Navigate to specific image index
   */
  const navigateToIndex = useCallback((viewportId: string, index: number) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const imageIds = viewport.getImageIds();
      if (!imageIds || imageIds.length === 0) return;

      const clampedIndex = Math.max(0, Math.min(imageIds.length - 1, index));
      viewport.setImageIdIndex(clampedIndex).then(() => {
        if (viewportId === activeViewportId) {
          setCurrentImageIndex(clampedIndex);
        }
        applyTransformations(viewportId);
      }).catch((error) => {
        console.error('Error navigating to index:', error);
      });
    } catch (error) {
      console.error('Error in navigateToIndex:', error);
    }
  }, [getViewport, activeViewportId, applyTransformations, setCurrentImageIndex]);

  /**
   * Get current image index
   */
  const getCurrentImageIndex = useCallback((viewportId?: string): number => {
    const viewport = getViewport(viewportId);
    if (!viewport) return 0;

    try {
      return viewport.getCurrentImageIdIndex();
    } catch {
      return 0;
    }
  }, [getViewport]);

  /**
   * Get total number of images in stack
   */
  const getTotalImages = useCallback((viewportId?: string): number => {
    const viewport = getViewport(viewportId);
    if (!viewport) return 0;

    try {
      const imageIds = viewport.getImageIds();
      return imageIds ? imageIds.length : 0;
    } catch {
      return 0;
    }
  }, [getViewport]);

  /**
   * Change orientation view
   * This is a helper that returns the series for the given orientation
   */
  const getSeriesForOrientation = useCallback((orientation: Orientation, seriesList: Series[]): Series | null => {
    return getSeriesByOrientation(orientation, seriesList);
  }, []);

  return {
    navigateToNext,
    navigateToPrevious,
    navigateToIndex,
    getCurrentImageIndex,
    getTotalImages,
    getSeriesForOrientation,
  };
};
