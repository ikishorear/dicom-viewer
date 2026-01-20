import type { PaneLayout } from '../types';
import * as cornerstone from '@cornerstonejs/core';

interface ViewportGridProps {
  paneLayout: PaneLayout;
  activeViewportId: string;
  isMobile: boolean;
  bottomPanelOpen: boolean;
  viewportRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  renderingEngineRef: React.MutableRefObject<cornerstone.RenderingEngine | null>;
  initializeViewport: (viewportId: string) => boolean;
  getViewport: (viewportId?: string) => cornerstone.StackViewport | null;
  isCinePlaying: { [viewportId: string]: boolean };
  onViewportClick: (viewportId: string) => void;
  onCineToggle: (viewportId: string) => void;
  getGridClass: string;
}

export const ViewportGrid = ({
  paneLayout,
  activeViewportId,
  isMobile,
  bottomPanelOpen,
  viewportRefs,
  renderingEngineRef,
  initializeViewport,
  getViewport,
  isCinePlaying,
  onViewportClick,
  onCineToggle,
  getGridClass,
}: ViewportGridProps) => {
  return (
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
        const viewport = getViewport(viewportId);
        const hasMultipleImages = viewport && viewport.getImageIds() && viewport.getImageIds().length > 1;
        const paneIsPlaying = isCinePlaying[viewportId] || false;
        
        return (
          <div
            key={num}
            className={`relative bg-black border-2 rounded-lg overflow-hidden ${
              isActive ? 'border-blue-500' : 'border-gray-700'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('viewport-container')) {
                onViewportClick(viewportId);
              }
            }}
          >
            <div
              ref={(el) => {
                viewportRefs.current[viewportId] = el;
                if (el && renderingEngineRef.current) {
                  setTimeout(() => {
                    initializeViewport(viewportId);
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
                e.stopPropagation();
                onViewportClick(viewportId);
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
            {hasMultipleImages && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCineToggle(viewportId);
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
            )}
          </div>
        );
      })}
    </div>
  );
};
