import type { Orientation, PaneLayout, ViewportTransformations } from '../types';
import { WhiteSliderMobile } from './StyledSlider';

interface MobileControlsProps {
  isOpen: boolean;
  onClose: () => void;
  activeTransforms: ViewportTransformations;
  orientation: Orientation;
  paneLayout: PaneLayout;
  isMultiStack: boolean;
  isCinePlaying: boolean;
  activeViewportImageCount: number;
  currentImageIndex: number;
  error: string | null;
  onRotate: (direction: 'cw' | 'ccw') => void;
  onFlip: (direction: 'horizontal' | 'vertical') => void;
  onContrastChange: (value: number) => void;
  onInvert: () => void;
  onReset: () => void;
  onOrientationChange: (orientation: Orientation) => Promise<void>;
  onCineToggle: () => void;
  onPaneLayoutChange: (layout: PaneLayout) => void;
  onStackScroll: (direction: 'next' | 'prev') => void;
  getViewport: (viewportId?: string) => any;
  activeViewportId: string;
}

export const MobileControls = ({
  isOpen,
  onClose,
  activeTransforms,
  orientation,
  paneLayout,
  isMultiStack,
  isCinePlaying,
  activeViewportImageCount,
  currentImageIndex,
  error,
  onRotate,
  onFlip,
  onContrastChange,
  onInvert,
  onReset,
  onOrientationChange,
  onCineToggle,
  onPaneLayoutChange,
  onStackScroll,
  getViewport,
  activeViewportId,
}: MobileControlsProps) => {
  if (!isOpen) return null;

  const viewport = getViewport(activeViewportId);
  const currentIdx = viewport ? viewport.getCurrentImageIdIndex() : currentImageIndex;

  return (
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
            onClose();
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
        {/* Contrast Control */}
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
              onChange={(_e, value) => onContrastChange(value as number)}
            />
          </div>
          <span className="text-lg font-bold text-white min-w-[55px] text-right bg-blue-600/30 px-3 py-2 rounded-lg border border-blue-500/50">
            {activeTransforms.contrast.toFixed(1)}
          </span>
        </div>

        {/* Control Buttons Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* Rotate Controls */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRotate('ccw');
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
              onRotate('cw');
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
              onFlip('horizontal');
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
              onFlip('vertical');
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
              onInvert();
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
              onReset();
            }}
            className="px-4 py-3 rounded-lg bg-gray-700 text-gray-300 active:bg-gray-600 text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation"
            style={{ touchAction: 'manipulation' }}
            title="Reset View"
          >
            Reset
          </button>
        </div>

        {/* Multipane View */}
        <div className="w-full border-t border-gray-600 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-2 flex-1">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPaneLayoutChange(num as PaneLayout);
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
                await onOrientationChange(e.target.value as Orientation);
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
                onCineToggle();
              }}
              className={`px-4 py-3 rounded-lg text-base font-medium min-h-[48px] flex items-center justify-center touch-manipulation ${
                isCinePlaying ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 active:bg-gray-600'
              }`}
              style={{ touchAction: 'manipulation' }}
              title="Cine Playback"
            >
              {isCinePlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>
        )}

        {/* Navigation */}
        {activeViewportImageCount > 1 && (
          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={(e) => {
                if (currentIdx === 0) return;
                e.preventDefault();
                e.stopPropagation();
                onStackScroll('prev');
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
                onStackScroll('next');
              }}
              disabled={currentIdx >= activeViewportImageCount - 1}
              className="px-6 py-3 rounded-lg text-lg font-medium bg-gray-700 text-gray-300 active:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] min-w-[60px] flex items-center justify-center touch-manipulation"
              style={{ touchAction: 'manipulation' }}
              title="Next"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};
