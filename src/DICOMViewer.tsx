import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

// Initialize Cornerstone
const { init, RenderingEngine } = cornerstone;
const { 
  init: initTools, 
  addTool,
  ToolGroupManager, 
  ZoomTool, 
  PanTool, 
  WindowLevelTool,
  StackScrollTool,
  Enums: toolEnums 
} = cornerstoneTools;

// Series data structure
interface Series {
  seriesId: string;
  imageIds: string[];
  seriesName?: string;
  instanceCount: number;
}

type Orientation = 'Axial' | 'Coronal' | 'Sagittal' | 'Acquisition';
type PaneLayout = 1 | 2 | 3 | 4;

// Styled Material UI Slider with white track
const WhiteSlider = styled(Slider)(() => ({
  color: '#ffffff',
  height: 8,
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: '#ffffff',
  },
  '& .MuiSlider-thumb': {
    width: 20,
    height: 20,
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
    '&:hover': {
      boxShadow: '0 3px 8px rgba(0, 0, 0, 0.6)',
    },
    '&.Mui-active': {
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.7)',
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#4b5563',
    opacity: 1,
  },
}));

// Mobile styled slider
const WhiteSliderMobile = styled(Slider)(() => ({
  color: '#ffffff',
  height: 12,
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: '#ffffff',
  },
  '& .MuiSlider-thumb': {
    width: 24,
    height: 24,
    backgroundColor: '#ffffff',
    border: '3px solid #3b82f6',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
    '&:hover': {
      boxShadow: '0 3px 8px rgba(0, 0, 0, 0.6)',
    },
    '&.Mui-active': {
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.7)',
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#4b5563',
    opacity: 1,
  },
}));

/**
 * Production-ready DICOM Viewer Component
 * Mobile-friendly, responsive, with all requested features
 */
