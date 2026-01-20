import type { Orientation, PaneLayout, ViewportTransformations } from '../types';
import { WhiteSlider } from './StyledSlider';

interface DesktopToolbarProps {
  activeTransforms: ViewportTransformations;
  orientation: Orientation;
  paneLayout: PaneLayout;
  isMultiStack: boolean;
  isCinePlaying: boolean;
  activeViewportImageCount: number;
  currentImageIndex: number;
  status: string;
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

export const DesktopToolbar = ({
  activeTransforms,
  orientation,
  paneLayout,
  isMultiStack,
  isCinePlaying,
  activeViewportImageCount,
  currentImageIndex,
  status,
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
}: DesktopToolbarProps) => {
  const viewport = getViewport(activeViewportId);
  const currentIdx = viewport ? viewport.getCurrentImageIdIndex() : currentImageIndex;

  return (
    <div className="hidden md:block bg-gray-800 border-b border-gray-700 p-2 md:p-3">
      <div className="flex flex-col gap-2">
        {/* First Row - Main Controls */}
        <div className="flex flex-wrap gap-1 md:gap-2 items-center text-xs md:text-sm">
          {/* Rotate Controls */}
          <div className="flex gap-1 border-r border-gray-600 pr-1 md:pr-2">
            <button
              onClick={() => onRotate('ccw')}
              className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="Rotate Counter-Clockwise"
            >
              ↺
            </button>
            <button
              onClick={() => onRotate('cw')}
              className="px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="Rotate Clockwise"
            >
              ↻
            </button>
          </div>

          {/* Flip Controls */}
          <div className="flex gap-1 border-r border-gray-600 pr-1 md:pr-2">
            <button
              onClick={() => onFlip('horizontal')}
              className={`px-2 py-1 rounded ${
                activeTransforms.flipHorizontal ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Flip Horizontal"
            >
              ⇄
            </button>
            <button
              onClick={() => onFlip('vertical')}
              className={`px-2 py-1 rounded ${
                activeTransforms.flipVertical ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Flip Vertical"
            >
              ⇅
            </button>
          </div>

          {/* Contrast Control */}
          <div className="flex items-center gap-2 border-r border-gray-600 pr-1 md:pr-2">
            <span className="text-gray-400 hidden md:inline text-xs">Contrast:</span>
            <div className="flex items-center gap-2">
              <div className="w-20 md:w-32">
                <WhiteSlider
                  value={activeTransforms.contrast || 1.0}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  onChange={(_e, value) => onContrastChange(value as number)}
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
              onClick={onInvert}
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
                    await onOrientationChange(e.target.value as Orientation);
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
                  onClick={onCineToggle}
                  className={`px-2 md:px-3 py-1 rounded text-xs md:text-sm ${
                    isCinePlaying ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Cine Playback"
                >
                  {isCinePlaying ? '⏸' : '▶'}
                </button>
              </div>
            </>
          )}

          {/* Reset */}
          <div>
            <button
              onClick={onReset}
              className="px-2 md:px-3 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 hover:bg-gray-600"
              title="Reset View"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Second Row - Multipane View */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-600">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => onPaneLayoutChange(num as PaneLayout)}
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
        {activeViewportImageCount > 1 && (
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <button
              onClick={() => onStackScroll('prev')}
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
              onClick={() => onStackScroll('next')}
              disabled={currentIdx >= activeViewportImageCount - 1}
              className="px-1 md:px-2 py-1 rounded text-xs md:text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next"
            >
              ▶
            </button>
          </div>
        )}

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
  );
};
