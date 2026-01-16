/**
 * Production-Grade Zoom & Pan Hook for DICOM Viewer
 * 
 * Implements a robust zoom/pan system with strict bounds enforcement,
 * similar to medical imaging applications and map viewers.
 * 
 * Features:
 * - Pinch-to-zoom centered on gesture focal point
 * - Single-finger pan with bounds clamping
 * - Double-tap to zoom
 * - Strict bounds enforcement (image never leaves viewport)
 * - Performance optimized with requestAnimationFrame
 * - WebView-friendly (prevents native zoom, scroll, rubber-banding)
 */

import { useRef, useCallback, useEffect } from 'react';

export interface ZoomPanState {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ZoomPanConfig {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  doubleTapZoom?: number;
  boundsPadding?: number;
}

export interface UseZoomPanReturn {
  state: ZoomPanState;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
    reset: () => void;
  };
  setState: (newState: Partial<ZoomPanState>) => void;
}

const DEFAULT_CONFIG: Required<ZoomPanConfig> = {
  minScale: 1,
  maxScale: 5,
  initialScale: 1,
  doubleTapZoom: 2,
  boundsPadding: 0,
};

/**
 * Calculate the distance between two touch points
 */
function getDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the center point between two touches
 */
function getCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate bounds for translation based on current scale and container/image dimensions
 * 
 * The bounds ensure the image never leaves the viewport:
 * - When zoomed in (scale > 1), the image can be panned but not beyond its edges
 * - When at min scale (scale = 1), translation should be 0 (image fits perfectly)
 * 
 * Formula:
 * - maxTranslateX = (imageWidth * scale - containerWidth) / 2
 * - minTranslateX = -maxTranslateX
 * - Same for Y axis
 */
function calculateBounds(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number,
  padding: number = 0
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  // Scaled image dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // If image is smaller than container at current scale, no translation needed
  if (scaledWidth <= containerWidth && scaledHeight <= containerHeight) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  // Calculate maximum translation to keep image edges within viewport
  // We want the image edges to align with container edges when panned to extremes
  const maxTranslateX = (scaledWidth - containerWidth) / 2 + padding;
  const maxTranslateY = (scaledHeight - containerHeight) / 2 + padding;

  return {
    minX: -maxTranslateX,
    maxX: maxTranslateX,
    minY: -maxTranslateY,
    maxY: maxTranslateY,
  };
}

/**
 * Clamp translation values to ensure image stays within bounds
 */
function clampTranslation(
  translateX: number,
  translateY: number,
  bounds: ReturnType<typeof calculateBounds>
): { translateX: number; translateY: number } {
  return {
    translateX: clamp(translateX, bounds.minX, bounds.maxX),
    translateY: clamp(translateY, bounds.minY, bounds.maxY),
  };
}

/**
 * Production-grade zoom & pan hook
 */
