import { useState, useCallback } from 'react';
import type { ViewportTransformations, TransformationsState } from '../types';

export const useTransformations = () => {
  const [transformations, setTransformations] = useState<TransformationsState>({});

  const getTransformations = useCallback((viewportId: string): ViewportTransformations => {
    return transformations[viewportId] || {
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      inverted: false,
      contrast: 1.0,
    };
  }, [transformations]);

  const updateTransformations = useCallback((viewportId: string, updates: Partial<ViewportTransformations>) => {
    setTransformations(prev => ({
      ...prev,
      [viewportId]: {
        ...getTransformations(viewportId),
        ...updates,
      },
    }));
  }, [getTransformations]);

  const resetTransformations = useCallback((viewportId: string) => {
    updateTransformations(viewportId, {
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      inverted: false,
      contrast: 1.0,
    });
  }, [updateTransformations]);

  return {
    transformations,
    getTransformations,
    updateTransformations,
    resetTransformations,
  };
};
