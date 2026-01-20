import type { Series } from '../types';
import { getSeriesOrientation } from '../utils/orientationMapping';

interface SidebarProps {
  seriesList: Series[];
  selectedSeriesId: string | null;
  onSeriesSelect: (seriesId: string) => void;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  status: string;
}

export const Sidebar = ({
  seriesList,
  selectedSeriesId,
  onSeriesSelect,
  isMobile,
  isOpen,
  onClose,
  status,
}: SidebarProps) => {
  if (isMobile) {
    return (
      <>
        {/* Backdrop overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
            style={{
              top: 'env(safe-area-inset-top)',
              bottom: 'env(safe-area-inset-bottom)',
            }}
          />
        )}
        
        {/* Mobile Sidebar */}
        <div 
          className={`fixed ${isOpen ? 'translate-x-0' : '-translate-x-full'} z-[70] w-64 bg-gray-800 border-r border-gray-700 flex flex-col transition-transform duration-300 ease-in-out h-full shadow-2xl`}
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
              onClick={onClose}
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
                        onSeriesSelect(series.seriesId);
                        onClose();
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
    );
  }

  // Desktop Sidebar
  return (
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
                  onClick={() => onSeriesSelect(series.seriesId)}
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
  );
};
