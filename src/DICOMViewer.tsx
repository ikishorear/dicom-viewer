import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

// Types and utilities
import type { Series, Orientation, PaneLayout } from './types';
import { discoverSeries } from './utils/seriesDiscovery';
import { sortImageIds } from './utils/imageSorting';
import { getSeriesOrientation } from './utils/orientationMapping';
import { setupPinchToZoom } from './utils/pinchToZoom';

// Hooks
import { useViewport } from './hooks/useViewport';
import { useTransformations } from './hooks/useTransformations';
import { useCine } from './hooks/useCine';

// Operations
import {
  useZoomOperations,
  usePanOperations,
  useContrastOperations,
  useFlipOperations,
  useRotateOperations,
  useViewOperations,
} from './operations';

// Components
import { Sidebar } from './components/Sidebar';
import { DesktopToolbar } from './components/DesktopToolbar';
import { MobileControls } from './components/MobileControls';
import { ViewportGrid } from './components/ViewportGrid';

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

/**
 * Production-ready DICOM Viewer Component
 * Refactored for better readability and maintainability
 */
export default function DICOMViewer() {
  // Refs
  const viewportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const renderingEngineRef = useRef<cornerstone.RenderingEngine | null>(null);
  const toolGroupsRef = useRef<{ [key: string]: ReturnType<typeof ToolGroupManager.createToolGroup> | null }>({});
  const loadedSeriesRef = useRef<Series | null>(null);
  const fitParallelScaleRef = useRef<{ [key: string]: number }>({});
  
  // State
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('Axial');
  const [paneLayout, setPaneLayout] = useState<PaneLayout>(1);
  const [activeViewportId, setActiveViewportId] = useState<string>('viewport-1');
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(!isMobile);
  const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(true);
  const [, setWindowWidth] = useState<number>(400);
  const [, setWindowCenter] = useState<number>(50);
  const cineSpeed = 10;

  // Custom hooks
  const { transformations, getTransformations, updateTransformations, resetTransformations } = useTransformations();
  
  const { getViewport, applyTransformations } = useViewport({
    renderingEngineRef,
    activeViewportId,
    getTransformations,
  });

  const { isCinePlaying, handleCineToggle } = useCine({
    getViewport,
    activeViewportId,
    applyTransformations,
    setCurrentImageIndex,
    cineSpeed,
  });

  // Operations
  const zoomOps = useZoomOperations({
    getViewport,
    fitParallelScaleRef,
  });

  const panOps = usePanOperations({
    getViewport,
  });

  const contrastOps = useContrastOperations({
    getTransformations,
    updateTransformations,
    applyTransformations,
  });

  const flipOps = useFlipOperations({
    getTransformations,
    updateTransformations,
    applyTransformations,
  });

  const rotateOps = useRotateOperations({
    getTransformations,
    updateTransformations,
    applyTransformations,
  });

  const viewOps = useViewOperations({
    getViewport,
    applyTransformations,
    setCurrentImageIndex,
    activeViewportId,
  });

  // Get active viewport transformations
  const activeTransforms = getTransformations(activeViewportId);

  // Get active viewport image count
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

  // Get grid layout class
  const getGridClass = useMemo(() => {
    if (isMobile) {
      switch (paneLayout) {
        case 1: return 'grid-cols-1 grid-rows-1';
        case 2: return 'grid-cols-1 grid-rows-2';
        case 3: return 'grid-cols-1 grid-rows-3';
        case 4: return 'grid-cols-1 grid-rows-4';
        default: return 'grid-cols-1 grid-rows-1';
      }
    } else {
      switch (paneLayout) {
        case 1: return 'grid-cols-1 grid-rows-1';
        case 2: return 'grid-cols-2 grid-rows-1';
        case 3: return 'grid-cols-2 grid-rows-2';
        case 4: return 'grid-cols-2 grid-rows-2';
        default: return 'grid-cols-1 grid-rows-1';
      }
    }
  }, [paneLayout, isMobile]);

  // Initialize viewport
  const initializeViewport = useCallback((viewportId: string): boolean => {
    if (!renderingEngineRef.current) return false;
    
    const viewportElement = viewportRefs.current[viewportId];
    if (!viewportElement) return false;
    
    try {
      const existingViewport = renderingEngineRef.current.getViewport(viewportId);
      if (existingViewport) {
        const toolGroupId = `toolGroup-${viewportId}`;
        if (!toolGroupsRef.current[viewportId]) {
          let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          if (!toolGroup) {
            toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
            if (toolGroup) {
              toolGroup.addTool(PanTool.toolName);
              toolGroup.addTool(ZoomTool.toolName);
              toolGroup.addTool(StackScrollTool.toolName);
              toolGroup.addViewport(viewportId, 'myRenderingEngine');
              toolGroupsRef.current[viewportId] = toolGroup;
              
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
        return true;
      }
      
      const viewportInput = {
        viewportId,
        element: viewportElement,
        type: cornerstone.Enums.ViewportType.STACK,
      };
      renderingEngineRef.current.enableElement(viewportInput);
      
      const toolGroupId = `toolGroup-${viewportId}`;
      let toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      
      if (!toolGroup) {
        toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addTool(ZoomTool.toolName);
          toolGroup.addTool(StackScrollTool.toolName);
          toolGroup.addViewport(viewportId, 'myRenderingEngine');
          toolGroupsRef.current[viewportId] = toolGroup;
          
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
          
          // Setup pinch-to-zoom
          setupPinchToZoom({
            viewportId,
            viewportElement,
            getViewport,
            fitParallelScaleRef,
          });
        }
      } else {
        toolGroupsRef.current[viewportId] = toolGroup;
      }
      
      return true;
    } catch (error) {
      console.warn(`Viewport ${viewportId} initialization error:`, error);
      return false;
    }
  }, [getViewport]);

  // Load series into viewports
  const loadSeries = async (series: Series, viewportIds?: string[]) => {
    const targetViewports = viewportIds || Array.from({ length: paneLayout }, (_, i) => `viewport-${i + 1}`);
    
    if (targetViewports.length === 0) {
      console.error('No viewports available');
      return;
    }

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
        
        resetTransformations(viewportId);
        
        if (toolGroup) {
          try {
            toolGroup.setToolPassive(WindowLevelTool.toolName);
            
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
            
            const viewportElement = vp.element;
            if (viewportElement) {
              viewportElement.style.pointerEvents = 'auto';
              viewportElement.style.touchAction = 'none';
              
              setupPinchToZoom({
                viewportId,
                viewportElement,
                getViewport,
                fitParallelScaleRef,
              });
              
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
      
      if (targetViewports.includes(activeViewportId)) {
        setCurrentImageIndex(0);
      }
      loadedSeriesRef.current = series;
      
      setStatus('');
    } catch (error) {
      console.error('Error loading series:', error);
      setError(error instanceof Error ? error.message : 'Failed to load series');
      setStatus('');
    }
  };

  // Handle series selection
  const handleSeriesSelect = async (seriesId: string, viewportId?: string) => {
    const targetViewport = viewportId || activeViewportId;
    
    const series = seriesList.find(s => s.seriesId === seriesId);
    if (!series) {
      console.error(`Series ${seriesId} not found`);
      return;
    }

    setSelectedSeriesId(seriesId);
    setError(null);
    
    const seriesOrientation = getSeriesOrientation(seriesId);
    if (seriesOrientation) {
      setOrientation(seriesOrientation);
    }
    
    await loadSeries(series, [targetViewport]);
  };

  // Handle stack navigation - using view operations
  const handleStackScroll = useCallback((direction: 'next' | 'prev', viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    if (direction === 'next') {
      viewOps.navigateToNext(vpId);
    } else {
      viewOps.navigateToPrevious(vpId);
    }
  }, [activeViewportId, viewOps]);

  // Transform handlers - using operation hooks
  const handleRotate = useCallback((direction: 'cw' | 'ccw', viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    if (direction === 'cw') {
      rotateOps.rotateClockwise(vpId);
    } else {
      rotateOps.rotateCounterClockwise(vpId);
    }
  }, [activeViewportId, rotateOps]);

  const handleFlip = useCallback((direction: 'horizontal' | 'vertical', viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    if (direction === 'horizontal') {
      flipOps.toggleHorizontalFlip(vpId);
    } else {
      flipOps.toggleVerticalFlip(vpId);
    }
  }, [activeViewportId, flipOps]);

  const handleInvert = useCallback((viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const current = getTransformations(vpId);
    updateTransformations(vpId, { inverted: !current.inverted });
    applyTransformations(vpId);
  }, [activeViewportId, getTransformations, updateTransformations, applyTransformations]);

  const handleContrastChange = useCallback((value: number, viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    contrastOps.setContrast(vpId, value);
  }, [activeViewportId, contrastOps]);

  const handleReset = useCallback(async (viewportId?: string) => {
    const vpId = viewportId || activeViewportId;
    const viewport = getViewport(vpId);
    if (viewport && viewport.getImageIds().length > 0) {
      const currentSeries = loadedSeriesRef.current;
      if (currentSeries) {
        await loadSeries(currentSeries, [vpId]);
      } else {
        // Reset zoom and pan
        zoomOps.resetZoom(vpId);
        panOps.resetPan(vpId);
        // Reset transformations
        resetTransformations(vpId);
        contrastOps.resetContrast(vpId);
        flipOps.resetFlips(vpId);
        rotateOps.resetRotation(vpId);
        applyTransformations(vpId);
      }
    }
  }, [activeViewportId, getViewport, resetTransformations, applyTransformations, loadSeries, zoomOps, panOps, contrastOps, flipOps, rotateOps]);

  const handleOrientationChange = useCallback(async (newOrientation: Orientation) => {
    setOrientation(newOrientation);
    const series = viewOps.getSeriesForOrientation(newOrientation, seriesList);
    if (series) {
      await handleSeriesSelect(series.seriesId, activeViewportId);
    }
  }, [seriesList, activeViewportId, handleSeriesSelect, viewOps]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
      
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

  // Update transformations when state changes
  useEffect(() => {
    applyTransformations(activeViewportId);
  }, [transformations, activeViewportId, applyTransformations]);

  // Initialize Cornerstone and discover series
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        init();
        initTools();

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
            
            const toolGroupId = `toolGroup-${viewportId}`;
            const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
            if (existingToolGroup) {
              ToolGroupManager.destroyToolGroup(toolGroupId);
            }
            
            const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
            if (toolGroup) {
              toolGroup.addTool(ZoomTool.toolName);
              toolGroup.addTool(StackScrollTool.toolName);
              toolGroup.addViewport(viewportId, renderingEngineId);
              toolGroupsRef.current[viewportId] = toolGroup;
              
              if (viewportElement) {
                viewportElement.style.pointerEvents = 'auto';
                viewportElement.style.touchAction = 'none';
                
                setupPinchToZoom({
                  viewportId,
                  viewportElement,
                  getViewport,
                  fitParallelScaleRef,
                });
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

  // Initialize viewports when refs are ready
  useEffect(() => {
    if (!renderingEngineRef.current) return;
    
    const initializeViewports = () => {
      for (let i = 1; i <= 4; i++) {
        const viewportId = `viewport-${i}`;
        initializeViewport(viewportId);
      }
      
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

  return (
    <div 
      className="w-full h-screen flex bg-gray-900 text-white overflow-hidden"
      style={{
        height: '100dvh',
        paddingTop: isMobile ? 'env(safe-area-inset-top)' : '0',
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : '0',
      }}
    >
      {/* Mobile Menu Button */}
      {isMobile && !sidebarOpen && !bottomPanelOpen && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg active:bg-blue-700 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation md:hidden"
          style={{ 
            touchAction: 'manipulation',
            bottom: `calc(env(safe-area-inset-bottom) + 8.5rem)`,
            right: `calc(env(safe-area-inset-right) + 1rem)`,
          }}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <Sidebar
        seriesList={seriesList}
        selectedSeriesId={selectedSeriesId}
        onSeriesSelect={handleSeriesSelect}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        status={status}
      />

      {/* Main Content Area */}
      <div 
        className={`${isMobile ? 'w-full' : 'flex-1'} flex flex-col overflow-hidden`}
        style={{
          width: isMobile ? '100%' : '100%',
          height: '100%',
        }}
      >
        {/* Desktop Toolbar */}
        <DesktopToolbar
          activeTransforms={activeTransforms}
          orientation={orientation}
          paneLayout={paneLayout}
          isMultiStack={isMultiStack}
          isCinePlaying={isCinePlaying[activeViewportId] || false}
          activeViewportImageCount={activeViewportImageCount}
          currentImageIndex={currentImageIndex}
          status={status}
          error={error}
          onRotate={handleRotate}
          onFlip={handleFlip}
          onContrastChange={handleContrastChange}
          onInvert={handleInvert}
          onReset={handleReset}
          onOrientationChange={handleOrientationChange}
          onCineToggle={() => handleCineToggle(activeViewportId)}
          onPaneLayoutChange={setPaneLayout}
          onStackScroll={(dir) => handleStackScroll(dir)}
          getViewport={getViewport}
          activeViewportId={activeViewportId}
        />

        {/* Viewport Grid */}
        <ViewportGrid
          paneLayout={paneLayout}
          activeViewportId={activeViewportId}
          isMobile={isMobile}
          bottomPanelOpen={bottomPanelOpen}
          viewportRefs={viewportRefs}
          renderingEngineRef={renderingEngineRef}
          initializeViewport={initializeViewport}
          getViewport={getViewport}
          isCinePlaying={isCinePlaying}
          onViewportClick={setActiveViewportId}
          onCineToggle={handleCineToggle}
          getGridClass={getGridClass}
        />

        {/* Toggle Button - Mobile */}
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
              bottom: `calc(env(safe-area-inset-bottom) + 4.5rem)`,
              right: `calc(env(safe-area-inset-right) + 1rem)`,
            }}
            aria-label="Show controls"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Mobile Controls */}
        <MobileControls
          isOpen={bottomPanelOpen}
          onClose={() => setBottomPanelOpen(false)}
          activeTransforms={activeTransforms}
          orientation={orientation}
          paneLayout={paneLayout}
          isMultiStack={isMultiStack}
          isCinePlaying={isCinePlaying[activeViewportId] || false}
          activeViewportImageCount={activeViewportImageCount}
          currentImageIndex={currentImageIndex}
          error={error}
          onRotate={handleRotate}
          onFlip={handleFlip}
          onContrastChange={handleContrastChange}
          onInvert={handleInvert}
          onReset={handleReset}
          onOrientationChange={handleOrientationChange}
          onCineToggle={() => handleCineToggle(activeViewportId)}
          onPaneLayoutChange={setPaneLayout}
          onStackScroll={(dir) => handleStackScroll(dir)}
          getViewport={getViewport}
          activeViewportId={activeViewportId}
        />
      </div>
    </div>
  );
}
