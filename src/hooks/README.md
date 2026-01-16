# Production-Grade Zoom & Pan System

This directory contains a production-ready zoom & pan implementation for the DICOM viewer, designed for medical imaging applications.

## Files

### `useZoomPan.ts`
A generic zoom & pan hook that works with CSS transforms. This is a standalone implementation that can be used with any HTML element.

**Features:**
- Pinch-to-zoom centered on gesture focal point
- Single-finger pan with strict bounds enforcement
- Double-tap to zoom
- Performance optimized with requestAnimationFrame
- WebView-friendly (prevents native zoom/scroll)

**Usage:**
```tsx
const { state, handlers, reset } = useZoomPan(containerRef, imageRef, {
  minScale: 1,
  maxScale: 5,
  doubleTapZoom: 2,
});
```

### `useCornerstoneZoomPan.ts`
A specialized hook that integrates directly with Cornerstone.js viewports. This is the recommended implementation for the DICOM viewer.

**Features:**
- Direct integration with Cornerstone camera system
- Enforces strict bounds (image never leaves viewport)
- Handles coordinate transformation between screen and world coordinates
- Syncs with Cornerstone's parallelScale and focalPoint

**Usage:**
```tsx
const { handlers, reset, setFitParallelScale } = useCornerstoneZoomPan(
  viewportId,
  getViewport,
  {
    minScale: 1,
    maxScale: 5,
    doubleTapZoom: 2,
  }
);
```

## Key Concepts

### Bounds Calculation

The system calculates bounds to ensure the image never leaves the viewport:

1. **At minimum scale (fit to window):** Translation is clamped to 0
2. **When zoomed in:** Maximum translation is calculated based on:
   - Image dimensions (scaled by current zoom)
   - Viewport dimensions
   - Formula: `maxTranslate = (scaledImageSize - viewportSize) / 2`

### Focal Point Zoom

When zooming, the point under the pinch center stays fixed:

1. Calculate the world point at the pinch center before zoom
2. Apply zoom
3. Adjust focal point so the same world point remains at the pinch center

**Formula:**
```
newFocalPoint = oldFocalPoint + (worldPoint - oldFocalPoint) * (1 - 1/scaleFactor)
```

### Performance Optimizations

- Uses `requestAnimationFrame` to batch updates
- Stores state in refs to avoid re-renders
- Debounces Cornerstone camera updates
- Prevents layout thrashing by using CSS transforms

## Integration

To integrate with the DICOM viewer:

1. Import the hook in your viewport component
2. Call the hook with the viewport ID and getViewport function
3. Attach the handlers to the viewport element
4. Call `setFitParallelScale` when `resetCamera()` is called

Example:
```tsx
const zoomPan = useCornerstoneZoomPan(viewportId, getViewport, {
  minScale: 1,
  maxScale: 5,
});

// Attach handlers
<div {...zoomPan.handlers}>
  {/* viewport content */}
</div>

// When resetCamera is called:
viewport.resetCamera();
zoomPan.setFitParallelScale(viewport.getCamera().parallelScale);
```

## Testing

Test the following scenarios:

1. **Pinch-to-zoom:** Image should zoom towards pinch center, never go off-screen
2. **Pan:** Image should pan smoothly, but stop at edges
3. **Double-tap:** Should zoom in/out smoothly
4. **Bounds enforcement:** Try zooming out beyond fit - should stop at fit scale
5. **Edge cases:** Rapid gestures, multiple touches, etc.

## Browser Compatibility

- iOS Safari (WebView)
- Android Chrome (WebView)
- Desktop browsers (Chrome, Firefox, Safari, Edge)

All implementations use standard touch events and CSS transforms for maximum compatibility.
