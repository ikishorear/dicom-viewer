import type { Orientation, Series } from '../types';

/**
 * Get orientation for a series ID
 */
export const getSeriesOrientation = (seriesId: string): Orientation | null => {
  if (seriesId === 'series-00000' || seriesId.includes('series-00000')) return 'Acquisition';
  if (seriesId === 'series-00001' || seriesId.includes('series-00001')) return 'Axial';
  if (seriesId === 'series-00002' || seriesId.includes('series-00002')) return 'Sagittal';
  if (seriesId === 'series-00003' || seriesId.includes('series-00003')) return 'Coronal';
  return null;
};

/**
 * Get series by orientation
 */
export const getSeriesByOrientation = (orientation: Orientation, seriesList: Series[]): Series | null => {
  const orientationMap: { [key in Orientation]: string } = {
    'Acquisition': 'series-00000',
    'Axial': 'series-00001',
    'Sagittal': 'series-00002',
    'Coronal': 'series-00003',
  };
  
  const targetSeriesId = orientationMap[orientation];
  return seriesList.find(s => s.seriesId === targetSeriesId || s.seriesId.includes(targetSeriesId)) || null;
};
