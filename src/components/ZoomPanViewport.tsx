/**
 * ZoomPanViewport Component
 * 
 * Wraps a Cornerstone viewport with production-grade zoom & pan controls.
 * Integrates CSS transform-based zoom/pan with Cornerstone's rendering system.
 * 
 * This component:
 * - Handles all touch/pointer events
 * - Enforces strict bounds (image never leaves viewport)
 * - Syncs zoom/pan state with Cornerstone camera
 * - Prevents native browser zoom and scroll
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useZoomPan, ZoomPanConfig } from '../hooks/useZoomPan';

interface ZoomPanViewportProps {
  viewportId: string;
  children: React.ReactNode;
  onZoomPanChange?: (state: { scale: number; translateX: number; translateY: number }) => void;
  config?: ZoomPanConfig;
  getViewport?: (viewportId: string) => any; // Cornerstone viewport
}

export const ZoomPanViewport: React.FC<ZoomPanViewportProps> = ({
  viewportId,
  children,
  onZoomPanChange,
  config,
  getViewport,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  const { state, handlers, setState, reset } = useZoomPan(containerRef, imageRef, {
    minScale: 1,
    maxScale: 5,
    initialScale: 1,
    doubleTapZoom: 2,
    ...config,
  });

  /**
   * Sync zoom/pan state with Cornerstone viewport camera
   * Converts CSS transform state to Cornerstone camera parameters
   */
  const syncWithCornerstone = useCallback(() => {
    if (!getViewport) return;

    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      // Get current camera
      const camera = viewport.getCamera();
      const currentParallelScale = camera.parallelScale || 1;

      // Convert scale to parallelScale
      // In Cornerstone, smaller parallelScale = more zoomed in
      // We need to invert the relationship
      const baseParallelScale = 100; // Adjust based on your image dimensions
      const newParallelScale = baseParallelScale / state.scale;

      // Calculate focal point adjustment based on translation
      // Translation in CSS pixels needs to be converted to world coordinates
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      // Convert CSS translation to world coordinates
      // This is approximate - you may need to adjust based on your image dimensions
      const worldDeltaX = (state.translateX / canvasRect.width) * currentParallelScale;
      const worldDeltaY = (state.translateY / canvasRect.height) * currentParallelScale;

      // Update camera
      viewport.setCamera({
        parallelScale: newParallelScale,
        focalPoint: [
          camera.focalPoint[0] - worldDeltaX,
          camera.focalPoint[1] + worldDeltaY, // Y is inverted in image coordinates
          camera.focalPoint[2],
        ] as [number, number, number],
      });

      viewport.render();
    } catch (err) {
      console.warn('Error syncing with Cornerstone:', err);
    }
  }, [viewportId, getViewport, state]);

  // Sync with Cornerstone when state changes (debounced)
  useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      syncWithCornerstone();
      if (onZoomPanChange) {
        onZoomPanChange(state);
      }
    }, 16); // ~60fps

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state, syncWithCornerstone, onZoomPanChange]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none', // Prevent native zoom and scroll
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      {...handlers}
    >
      <div
        ref={imageRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};