export default function DICOMViewer() {
  const viewportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const renderingEngineRef = useRef<cornerstone.RenderingEngine | null>(null);
  const toolGroupsRef = useRef<{ [key: string]: ReturnType<typeof ToolGroupManager.createToolGroup> | null }>({});
  const cineIntervalRef = useRef<{ [viewportId: string]: number | null }>({});
  const loadedSeriesRef = useRef<Series | null>(null);
  
  // State
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [, setTotalImages] = useState<number>(0);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  
  // Image transformation state (per viewport)
  const [transformations, setTransformations] = useState<{
    [viewportId: string]: {
      rotation: number;
      flipHorizontal: boolean;
      flipVertical: boolean;
      inverted: boolean;
      contrast: number;
    }
  }>({});
  
  const [, setWindowWidth] = useState<number>(0);
  const [, setWindowCenter] = useState<number>(0);
  
  // Multi-stack features
  const [orientation, setOrientation] = useState<Orientation>('Axial');
  const [isCinePlaying, setIsCinePlaying] = useState<{ [viewportId: string]: boolean }>({});
  const [cineSpeed] = useState<number>(10);
  
  // Map series to orientations
  const getSeriesOrientation = useCallback((seriesId: string): Orientation | null => {
    if (seriesId === 'series-00000' || seriesId.includes('series-00000')) return 'Acquisition';
    if (seriesId === 'series-00001' || seriesId.includes('series-00001')) return 'Axial';
    if (seriesId === 'series-00002' || seriesId.includes('series-00002')) return 'Sagittal';
    if (seriesId === 'series-00003' || seriesId.includes('series-00003')) return 'Coronal';
    return null;
  }, []);

  // Get series by orientation
  const getSeriesByOrientation = useCallback((orientation: Orientation): Series | null => {
    const orientationMap: { [key in Orientation]: string } = {
      'Acquisition': 'series-00000',
      'Axial': 'series-00001',
      'Sagittal': 'series-00002',
      'Coronal': 'series-00003',
    };
    
    const targetSeriesId = orientationMap[orientation];
    return seriesList.find(s => s.seriesId === targetSeriesId || s.seriesId.includes(targetSeriesId)) || null;
  }, [seriesList]);
  
  // Multipane view
  const [paneLayout, setPaneLayout] = useState<PaneLayout>(1);
  const [activeViewportId, setActiveViewportId] = useState<string>('viewport-1');
  
  // Mobile/responsive state
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(!isMobile);
  const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(true);

  // Get transformation for a viewport
  const getTransformations = useCallback((viewportId: string) => {
    return transformations[viewportId] || {
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      inverted: false,
      contrast: 1.0,
    };
  }, [transformations]);

  // Update transformation for a viewport
  const updateTransformations = useCallback((viewportId: string, updates: Partial<typeof transformations[string]>) => {
    setTransformations(prev => ({
      ...prev,
      [viewportId]: {
        ...getTransformations(viewportId),
        ...updates,
      },
    }));
  }, [getTransformations]);

  // Get viewport helper (needed for pinch-to-zoom)
  const getViewport = useCallback((viewportId?: string): cornerstone.StackViewport | null => {
    if (!renderingEngineRef.current) return null;
    const id = viewportId || activeViewportId;
    try {
      return renderingEngineRef.current.getViewport(id) as cornerstone.StackViewport;
    } catch {
      return null;
    }
  }, [activeViewportId]);

  // Store the initial "fit" parallel scale for each viewport (set by resetCamera)
  const fitParallelScaleRef = useRef<{ [key: string]: number }>({});

  /**
   * Simple Zoom-Only Handler
   * 
   * This implementation provides:
   * - Pinch-to-zoom centered on gesture focal point
   * - Image stays fixed/centered
   * - Zoom in only (no zoom out beyond fit)
   * - Double-tap to reset zoom
   * 
   * Focal Point Zoom:
   * - When zooming, the point under the pinch center stays fixed
   * - Formula: newFocalPoint = oldFocalPoint + (worldPoint - oldFocalPoint) * (1 - 1/scaleFactor)
   */
  const setupPinchToZoom = useCallback((viewportId: string, viewportElement: HTMLElement) => {
    // Configuration
    // Removed unused MIN_SCALE constant
    const MAX_SCALE = 5; // Maximum zoom (5x)
    
    // Helper functions
    const getDistance = (touch1: Touch, touch2: Touch): number => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    };

    const getCanvasCoordinates = (screenX: number, screenY: number): { x: number; y: number } => {
      const canvas = viewportElement.querySelector('canvas');
      if (!canvas) {
        const rect = viewportElement.getBoundingClientRect();
        return { x: screenX - rect.left, y: screenY - rect.top };
      }
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: screenX - canvasRect.left,
        y: screenY - canvasRect.top,
      };
    };

    /**
     * Calculate current scale from parallelScale
     * Scale = fitParallelScale / currentParallelScale
     */

    // Gesture state
    let initialDistance = 0;
    let initialParallelScale = 1;
    let touches: Touch[] = [];
    let isPinching = false;
    let lastTapTime = 0;
    let tapCount = 0;
    let pinchCenterCanvas: { x: number; y: number } | null = null;
    let worldPointAtPinchCenter: [number, number, number] | null = null;
    let initialCamera: { parallelScale: number; focalPoint: [number, number, number]; position: [number, number, number] } | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const viewport = getViewport(viewportId);
      if (!viewport) return;

      if (e.touches.length === 2) {
        touches = Array.from(e.touches);
        initialDistance = getDistance(touches[0], touches[1]);
        const center = getCenter(touches[0], touches[1]);
        pinchCenterCanvas = getCanvasCoordinates(center.x, center.y);
        
        try {
          const camera = viewport.getCamera();
          initialParallelScale = camera.parallelScale || 1;
          initialCamera = {
            parallelScale: camera.parallelScale ?? 1,
            focalPoint: camera.focalPoint ? [...camera.focalPoint] as [number, number, number] : [0, 0, 0],
            position: camera.position ? [...camera.position] as [number, number, number] : [0, 0, 0],
          };
          
          // Get the world point at the pinch center - this is what we want to keep fixed
          worldPointAtPinchCenter = viewport.canvasToWorld([pinchCenterCanvas.x, pinchCenterCanvas.y]) as [number, number, number];
          
          // Store the fit scale if not already stored (this is the maximum zoom-out limit)
          if (!fitParallelScaleRef.current[viewportId]) {
            fitParallelScaleRef.current[viewportId] = initialParallelScale;
          }
        } catch (err) {
          console.warn('Error getting initial camera:', err);
          return;
        }
        
        isPinching = true;
        tapCount = 0;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // Double-tap to reset zoom
        const currentTime = Date.now();
        const timeDiff = currentTime - lastTapTime;
        
        if (timeDiff < 300 && tapCount === 1) {
          try {
            const camera = viewport.getCamera();
            const currentZoom = camera.parallelScale || 1;
            const fitScale = fitParallelScaleRef.current[viewportId] || currentZoom;
            
            // If zoomed in, reset to fit
            if (currentZoom < fitScale) {
              viewport.resetCamera();
              const resetCamera = viewport.getCamera();
              fitParallelScaleRef.current[viewportId] = resetCamera.parallelScale ?? 1;
              viewport.render();
            }
            tapCount = 0;
            e.preventDefault();
            return;
          } catch (err) {
            console.warn('Error in double-tap reset:', err);
          }
        } else {
          tapCount = 1;
        }
        lastTapTime = currentTime;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const viewport = getViewport(viewportId);
      if (!viewport) return;

      if (e.touches.length === 2 && isPinching && pinchCenterCanvas && worldPointAtPinchCenter && initialCamera) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;
        
        // Get the fit scale (maximum zoom-out limit) - never zoom out beyond initial fit
        let fitScale = fitParallelScaleRef.current[viewportId];
        if (!fitScale) {
          fitScale = initialParallelScale;
          fitParallelScaleRef.current[viewportId] = fitScale;
        }
        
        // Calculate desired new scale based on pinch gesture
        // scale > 1 means pinching out (zoom in), scale < 1 means pinching in (zoom out)
        // In Cornerstone: smaller parallelScale = zoomed in, larger parallelScale = zoomed out
        const desiredParallelScale = initialParallelScale / scale;
        
        // Constrain zoom: 
        // - Never zoom out beyond fit scale (initial "fit to window" scale)
        // - Maximum zoom in: fitScale / MAX_SCALE
        const minParallelScale = fitScale / MAX_SCALE; // Maximum zoom in
        const maxParallelScale = fitScale; // Never zoom out beyond fit
        const newParallelScale = Math.max(minParallelScale, Math.min(maxParallelScale, desiredParallelScale));

        try {
          // If trying to zoom out beyond fit, stop
          if (newParallelScale >= fitScale && desiredParallelScale > fitScale) {
            return;
          }
          
          // Zoom: adjust focal point to keep pinch center fixed
          // Formula: newFocalPoint = oldFocalPoint + (worldPoint - oldFocalPoint) * (1 - 1/scaleFactor)
          const scaleFactor = initialParallelScale / newParallelScale;
          
          const offsetFromInitialFocal = [
            worldPointAtPinchCenter[0] - initialCamera.focalPoint[0],
            worldPointAtPinchCenter[1] - initialCamera.focalPoint[1],
            worldPointAtPinchCenter[2] - initialCamera.focalPoint[2],
          ];
          
          const newFocalPoint: [number, number, number] = [
            initialCamera.focalPoint[0] + offsetFromInitialFocal[0] * (1 - 1 / scaleFactor),
            initialCamera.focalPoint[1] + offsetFromInitialFocal[1] * (1 - 1 / scaleFactor),
            initialCamera.focalPoint[2] + offsetFromInitialFocal[2] * (1 - 1 / scaleFactor),
          ];
          
          const currentCamera = viewport.getCamera();
          
            viewport.setCamera({
              parallelScale: newParallelScale,
            focalPoint: newFocalPoint,
            position: currentCamera.position,
            });
            viewport.render();
          } catch (err) {
            console.warn('Error setting zoom:', err);
        }
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        touches = [];
        initialDistance = 0;
        initialParallelScale = 1;
        pinchCenterCanvas = null;
        worldPointAtPinchCenter = null;
        initialCamera = null;
      }
      
      if (e.touches.length === 0) {
        setTimeout(() => {
          if (Date.now() - lastTapTime > 300) {
            tapCount = 0;
          }
        }, 300);
      }
    };

    viewportElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewportElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewportElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    viewportElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Return cleanup function
    return () => {
      viewportElement.removeEventListener('touchstart', handleTouchStart);
      viewportElement.removeEventListener('touchmove', handleTouchMove);
      viewportElement.removeEventListener('touchend', handleTouchEnd);
      viewportElement.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [getViewport]);

  // Initialize a viewport
  const initializeViewport = useCallback((viewportId: string): boolean => {
    if (!renderingEngineRef.current) return false;
    
    const viewportElement = viewportRefs.current[viewportId];
    if (!viewportElement) return false;
    
    try {
      // Check if viewport already exists
      const existingViewport = renderingEngineRef.current.getViewport(viewportId);
      if (existingViewport) {
        // Viewport exists, ensure tool group is set up
        const toolGroupId = `toolGroup-${viewportId}`;
        if (!toolGroupsRef.current[viewportId]) {
          let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          if (!toolGroup) {
            toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
            if (toolGroup) {
              toolGroup.addTool(PanTool.toolName);
              toolGroup.addTool(ZoomTool.toolName);
              toolGroup.addTool(StackScrollTool.toolName);
          // Don't add WindowLevelTool - it's disabled (contrast via slider only)
              toolGroup.addViewport(viewportId, 'myRenderingEngine');
              toolGroupsRef.current[viewportId] = toolGroup;
              
          // Enable pan, zoom and scroll
              toolGroup.setToolActive(PanTool.toolName, {
                bindings: [{ mouseButton: toolEnums.MouseBindings.Auxiliary }],
              });
              toolGroup.setToolActive(ZoomTool.toolName, {
                bindings: [
                  { mouseButton: toolEnums.MouseBindings.Secondary },
                  { mouseButton: toolEnums.MouseBindings.Wheel },
                ],
              });
              toolGroup.setToolActive(StackScrollTool.toolName, {
                bindings: [{ mouseButton: toolEnums.MouseBindings.Wheel }],
              });
            }
          } else {
            toolGroupsRef.current[viewportId] = toolGroup;
          }
        }
        return true; // Already initialized
      }
      
      // Initialize new viewport
      const viewportInput = {
        viewportId,
        element: viewportElement,
        type: cornerstone.Enums.ViewportType.STACK,
      };
      renderingEngineRef.current.enableElement(viewportInput);
      
      // Create tool group
      const toolGroupId = `toolGroup-${viewportId}`;
      let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      
      if (!toolGroup) {
        toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addTool(ZoomTool.toolName);
          toolGroup.addTool(StackScrollTool.toolName);
          // Don't add WindowLevelTool or PanTool - they're disabled
          toolGroup.addViewport(viewportId, 'myRenderingEngine');
          toolGroupsRef.current[viewportId] = toolGroup;
          
          // Activate tools
          toolGroup.setToolActive(WindowLevelTool.toolName, {
            bindings: [{ mouseButton: toolEnums.MouseBindings.Primary }],
          });
          toolGroup.setToolActive(PanTool.toolName, {
            bindings: [{ mouseButton: toolEnums.MouseBindings.Auxiliary }],
          });
          toolGroup.setToolActive(ZoomTool.toolName, {
            bindings: [
              { mouseButton: toolEnums.MouseBindings.Secondary },
              { mouseButton: toolEnums.MouseBindings.Wheel },
            ],
          });
          toolGroup.setToolActive(StackScrollTool.toolName, {
            bindings: [{ mouseButton: toolEnums.MouseBindings.Wheel }],
          });
          
          viewportElement.style.pointerEvents = 'auto';
          viewportElement.style.touchAction = 'none';
          
          // Setup pinch-to-zoom for mobile
          setupPinchToZoom(viewportId, viewportElement);
        }
      } else {
        toolGroupsRef.current[viewportId] = toolGroup;
      }
      
      return true;
    } catch (error) {
      console.warn(`Viewport ${viewportId} initialization error:`, error);
      return false;
    }
  }, [setupPinchToZoom]);

  // Handle window resize for mobile detection and viewport updates
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
      
      // Resize all viewports when window size changes
      if (renderingEngineRef.current) {
        setTimeout(() => {
          try {
            renderingEngineRef.current?.resize();
          } catch (err) {
            console.warn('Error resizing viewports:', err);
          }
        }, 100);
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  /**
   * Discover all series from /dicoms subfolders
   */
  const discoverSeries = async (): Promise<Series[]> => {
    try {
      try {
        const manifestResponse = await fetch('/dicoms/manifest.json');
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          if (manifest.series && Array.isArray(manifest.series) && manifest.series.length > 0) {
            console.log(`✓ Found ${manifest.series.length} series from manifest.json`);
            return manifest.series.map((s: any) => ({
              seriesId: s.seriesId,
              imageIds: s.imageIds || [],
              instanceCount: s.imageIds?.length || 0
            }));
          }
        }
      } catch (e) {
        console.log('Manifest.json not available, using directory listing...');
      }

      const dirResponse = await fetch('/dicoms/');
      if (!dirResponse.ok) {
        throw new Error('Could not access /dicoms directory');
      }

      const text = await dirResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const links = doc.querySelectorAll('a[href]');
      
      const series: Series[] = [];
      
      const rootDcmLinks = doc.querySelectorAll('a[href$=".dcm"]');
      if (rootDcmLinks.length > 0) {
        const rootImageIds = Array.from(rootDcmLinks).map(link => {
          const href = link.getAttribute('href') || '';
          let fileName = href;
          if (href.startsWith('/dicoms/')) {
            fileName = href.replace('/dicoms/', '');
          } else if (href.startsWith('/')) {
            fileName = href.substring(1);
          }
          return `wadouri:/dicoms/${fileName}`;
        });
        
        if (rootImageIds.length > 0) {
          series.push({
            seriesId: 'root',
            imageIds: rootImageIds,
            instanceCount: rootImageIds.length
          });
        }
      }
      
      for (const link of Array.from(links)) {
        const href = link.getAttribute('href');
        if (!href) continue;
        
        if (href.endsWith('/') && href !== '/' && href !== '/dicoms/') {
          let seriesId = href.replace(/\/$/, '');
          
          if (seriesId.startsWith('/dicoms/')) {
            seriesId = seriesId.replace(/^\/dicoms\//, '');
          } else if (seriesId.startsWith('/')) {
            seriesId = seriesId.substring(1);
          }
          
          if (!seriesId || seriesId.includes('/')) {
            continue;
          }
          
          try {
            const seriesUrl = `/dicoms/${encodeURIComponent(seriesId)}/`;
            const seriesResponse = await fetch(seriesUrl);
            
            if (seriesResponse.ok) {
              const seriesText = await seriesResponse.text();
              const seriesDoc = parser.parseFromString(seriesText, 'text/html');
              const fileLinks = seriesDoc.querySelectorAll('a[href$=".dcm"]');
              
              const imageIds = Array.from(fileLinks).map(link => {
                const fileHref = link.getAttribute('href') || '';
                let fileName = fileHref;
                
                if (fileHref.startsWith('/dicoms/')) {
                  const pathParts = fileHref.split('/');
                  const seriesIndex = pathParts.indexOf(seriesId);
                  if (seriesIndex >= 0 && seriesIndex < pathParts.length - 1) {
                    fileName = pathParts.slice(seriesIndex + 1).join('/');
                  } else {
                    fileName = fileHref.replace(`/dicoms/${seriesId}/`, '');
                  }
                } else if (fileHref.startsWith('/')) {
                  fileName = fileHref.substring(1);
                } else {
                  fileName = fileHref.split('/').pop() || fileHref;
                }
                
                return `wadouri:/dicoms/${seriesId}/${fileName}`;
              });

              if (imageIds.length > 0) {
                series.push({
                  seriesId,
                  imageIds,
                  instanceCount: imageIds.length
                });
              }
            }
          } catch (e) {
            console.error(`Error loading series ${seriesId}:`, e);
          }
        }
      }

      return series;
    } catch (error) {
      console.error('Error discovering series:', error);
      throw error;
    }
  };

  /**
   * Sort imageIds by InstanceNumber or ImagePositionPatient[2]
   */
  const sortImageIds = async (imageIds: string[]): Promise<string[]> => {
    if (imageIds.length === 0) return imageIds;

    try {
      const imageMetadata = await Promise.all(
        imageIds.map(async (imageId, index) => {
          try {
            const image = await cornerstone.imageLoader.loadImage(imageId);
            const metadata = (image as any).data || {};
            
            let sortValue: number | null = null;
            
            if (metadata.instanceNumber !== undefined && metadata.instanceNumber !== null) {
              sortValue = Number(metadata.instanceNumber);
            } else if (metadata.imagePositionPatient && Array.isArray(metadata.imagePositionPatient) && metadata.imagePositionPatient.length >= 3) {
              sortValue = Number(metadata.imagePositionPatient[2]);
            } else {
              sortValue = index;
            }

            if (isNaN(sortValue) || sortValue === null) {
              sortValue = index;
            }

            return { imageId, sortValue };
          } catch (err) {
            return { imageId, sortValue: index };
          }
        })
      );

      imageMetadata.sort((a, b) => {
        if (a.sortValue === null && b.sortValue === null) return 0;
        if (a.sortValue === null) return 1;
        if (b.sortValue === null) return -1;
        return a.sortValue - b.sortValue;
      });

      return imageMetadata.map(m => m.imageId);
    } catch (error) {
      console.warn('Error sorting images, using original order:', error);
      return imageIds;
    }
  };

  /**
   * Apply transformations to viewport
   */
  const applyTransformations = useCallback((viewportId: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    const transforms = getTransformations(viewportId);

    try {
      const viewportElement = viewport.element;
      if (viewportElement) {
        const canvas = viewportElement.querySelector('canvas');
        if (canvas) {
          // Build transform string with proper order
          // CSS transforms are applied right-to-left, so we need to reverse the order
          // We want: rotate first, then flip (so we put flip first in the array)
          const transformsArray: string[] = [];
          
          // Rotation first (will be applied last due to CSS right-to-left order)
          if (transforms.rotation !== 0) {
            transformsArray.push(`rotate(${transforms.rotation}deg)`);
          }
          
          // Flips second (will be applied first due to CSS right-to-left order)
          if (transforms.flipHorizontal) {
            transformsArray.push('scaleX(-1)');
          }
          if (transforms.flipVertical) {
            transformsArray.push('scaleY(-1)');
          }
          
          const transform = transformsArray.length > 0 ? transformsArray.join(' ') : 'none';
          canvas.style.transform = transform;
          canvas.style.transformOrigin = 'center center';
          
          // Apply contrast and invert filter
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

  /**
   * Load a series into viewports
   */
  const loadSeries = async (series: Series, viewportIds?: string[]) => {
    const targetViewports = viewportIds || Array.from({ length: paneLayout }, (_, i) => `viewport-${i + 1}`);
    
    if (targetViewports.length === 0) {
      console.error('No viewports available');
      return;
    }

    // Ensure all target viewports are initialized
    for (const viewportId of targetViewports) {
      if (!getViewport(viewportId)) {
        const initialized = initializeViewport(viewportId);
        if (!initialized) {
          console.warn(`Failed to initialize viewport ${viewportId}`);
        }
      }
    }

    const firstViewport = getViewport(targetViewports[0]);
    if (!firstViewport) {
      console.error('Viewport not available after initialization attempt');
      return;
    }

    try {
      setStatus(`Loading series: ${series.seriesId}...`);
      
      const sortedImageIds = await sortImageIds(series.imageIds);
      
      if (sortedImageIds.length === 0) {
        throw new Error(`No images found in series ${series.seriesId}`);
      }

      setStatus(`Rendering ${sortedImageIds.length} images...`);
      
      // Load first image to get window/level
      try {
        const firstImage = await cornerstone.imageLoader.loadImage(sortedImageIds[0]);
        const metadata = (firstImage as any).data || {};
        if (metadata.windowWidth && metadata.windowCenter) {
          setWindowWidth(metadata.windowWidth);
          setWindowCenter(metadata.windowCenter);
        } else {
          setWindowWidth(400);
          setWindowCenter(50);
        }
      } catch (err) {
        setWindowWidth(400);
        setWindowCenter(50);
      }
      
      // Load series into all target viewports
      for (const viewportId of targetViewports) {
        const vp = getViewport(viewportId);
        if (!vp) continue;

        const toolGroup = toolGroupsRef.current[viewportId];
        if (toolGroup) {
          try {
            toolGroup.setToolPassive(WindowLevelTool.toolName);
            toolGroup.setToolPassive(PanTool.toolName);
            toolGroup.setToolPassive(ZoomTool.toolName);
            toolGroup.setToolPassive(StackScrollTool.toolName);
          } catch (err) {
            // Ignore
          }
        }
        
        await vp.setStack(sortedImageIds);
        vp.resetCamera();
        
        // Store the fit parallel scale (this is the maximum zoom-out limit)
        // Wait a bit for camera to settle after reset
        setTimeout(() => {
          try {
            const camera = vp.getCamera();
            if (camera && camera.parallelScale) {
              fitParallelScaleRef.current[viewportId] = camera.parallelScale;
            }
          } catch (err) {
            console.warn('Error storing fit scale:', err);
          }
        }, 100);
        
        // Reset transformations for this viewport
        updateTransformations(viewportId, {
          rotation: 0,
          flipHorizontal: false,
          flipVertical: false,
          inverted: false,
          contrast: 1.0,
        });
        
        if (toolGroup) {
          try {
            // Disable Window/Level tool - Contrast is controlled via slider only
            toolGroup.setToolPassive(WindowLevelTool.toolName);
            
            // Enable Pan tool for moving around when zoomed
            toolGroup.setToolActive(PanTool.toolName, {
              bindings: [{ mouseButton: toolEnums.MouseBindings.Auxiliary }],
            });
            
            // Enable zoom and scroll
            toolGroup.setToolActive(ZoomTool.toolName, {
              bindings: [
                { mouseButton: toolEnums.MouseBindings.Secondary },
                { mouseButton: toolEnums.MouseBindings.Wheel },
              ],
            });
            toolGroup.setToolActive(StackScrollTool.toolName, {
              bindings: [{ mouseButton: toolEnums.MouseBindings.Wheel }],
            });
            
            // Ensure viewport element can receive events
            const viewportElement = vp.element;
            if (viewportElement) {
              viewportElement.style.pointerEvents = 'auto';
              viewportElement.style.touchAction = 'none';
              
              // Setup enhanced pinch-to-zoom and pan for mobile
              setupPinchToZoom(viewportId, viewportElement);
              
              // Resize viewport after loading
              setTimeout(() => {
                if (renderingEngineRef.current) {
                  try {
                    renderingEngineRef.current.resize();
                  } catch (err) {
                    console.warn('Error resizing after load:', err);
                  }
                }
              }, 100);
            }
          } catch (err) {
            console.warn('Could not activate tools:', err);
          }
        }
        
        applyTransformations(viewportId);
      }
      
      // Update image count and index for the active viewport
      if (targetViewports.includes(activeViewportId)) {
        setCurrentImageIndex(0);
        setTotalImages(sortedImageIds.length);
      }
      loadedSeriesRef.current = series;
      
      setStatus('');
    } catch (error) {
      console.error('Error loading series:', error);
      setError(error instanceof Error ? error.message : 'Failed to load series');
      setStatus('');
    }
  };

  /**
   * Handle series selection - loads into active viewport
   */
  const handleSeriesSelect = async (seriesId: string, viewportId?: string) => {
    const targetViewport = viewportId || activeViewportId;
    
    const series = seriesList.find(s => s.seriesId === seriesId);
    if (!series) {
      console.error(`Series ${seriesId} not found`);
      return;
    }

    setSelectedSeriesId(seriesId);
    setError(null);
    
    // Auto-set orientation based on series
    const seriesOrientation = getSeriesOrientation(seriesId);
    if (seriesOrientation) {
      setOrientation(seriesOrientation);
    }
    
    // Load into specific viewport
    await loadSeries(series, [targetViewport]);
  };

  /**
   * Handle stack navigation
   */
  const handleStackScroll = useCallback((direction: 'next' | 'prev', viewportId?: string) => {
    const viewport = getViewport(viewportId);
    if (!viewport) return;

    try {
      const currentIndex = viewport.getCurrentImageIdIndex();
      const imageIds = viewport.getImageIds();
      if (!imageIds || imageIds.length === 0) return;

      let newIndex = currentIndex;
      if (direction === 'next' && currentIndex < imageIds.length - 1) {
        newIndex = currentIndex + 1;
      } else if (direction === 'prev' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        viewport.setImageIdIndex(newIndex).then(() => {
          if (!viewportId || viewportId === activeViewportId) {
            setCurrentImageIndex(newIndex);
          }
          applyTransformations(viewportId || activeViewportId);
        }).catch((error) => {
          console.error('Error setting image index:', error);
        });
      }
    } catch (error) {
      console.error('Error in handleStackScroll:', error);
    }
  }, [getViewport, activeViewportId, applyTransformations]);


  /**
   * Rotate controls - Fixed: ccw rotates counter-clockwise, cw rotates clockwise
   */
  const handleRotate = useCallback((direction: 'cw' | 'ccw', viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    // Fixed: ccw = counter-clockwise (-90), cw = clockwise (+90)
    const angle = direction === 'ccw' ? -90 : 90;
    const current = getTransformations(vpId);
    // Calculate new rotation, ensuring it's in the range [0, 360)
    let newRotation = current.rotation + angle;
    // Normalize to [0, 360) range
    newRotation = ((newRotation % 360) + 360) % 360;
    updateTransformations(vpId, {
      rotation: newRotation,
    });
    // Apply immediately without delay
      applyTransformations(vpId);
  }, [activeViewportId, getTransformations, updateTransformations, applyTransformations]);

  /**
   * Flip controls - Fixed: horizontal flips horizontally, vertical flips vertically
   */
  const handleFlip = useCallback((direction: 'horizontal' | 'vertical', viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const current = getTransformations(vpId);
    // Fixed: horizontal flips horizontally (scaleX), vertical flips vertically (scaleY)
    if (direction === 'horizontal') {
      updateTransformations(vpId, { flipHorizontal: !current.flipHorizontal });
    } else {
      updateTransformations(vpId, { flipVertical: !current.flipVertical });
    }
    // Apply immediately without delay
      applyTransformations(vpId);
  }, [activeViewportId, getTransformations, updateTransformations, applyTransformations]);

  /**
   * Invert control - Apply immediately
   */
  const handleInvert = useCallback((viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const current = getTransformations(vpId);
    updateTransformations(vpId, { inverted: !current.inverted });
    // Apply immediately
      applyTransformations(vpId);
  }, [activeViewportId, getTransformations, updateTransformations, applyTransformations]);

  /**
   * Contrast control - Apply immediately
   */
  const handleContrastChange = useCallback((value: number, viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    updateTransformations(vpId, { contrast: value });
    // Apply immediately for responsive feedback
      applyTransformations(vpId);
  }, [activeViewportId, updateTransformations, applyTransformations]);

  /**
   * Reset view - Reloads the current image from the series
   */
  const handleReset = useCallback(async (viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const viewport = getViewport(vpId);
    if (viewport && viewport.getImageIds().length > 0) {
      // Get current series and reload it
      const currentSeries = loadedSeriesRef.current;
      if (currentSeries) {
        // Reload the series to reset everything
        await loadSeries(currentSeries, [vpId]);
      } else {
        // Fallback: reset camera and transformations
      viewport.resetCamera();
        // Update fit scale after reset
        const resetCamera = viewport.getCamera();
        fitParallelScaleRef.current[vpId] = resetCamera.parallelScale ?? 1;
      updateTransformations(vpId, {
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
        inverted: false,
        contrast: 1.0,
      });
        applyTransformations(vpId);
    }
    }
  }, [activeViewportId, getViewport, updateTransformations, applyTransformations, loadSeries]);

  /**
   * Cine playback - Per viewport
   */
  const handleCineToggle = useCallback((viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const isPlaying = isCinePlaying[vpId] || false;
    
    // Stop cine if playing
    if (isPlaying) {
      if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
        window.clearInterval(cineIntervalRef.current[vpId]!);
        cineIntervalRef.current[vpId] = null;
      }
      setIsCinePlaying(prev => ({
        ...prev,
        [vpId]: false,
      }));
      return;
    }
    
    // Start cine
    const viewport = getViewport(vpId);
    if (!viewport) return;
    
    const imageIds = viewport.getImageIds();
    if (!imageIds || imageIds.length <= 1) return;
    
    setIsCinePlaying(prev => ({
      ...prev,
      [vpId]: true,
    }));
    
    const interval = window.setInterval(() => {
      const currentViewport = getViewport(vpId);
      if (!currentViewport) {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
        return;
      }
      
      const currentIndex = currentViewport.getCurrentImageIdIndex();
      const currentImageIds = currentViewport.getImageIds();
      if (!currentImageIds || currentImageIds.length === 0) {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
        return;
      }
      
      const nextIndex = (currentIndex + 1) % currentImageIds.length;
      currentViewport.setImageIdIndex(nextIndex).then(() => {
        if (vpId === activeViewportId) {
          setCurrentImageIndex(nextIndex);
        }
        applyTransformations(vpId);
      }).catch(() => {
        if (cineIntervalRef.current[vpId] !== null && cineIntervalRef.current[vpId] !== undefined) {
          window.clearInterval(cineIntervalRef.current[vpId]!);
          cineIntervalRef.current[vpId] = null;
        }
        setIsCinePlaying(prev => ({
          ...prev,
          [vpId]: false,
        }));
      });
    }, 1000 / cineSpeed);
    
    cineIntervalRef.current[vpId] = interval;
  }, [isCinePlaying, getViewport, activeViewportId, applyTransformations, cineSpeed]);

  // Update transformations when state changes
  useEffect(() => {
    applyTransformations(activeViewportId);
  }, [transformations, activeViewportId, applyTransformations]);

  // Cleanup cine on unmount
  useEffect(() => {
    return () => {
      Object.values(cineIntervalRef.current).forEach(interval => {
        if (interval !== null && interval !== undefined) {
          window.clearInterval(interval);
        }
      });
      cineIntervalRef.current = {};
    };
  }, []);

  /**
   * Initialize Cornerstone and discover series
   */
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        init();
        initTools();

        // Add pan, zoom and scroll tools - window/level is disabled (contrast via slider)
        addTool(PanTool);
        addTool(ZoomTool);
        addTool(StackScrollTool);
        console.log('✓ Tools registered');

        dicomImageLoader.init({
          maxWebWorkers: navigator.hardwareConcurrency || 4,
          strict: false,
        });
        console.log('✓ DICOM loader initialized');

        const renderingEngineId = 'myRenderingEngine';
        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Create viewports
        const viewportIds: string[] = [];
        for (let i = 1; i <= 4; i++) {
          const viewportId = `viewport-${i}`;
          viewportIds.push(viewportId);
          
          const viewportElement = viewportRefs.current[viewportId];
          if (viewportElement) {
            const viewportInput = {
              viewportId,
              element: viewportElement,
              type: cornerstone.Enums.ViewportType.STACK,
            };
            renderingEngine.enableElement(viewportInput);
            
            // Create individual tool group for each viewport
            const toolGroupId = `toolGroup-${viewportId}`;
            const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
            if (existingToolGroup) {
              ToolGroupManager.destroyToolGroup(toolGroupId);
            }
            
            const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
            if (toolGroup) {
              toolGroup.addTool(ZoomTool.toolName);
              toolGroup.addTool(StackScrollTool.toolName);
              // Don't add WindowLevelTool or PanTool - they're disabled
              toolGroup.addViewport(viewportId, renderingEngineId);
              toolGroupsRef.current[viewportId] = toolGroup;
              
              // Ensure viewport element can receive events
              if (viewportElement) {
                viewportElement.style.pointerEvents = 'auto';
                viewportElement.style.touchAction = 'none';
                
                // Setup pinch-to-zoom for mobile (without panning)
                setupPinchToZoom(viewportId, viewportElement);
              }
            }
          }
        }

        console.log('✓ Tool groups created and viewports added');

        if (isMounted) {
          setStatus('Discovering series...');
          const discoveredSeries = await discoverSeries();
          
          if (isMounted) {
            setSeriesList(discoveredSeries);
            
            if (discoveredSeries.length === 0) {
              setError('No DICOM series found. Please ensure /dicoms contains .dcm files.');
              setStatus('');
            } else {
              setStatus('');
              // Load Acquisition (series-00000) by default
              const acquisitionSeries = discoveredSeries.find(s => 
                s.seriesId === 'series-00000' || s.seriesId.includes('series-00000')
              ) || discoveredSeries[0];
              await handleSeriesSelect(acquisitionSeries.seriesId);
            }
          }
        }
      } catch (error) {
        console.error('Initialization error:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'Initialization failed');
          setStatus('');
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      // Cleanup all cine intervals
      Object.values(cineIntervalRef.current).forEach(interval => {
        if (interval !== null && interval !== undefined) {
          window.clearInterval(interval);
        }
      });
      cineIntervalRef.current = {};
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
      Object.values(toolGroupsRef.current).forEach(toolGroup => {
        if (toolGroup) {
          const toolGroupId = Object.keys(toolGroupsRef.current).find(
            key => toolGroupsRef.current[key] === toolGroup
          );
          if (toolGroupId) {
            ToolGroupManager.destroyToolGroup(`toolGroup-${toolGroupId}`);
          }
        }
      });
    };
  }, []);

  // Initialize viewports when refs are ready or paneLayout changes
  useEffect(() => {
    if (!renderingEngineRef.current) return;
    
    const initializeViewports = () => {
      for (let i = 1; i <= 4; i++) {
        const viewportId = `viewport-${i}`;
        initializeViewport(viewportId);
      }
      
      // Resize all viewports after initialization
      setTimeout(() => {
        if (renderingEngineRef.current) {
          try {
            renderingEngineRef.current.resize();
          } catch (err) {
            console.warn('Error resizing viewports:', err);
          }
        }
      }, 150);
    };
    
    // Initialize after a short delay to ensure refs are set
    const timeout = setTimeout(initializeViewports, 100);
    return () => clearTimeout(timeout);
  }, [paneLayout, initializeViewport]);
  

  // Update pane layout
  useEffect(() => {
    const maxViewport = parseInt(activeViewportId.split('-')[1]);
    if (maxViewport > paneLayout) {
      setActiveViewportId('viewport-1');
    }
  }, [paneLayout, activeViewportId]);

  // Get grid layout class - optimized for mobile
  const getGridClass = useMemo(() => {
    if (isMobile) {
      // Mobile: Always vertical stack for better visibility
    switch (paneLayout) {
      case 1: return 'grid-cols-1 grid-rows-1';
        case 2: return 'grid-cols-1 grid-rows-2';
        case 3: return 'grid-cols-1 grid-rows-3';
        case 4: return 'grid-cols-1 grid-rows-4';
      default: return 'grid-cols-1 grid-rows-1';
    }
    } else {
      // Desktop: Use grid layout
      switch (paneLayout) {
        case 1: return 'grid-cols-1 grid-rows-1';
        case 2: return 'grid-cols-2 grid-rows-1';
        case 3: return 'grid-cols-2 grid-rows-2';
        case 4: return 'grid-cols-2 grid-rows-2';
        default: return 'grid-cols-1 grid-rows-1';
      }
    }
  }, [paneLayout, isMobile]);

  // Get active viewport image count dynamically
  const getActiveViewportImageCount = useCallback(() => {
    const viewport = getViewport(activeViewportId);
    if (!viewport) return 0;
    try {
      const imageIds = viewport.getImageIds();
      return imageIds ? imageIds.length : 0;
    } catch {
      return 0;
    }
  }, [activeViewportId, getViewport]);

  const activeViewportImageCount = getActiveViewportImageCount();
  const isMultiStack = activeViewportImageCount > 1;
  const activeTransforms = getTransformations(activeViewportId);


  return (
    <div 
      className="w-full h-screen flex bg-gray-900 text-white overflow-hidden"
      style={{
        height: '100dvh', // Dynamic viewport height for mobile
        paddingTop: isMobile ? 'env(safe-area-inset-top)' : '0',
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : '0',
      }}
    >
      {/* Mobile Menu Button - Pictures icon, bottom rounded blue, above settings button, stacked above play button - Hidden when sidebar or bottom panel is open */}
      {isMobile && !sidebarOpen && !bottomPanelOpen && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg active:bg-blue-700 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation md:hidden"
          style={{ 
            touchAction: 'manipulation',
            bottom: `calc(env(safe-area-inset-bottom) + 8.5rem)`, // Above settings button with proper spacing
            right: `calc(env(safe-area-inset-right) + 1rem)`, // Proper margin from edge
          }}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      )}

      {/* Mobile Sidebar - Completely separate, overlays viewport */}
      {isMobile && (
        <>
          {/* Backdrop overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setSidebarOpen(false)}
              style={{
                top: 'env(safe-area-inset-top)',
                bottom: 'env(safe-area-inset-bottom)',
              }}
            />
          )}
          
          {/* Sidebar */}
          <div 
            className={`fixed ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} z-[70] w-64 bg-gray-800 border-r border-gray-700 flex flex-col transition-transform duration-300 ease-in-out h-full shadow-2xl`}
            style={{
              height: '100dvh',
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              top: 0,
              left: 0,
            }}
          >
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">DICOM Series</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {seriesList.length} series found
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-gray-400 hover:text-white"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {seriesList.length === 0 ? (
                <div className="p-4 text-sm text-gray-400">
                  {status || 'No series available'}
                </div>
              ) : (
                <div className="p-2">
                  {seriesList.map((series) => {
                    const seriesOrientation = getSeriesOrientation(series.seriesId);
                    return (
                      <button
                        key={series.seriesId}
                        onClick={() => {
                          handleSeriesSelect(series.seriesId);
                          setSidebarOpen(false);
                        }}
                        className={`w-full text-left p-3 mb-2 rounded transition-colors ${
                          selectedSeriesId === series.seriesId
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className="font-semibold text-sm truncate">
                          {series.seriesName || series.seriesId}
                          {seriesOrientation && (
                            <span className="ml-2 text-xs opacity-75">({seriesOrientation})</span>
                          )}
                        </div>
                        <div className="text-xs mt-1 opacity-75">
                          {series.instanceCount} image{series.instanceCount !== 1 ? 's' : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar - Part of flex layout */}
      {!isMobile && (
        <div className="relative z-40 w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">DICOM Series</h2>
              <p className="text-xs text-gray-400 mt-1">
                {seriesList.length} series found
              </p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {seriesList.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">
                {status || 'No series available'}
              </div>
            ) : (
              <div className="p-2">
                {seriesList.map((series) => {
                  const seriesOrientation = getSeriesOrientation(series.seriesId);
                  return (
                    <button
                      key={series.seriesId}
                      onClick={() => {
                        handleSeriesSelect(series.seriesId);
                      }}
                      className={`w-full text-left p-3 mb-2 rounded transition-colors ${
                        selectedSeriesId === series.seriesId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-semibold text-sm truncate">
                        {series.seriesName || series.seriesId}
                        {seriesOrientation && (
                          <span className="ml-2 text-xs opacity-75">({seriesOrientation})</span>
                        )}
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {series.instanceCount} image{series.instanceCount !== 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area - Full width on mobile, flex-1 on desktop */}
      <div 
        className={`${isMobile ? 'w-full' : 'flex-1'} flex flex-col overflow-hidden`}
        style={{
          width: isMobile ? '100%' : '100%',
          height: '100%',
        }}
      >
        {/* Top Toolbar - Desktop */}
        {(
        <div className="hidden md:block bg-gray-800 border-b border-gray-700 p-2 md:p-3">
          <div className="flex flex-col gap-2">
            {/* First Row - Main Controls */}
          <div className="flex flex-wrap gap-1 md:gap-2 items-center text-xs md:text-sm">
            {/* Rotate Controls - Icons swapped correctly */}
            <div className="flex gap-1 border-r border-gray-600 pr-1 md:pr-2">
              <button
                onClick={() => handleRotate('ccw')}
                className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                title="Rotate Counter-Clockwise"
              >
                ↺
              </button>
              <button
                onClick={() => handleRotate('cw')}
                className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                title="Rotate Clockwise"
              >
                ↻
              </button>
            </div>

            {/* Flip Controls */}
            <div className="flex gap-1 border-r border-gray-600 pr-1 md:pr-2">
              <button
                onClick={() => handleFlip('horizontal')}
                className={`px-2 py-1 rounded ${
                  activeTransforms.flipHorizontal ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Flip Horizontal"
              >
                ⇄
              </button>
              <button
                onClick={() => handleFlip('vertical')}
                className={`px-2 py-1 rounded ${
                  activeTransforms.flipVertical ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Flip Vertical"
              >
                ⇅
              </button>
            </div>

            {/* Contrast Control - Material UI Slider */}
            <div className="flex items-center gap-2 border-r border-gray-600 pr-1 md:pr-2">
              <span className="text-gray-400 hidden md:inline text-xs">Contrast:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 md:w-32">
                  <WhiteSlider
                value={activeTransforms.contrast || 1.0}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    onChange={(_e, value) => {
                      handleContrastChange(value as number);
                    }}
                    size="small"
                  />
                </div>
                <span className="text-gray-300 w-10 text-xs font-semibold bg-gray-700 px-2 py-1 rounded">
                  {(activeTransforms.contrast || 1.0).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Invert Control */}
            <div className="border-r border-gray-600 pr-1 md:pr-2">
              <button
                onClick={() => handleInvert()}
                className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm ${
                  activeTransforms.inverted ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title="Invert Colors"
              >
                Inv
              </button>
            </div>

            {/* Multi-Stack Features */}
            {isMultiStack && (
              <>
                {/* Orientation Selector */}
                <div className="flex gap-1 border-r border-gray-600 pr-1 md:pr-2">
                  <select
                    value={orientation}
                    onChange={async (e) => {
                      const newOrientation = e.target.value as Orientation;
                      setOrientation(newOrientation);
                      
                      // Load the series for this orientation into active viewport
                      const series = getSeriesByOrientation(newOrientation);
                      if (series) {
                        await handleSeriesSelect(series.seriesId, activeViewportId);
                      }
                    }}
                    className="px-1 md:px-2 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 border border-gray-600"
                  >
                    <option value="Acquisition">Acquisition</option>
                    <option value="Axial">Axial</option>
                    <option value="Sagittal">Sagittal</option>
                    <option value="Coronal">Coronal</option>
                  </select>
                </div>

                 {/* Cine Control */}
                 <div className="border-r border-gray-600 pr-1 md:pr-2">
                   <button
                     onClick={() => handleCineToggle(activeViewportId)}
                     className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm ${
                       isCinePlaying[activeViewportId] ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                     }`}
                     title="Cine Playback"
                   >
                     {isCinePlaying[activeViewportId] ? '⏸' : '▶'}
                   </button>
                 </div>
              </>
            )}

            {/* Reset */}
            <div>
              <button
                onClick={() => handleReset()}
                className="px-2 md:px-3 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
                title="Reset View"
              >
                Reset
              </button>
            </div>
            </div>

            {/* Second Row - Multipane View on New Line */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-600">
              <div className="flex gap-1">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setPaneLayout(num as PaneLayout)}
                    className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm ${
                    paneLayout === num
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={`${num} Pane${num > 1 ? 's' : ''}`}
                >
                  {num}
                </button>
              ))}
            </div>
            </div>

            {/* Navigation */}
            {activeViewportImageCount > 1 && (() => {
              const viewport = getViewport(activeViewportId);
              const currentIdx = viewport ? viewport.getCurrentImageIdIndex() : currentImageIndex;
              return (
                <div className="flex items-center gap-1 md:gap-2 ml-auto">
                  <button
                    onClick={() => handleStackScroll('prev')}
                    disabled={currentIdx === 0}
                    className="px-1 md:px-2 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous"
                  >
                    ◀
                  </button>
                  <span className="text-xs md:text-sm text-gray-300 min-w-[60px] md:min-w-[80px] text-center">
                    {currentIdx + 1} / {activeViewportImageCount}
                  </span>
                  <button
                    onClick={() => handleStackScroll('next')}
                    disabled={currentIdx >= activeViewportImageCount - 1}
                    className="px-1 md:px-2 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next"
                  >
                    ▶
                  </button>
                </div>
              );
            })()}

            {/* Status */}
            {status && (
              <div className="ml-auto text-xs md:text-sm text-blue-400">
                {status}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-2 p-2 bg-red-900/50 border border-red-500 rounded text-red-200 text-xs md:text-sm">
              {error}
            </div>
          )}
        </div>
        )}

        {/* Viewport Grid */}
        <div 
          className={`flex-1 bg-black grid ${getGridClass} overflow-hidden p-2 md:p-4 gap-2 md:gap-4`}
          style={{
            height: isMobile && bottomPanelOpen 
              ? `calc(100vh - 320px - env(safe-area-inset-bottom))`
              : '100%',
            minHeight: isMobile ? '0' : '300px',
          }}
        >
          {[1, 2, 3, 4].map((num) => {
            if (num > paneLayout) return null;
            const viewportId = `viewport-${num}`;
            const isActive = activeViewportId === viewportId;
            
            return (
              <div
                key={num}
                className={`relative bg-black border-2 rounded-lg overflow-hidden ${
                  isActive ? 'border-blue-500' : 'border-gray-700'
                }`}
                onClick={(e) => {
                  // Only set active if clicking on the container, not the canvas
                  if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('viewport-container')) {
                    setActiveViewportId(viewportId);
                  }
                }}
              >
                <div
                  ref={(el) => {
                    viewportRefs.current[viewportId] = el;
                    // Initialize viewport when ref is set
                    if (el && renderingEngineRef.current) {
                      setTimeout(() => {
                        initializeViewport(viewportId);
                        // Resize viewport after initialization
                        setTimeout(() => {
                          if (renderingEngineRef.current) {
                            try {
                              renderingEngineRef.current.resize();
                            } catch (err) {
                              console.warn('Error resizing viewport:', err);
                            }
                          }
                        }, 50);
                      }, 0);
                    }
                  }}
                  className="w-full h-full viewport-container"
                  style={{ 
                    touchAction: 'none', 
                    pointerEvents: 'auto',
                    minHeight: isMobile ? '200px' : '300px',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                  }}
                  onClick={(e) => {
                    // Prevent container click when clicking on viewport
                    e.stopPropagation();
                    setActiveViewportId(viewportId);
                  }}
                />
                {paneLayout > 1 && (
                  <>
                    <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white z-10 pointer-events-none"
                      style={{ 
                        top: '0.25rem',
                        left: '0.25rem',
                        maxWidth: 'calc(100% - 0.5rem)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Pane {num}
                    </div>
                    {isActive && (
                      <div className="absolute top-1 left-1 bg-blue-600/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-white z-10 pointer-events-none"
                        style={{ 
                          top: '2rem',
                          left: '0.25rem',
                          maxWidth: 'calc(100% - 0.5rem)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Active
                      </div>
                    )}
                  </>
                )}
                
                {/* Individual Cine Control per Pane */}
                {(() => {
                  const viewport = getViewport(viewportId);
                  const hasMultipleImages = viewport && viewport.getImageIds() && viewport.getImageIds().length > 1;
                  const paneIsPlaying = isCinePlaying[viewportId] || false;
                  
                  if (hasMultipleImages) {
                    return (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCineToggle(viewportId);
                        }}
                        className={`absolute bottom-2 right-2 z-20 p-2 rounded-lg shadow-lg backdrop-blur-sm touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center ${
                          paneIsPlaying 
                            ? 'bg-red-600/90 text-white hover:bg-red-700/90' 
                            : 'bg-gray-700/90 text-gray-300 hover:bg-gray-600/90'
                        }`}
                        style={{ touchAction: 'manipulation' }}
                        title={paneIsPlaying ? 'Pause Cine' : 'Play Cine'}
                      >
                        {paneIsPlaying ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>

        {/* Instructions - Desktop */}
        {(
        <div className="bg-gray-800 border-t border-gray-700 p-1 md:p-2 text-xs text-gray-400 text-center hidden md:block">
          Left Click: W/L | Middle: Pan | Right: Zoom | Wheel: Scroll | ↑↓: Navigate
        </div>
        )}

        {/* Toggle Button - Mobile - Shows when panel is hidden - Tool icon above play button in right corner */}
        {!bottomPanelOpen && isMobile && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBottomPanelOpen(true);
            }}
            className="fixed z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg active:bg-blue-700 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
            style={{ 
              touchAction: 'manipulation',
              bottom: `calc(env(safe-area-inset-bottom) + 4.5rem)`, // Above play button with proper spacing
              right: `calc(env(safe-area-inset-right) + 1rem)`, // Proper margin from edge
            }}
            aria-label="Show controls"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Bottom Toolbar - Mobile - Touch-Optimized */}
        {bottomPanelOpen && (
          <div 
            className="md:hidden bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 p-4 shadow-2xl overflow-y-auto max-h-[50vh]"
            style={{ 
              paddingBottom: `max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))`,
              paddingTop: '1rem',
            }}
          >
            {/* Toggle Button - Hide Panel */}
            <div className="flex justify-end mb-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBottomPanelOpen(false);
                }}
                className="p-2 text-gray-400 hover:text-white active:text-white rounded-lg touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                aria-label="Hide controls"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          <div className="flex flex-col gap-4">
            {/* Contrast Control - Material UI Slider - Large Touch Target */}
            <div className="flex items-center gap-3 w-full bg-gray-900/50 rounded-lg p-4">
              <label className="text-base font-semibold text-white min-w-[90px]">
                Contrast
              </label>
              <div className="flex-1 relative">
                <WhiteSliderMobile
                  value={activeTransforms.contrast || 1.0}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(_e, value) => {
                    handleContrastChange(value as number);
                  }}
                />
              </div>
              <span className="text-lg font-bold text-white min-w-[55px] text-right bg-blue-600/30 px-3 py-2 rounded-lg border border-blue-500/50">
                {activeTransforms.contrast.toFixed(1)}
              </span>
            </div>

            {/* Control Buttons Grid - Large Touch Targets */}
            <div className="grid grid-cols-4 gap-2">
              {/* Rotate Controls - Icons swapped correctly */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRotate('ccw');
                }}
                className="px-4 py-3 rounded-lg bg-gray-700 text-gray-300 active:bg-gray-600 text-lg font-medium min-h-[48px] flex items-center justify-center touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                title="Rotate Counter-Clockwise"
              >
                ↺
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRotate('cw');
                }}
                className="px-4 py-3 rounded-lg bg-gray-700 text-gray-300 active:bg-gray-600 text-lg font-medium min-h-[48px] flex items-center justify-center touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                title="Rotate Clockwise"
              >
                ↻
              </button>

              {/* Flip Controls */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFlip('horizontal');
                }}
                className={`px-4 py-3 rounded-lg text-lg font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                  activeTransforms.flipHorizontal ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                }`}
                style={{ touchAction: 'manipulation' }}
                title="Flip Horizontal"
              >
                ⇄
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFlip('vertical');
                }}
                className={`px-4 py-3 rounded-lg text-lg font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                  activeTransforms.flipVertical ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                }`}
                style={{ touchAction: 'manipulation' }}
                title="Flip Vertical"
              >
                ⇅
              </button>
            </div>

            {/* Second Row of Controls */}
            <div className="grid grid-cols-2 gap-2">
              {/* Invert Control */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleInvert();
                }}
                className={`px-4 py-3 rounded-lg text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                  activeTransforms.inverted ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                }`}
                style={{ touchAction: 'manipulation' }}
                title="Invert Colors"
              >
                Inv
              </button>

              {/* Reset */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReset();
                }}
                className="px-4 py-3 rounded-lg bg-gray-700 text-gray-300 active:bg-gray-600 text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation"
                style={{ touchAction: 'manipulation' }}
                title="Reset View"
              >
                Reset
              </button>
            </div>

            {/* Multipane View - On New Line */}
            <div className="w-full border-t border-gray-600 pt-3 mt-2">
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-1">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPaneLayout(num as PaneLayout);
                    }}
                      className={`flex-1 px-3 py-3 rounded-lg text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                      paneLayout === num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                    title={`${num} Pane${num > 1 ? 's' : ''}`}
                  >
                    {num}
                  </button>
                ))}
                </div>
              </div>
            </div>

            {/* Multi-Stack Features */}
            {isMultiStack && (
              <div className="grid grid-cols-2 gap-2">
                {/* Orientation Selector */}
                <select
                  value={orientation}
                  onChange={async (e) => {
                    const newOrientation = e.target.value as Orientation;
                    setOrientation(newOrientation);
                    
                    // Load the series for this orientation into active viewport
                    const series = getSeriesByOrientation(newOrientation);
                    if (series) {
                      await handleSeriesSelect(series.seriesId, activeViewportId);
                    }
                  }}
                  className="px-4 py-3 rounded-lg text-base bg-gray-700 text-gray-300 border border-gray-600 min-h-[48px]"
                >
                  <option value="Acquisition">Acquisition</option>
                  <option value="Axial">Axial</option>
                  <option value="Sagittal">Sagittal</option>
                  <option value="Coronal">Coronal</option>
                </select>

                 {/* Cine Control */}
                 <button
                   onClick={(e) => {
                     e.preventDefault();
                     e.stopPropagation();
                     handleCineToggle(activeViewportId);
                   }}
                   className={`px-4 py-3 rounded-lg text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                     isCinePlaying[activeViewportId] ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
                   }`}
                   style={{ touchAction: 'manipulation' }}
                   title="Cine Playback"
                 >
                   {isCinePlaying[activeViewportId] ? '⏸ Pause' : '▶ Play'}
                 </button>
              </div>
            )}

            {/* Navigation */}
            {activeViewportImageCount > 1 && (() => {
              const viewport = getViewport(activeViewportId);
              const currentIdx = viewport ? viewport.getCurrentImageIdIndex() : currentImageIndex;
              return (
                <div className="flex items-center gap-3 justify-center">
                  <button
                    onClick={(e) => {
                      if (currentIdx === 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleStackScroll('prev');
                    }}
                    disabled={currentIdx === 0}
                    className="px-6 py-3 rounded-lg text-lg font-medium bg-gray-700 text-gray-300 active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] min-w-[60px] flex items-center justify-center touch-manipulation"
                    style={{ touchAction: 'manipulation' }}
                    title="Previous"
                  >
                    ◀
                  </button>
                  <span className="text-base font-semibold text-gray-300 min-w-[80px] text-center">
                    {currentIdx + 1} / {activeViewportImageCount}
                  </span>
                  <button
                    onClick={(e) => {
                      if (currentIdx >= activeViewportImageCount - 1) return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleStackScroll('next');
                    }}
                    disabled={currentIdx >= activeViewportImageCount - 1}
                    className="px-6 py-3 rounded-lg text-lg font-medium bg-gray-700 text-gray-300 active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] min-w-[60px] flex items-center justify-center touch-manipulation"
                    style={{ touchAction: 'manipulation' }}
                    title="Next"
                  >
                    ▶
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Error Display - Mobile */}
          {error && (
            <div className="mt-3 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}