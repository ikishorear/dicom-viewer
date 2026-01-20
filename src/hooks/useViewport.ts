import { useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import type { ViewportTransformations } from '../types';

interface UseViewportOptions {
  renderingEngineRef: React.MutableRefObject<cornerstone.RenderingEngine | null>;
  activeViewportId: string;
  getTransformations: (viewportId: string) => ViewportTransformations;
}

export const useViewport = ({
  renderingEngineRef,
  activeViewportId,
  getTransformations,
}: UseViewportOptions) => {
  const getViewport = useCallback((viewportId?: string): cornerstone.StackViewport | null => {
    if (!renderingEngineRef.current) return null;
    const id = viewportId || activeViewportId;
    try {
      return renderingEngineRef.current.getViewport(id) as cornerstone.StackViewport;
    } catch {
      return null;
    }
  }, [renderingEngineRef, activeViewportId]);

  const applyTransformations = useCallback((viewportId: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    const transforms = getTransformations(viewportId);

    try {
      const viewportElement = viewport.element;
      if (viewportElement) {
        const canvas = viewportElement.querySelector('canvas');
        if (canvas) {
          const transformsArray: string[] = [];
          
          if (transforms.rotation !== 0) {
            transformsArray.push(`rotate(${transforms.rotation}deg)`);
          }
          
          if (transforms.flipHorizontal) {
            transformsArray.push('scaleX(-1)');
          }
          if (transforms.flipVertical) {
            transformsArray.push('scaleY(-1)');
          }
          
          const transform = transformsArray.length > 0 ? transformsArray.join(' ') : 'none';
          canvas.style.transform = transform;
          canvas.style.transformOrigin = 'center center';
          
          const contrastValue = transforms.contrast || 1.0;
          if (transforms.inverted) {
            canvas.style.filter = `contrast(${contrastValue}) invert(1)`;
          } else {
            canvas.style.filter = `contrast(${contrastValue})`;
          }
        }
      }

      viewport.render();
    } catch (error) {
      console.error('Error applying transformations:', error);
    }
  }, [getViewport, getTransformations]);

  return {
    getViewport,
    applyTransformations,
  };
};