export function useZoomPan(
  containerRef: React.RefObject<HTMLElement>,
  imageRef: React.RefObject<HTMLElement>,
  config: ZoomPanConfig = {}
): UseZoomPanReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // State stored in refs for performance (avoid re-renders)
  const stateRef = useRef<ZoomPanState>({
    scale: finalConfig.initialScale,
    translateX: 0,
    translateY: 0,
  });

  // Gesture tracking
  const gestureStateRef = useRef<{
    isPinching: boolean;
    isPanning: boolean;
    initialDistance: number;
    initialScale: number;
    initialTranslateX: number;
    initialTranslateY: number;
    pinchCenter: { x: number; y: number } | null;
    lastPanPoint: { x: number; y: number } | null;
    lastTapTime: number;
    tapCount: number;
  }>({
    isPinching: false,
    isPanning: false,
    initialDistance: 0,
    initialScale: 1,
    initialTranslateX: 0,
    initialTranslateY: 0,
    pinchCenter: null,
    lastPanPoint: null,
    lastTapTime: 0,
    tapCount: 0,
  });

  // Animation frame for smooth updates
  const rafRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<ZoomPanState | null>(null);

  /**
   * Get container and image dimensions for bounds calculation
   */
  const getDimensions = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    
    if (!container || !image) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    return {
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
    };
  }, [containerRef, imageRef]);

  /**
   * Apply transform to the image element
   * Uses CSS transform with transform-origin: 0 0 for precise control
   */
  const applyTransform = useCallback(
    (state: ZoomPanState) => {
      const image = imageRef.current;
      if (!image) return;

      // Get dimensions for bounds calculation
      const dims = getDimensions();
      if (!dims) return;

      // Calculate bounds based on current scale
      const bounds = calculateBounds(
        dims.containerWidth,
        dims.containerHeight,
        dims.imageWidth,
        dims.imageHeight,
        state.scale,
        finalConfig.boundsPadding
      );

      // Clamp translation to bounds
      const clamped = clampTranslation(state.translateX, state.translateY, bounds);

      // Apply transform
      // Using transform-origin: 0 0 means we translate first, then scale
      // This gives us precise control over the focal point
      image.style.transform = `translate(${clamped.translateX}px, ${clamped.translateY}px) scale(${state.scale})`;
      image.style.transformOrigin = '0 0';

      // Update state with clamped values
      stateRef.current = {
        scale: state.scale,
        translateX: clamped.translateX,
        translateY: clamped.translateY,
      };
    },
    [imageRef, getDimensions, finalConfig.boundsPadding]
  );

  /**
   * Schedule a transform update using requestAnimationFrame
   * Batches multiple updates for performance
   */
  const scheduleUpdate = useCallback(
    (newState: Partial<ZoomPanState>) => {
      const updatedState: ZoomPanState = {
        ...stateRef.current,
        ...newState,
      };

      pendingUpdateRef.current = updatedState;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingUpdateRef.current) {
            applyTransform(pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
          rafRef.current = null;
        });
      }
    },
    [applyTransform]
  );

  /**
   * Handle pinch-to-zoom with focal point centering
   * 
   * Math explanation:
   * When zooming, we want the point under the pinch center to stay fixed.
   * 
   * If we have:
   * - Initial scale: s1
   * - New scale: s2
   * - Pinch center in container coordinates: (cx, cy)
   * - Current translation: (tx, ty)
   * 
   * The point under the pinch center in image coordinates is:
   * - Image point: ((cx - tx) / s1, (cy - ty) / s1)
   * 
   * After zoom to s2, we want this same image point to be at (cx, cy) in container:
   * - New translation: (tx', ty')
   * - (cx - tx') / s2 = (cx - tx) / s1
   * - Solving: tx' = cx - (cx - tx) * (s2 / s1)
   * 
   * This keeps the focal point fixed during zoom.
   */
  const handlePinchZoom = useCallback(
    (touches: TouchList) => {
      if (touches.length !== 2) return;

      const gesture = gestureStateRef.current;
      const currentDistance = getDistance(touches[0], touches[1]);
      const scaleFactor = gesture.initialDistance / currentDistance;
      const newScale = clamp(
        gesture.initialScale * scaleFactor,
        finalConfig.minScale,
        finalConfig.maxScale
      );

      // Get pinch center in container coordinates
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const currentCenter = getCenter(touches[0], touches[1]);
      const pinchCenterX = currentCenter.x - containerRect.left;
      const pinchCenterY = currentCenter.y - containerRect.top;

      // Calculate new translation to keep focal point fixed
      // Formula: newTranslate = center - (center - oldTranslate) * (newScale / oldScale)
      const scaleRatio = newScale / gesture.initialScale;
      const newTranslateX =
        pinchCenterX - (pinchCenterX - gesture.initialTranslateX) * scaleRatio;
      const newTranslateY =
        pinchCenterY - (pinchCenterY - gesture.initialTranslateY) * scaleRatio;

      scheduleUpdate({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
      });
    },
    [containerRef, scheduleUpdate, finalConfig.minScale, finalConfig.maxScale]
  );

  /**
   * Handle single-finger pan
   */
  const handlePan = useCallback(
    (touch: Touch) => {
      const gesture = gestureStateRef.current;
      if (!gesture.lastPanPoint) return;

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const deltaX = touch.clientX - gesture.lastPanPoint.x;
      const deltaY = touch.clientY - gesture.lastPanPoint.y;

      const newTranslateX = gesture.initialTranslateX + deltaX;
      const newTranslateY = gesture.initialTranslateY + deltaY;

      scheduleUpdate({
        translateX: newTranslateX,
        translateY: newTranslateY,
      });
    },
    [containerRef, scheduleUpdate]
  );

  /**
   * Handle double-tap to zoom
   */
  const handleDoubleTap = useCallback(
    (touch: Touch) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const tapX = touch.clientX - containerRect.left;
      const tapY = touch.clientY - containerRect.top;

      const currentState = stateRef.current;
      const isZoomedIn = currentState.scale > finalConfig.minScale;

      if (isZoomedIn) {
        // Reset to fit
        scheduleUpdate({
          scale: finalConfig.minScale,
          translateX: 0,
          translateY: 0,
        });
      } else {
        // Zoom in towards tap point
        const newScale = clamp(
          finalConfig.minScale * finalConfig.doubleTapZoom,
          finalConfig.minScale,
          finalConfig.maxScale
        );

        // Calculate translation to center on tap point
        const scaleRatio = newScale / currentState.scale;
        const newTranslateX = tapX - (tapX - currentState.translateX) * scaleRatio;
        const newTranslateY = tapY - (tapY - currentState.translateY) * scaleRatio;

        scheduleUpdate({
          scale: newScale,
          translateX: newTranslateX,
          translateY: newTranslateY,
        });
      }
    },
    [containerRef, scheduleUpdate, finalConfig]
  );

  /**
   * Touch start handler
   */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent native zoom and scroll

      const touches = e.touches;
      const gesture = gestureStateRef.current;
      const currentState = stateRef.current;

      if (touches.length === 2) {
        // Pinch gesture
        gesture.isPinching = true;
        gesture.isPanning = false;
        gesture.initialDistance = getDistance(touches[0], touches[1]);
        gesture.initialScale = currentState.scale;
        gesture.initialTranslateX = currentState.translateX;
        gesture.initialTranslateY = currentState.translateY;

        const center = getCenter(touches[0], touches[1]);
        const container = containerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          gesture.pinchCenter = {
            x: center.x - containerRect.left,
            y: center.y - containerRect.top,
          };
        }
      } else if (touches.length === 1) {
        // Single touch - could be pan or double-tap
        gesture.isPanning = true;
        gesture.isPinching = false;
        gesture.lastPanPoint = {
          x: touches[0].clientX,
          y: touches[0].clientY,
        };
        gesture.initialTranslateX = currentState.translateX;
        gesture.initialTranslateY = currentState.translateY;

        // Double-tap detection
        const currentTime = Date.now();
        const timeDiff = currentTime - gesture.lastTapTime;

        if (timeDiff < 300 && gesture.tapCount === 1) {
          handleDoubleTap(touches[0]);
          gesture.tapCount = 0;
          gesture.isPanning = false;
          return;
        } else {
          gesture.tapCount = 1;
        }
        gesture.lastTapTime = currentTime;
      }
    },
    [handleDoubleTap]
  );

  /**
   * Touch move handler
   */
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent native scroll

      const touches = e.touches;
      const gesture = gestureStateRef.current;

      if (touches.length === 2 && gesture.isPinching) {
        handlePinchZoom(touches);
      } else if (touches.length === 1 && gesture.isPanning && gesture.lastPanPoint) {
        handlePan(touches[0]);
        gesture.lastPanPoint = {
          x: touches[0].clientX,
          y: touches[0].clientY,
        };
      }
    },
    [handlePinchZoom, handlePan]
  );

  /**
   * Touch end handler
   */
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    const gesture = gestureStateRef.current;

    if (e.touches.length < 2) {
      gesture.isPinching = false;
    }

    if (e.touches.length === 0) {
      gesture.isPanning = false;
      gesture.lastPanPoint = null;

      // Reset tap count after delay
      setTimeout(() => {
        if (Date.now() - gesture.lastTapTime > 300) {
          gesture.tapCount = 0;
        }
      }, 300);
    }
  }, []);

  /**
   * Touch cancel handler
   */
  const onTouchCancel = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const gesture = gestureStateRef.current;
    gesture.isPinching = false;
    gesture.isPanning = false;
    gesture.lastPanPoint = null;
  }, []);

  /**
   * Reset zoom and pan to initial state
   */
  const reset = useCallback(() => {
    scheduleUpdate({
      scale: finalConfig.initialScale,
      translateX: 0,
      translateY: 0,
    });
  }, [scheduleUpdate, finalConfig.initialScale]);

  /**
   * Set state manually (for external control)
   */
  const setState = useCallback(
    (newState: Partial<ZoomPanState>) => {
      scheduleUpdate(newState);
    },
    [scheduleUpdate]
  );

  // Initialize transform on mount
  useEffect(() => {
    applyTransform(stateRef.current);
  }, [applyTransform]);

  return {
    state: stateRef.current,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      reset,
    },
    setState,
  };
}
