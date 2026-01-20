// Series data structure
export interface Series {
  seriesId: string;
  imageIds: string[];
  seriesName?: string;
  instanceCount: number;
}

export type Orientation = 'Axial' | 'Coronal' | 'Sagittal' | 'Acquisition';
export type PaneLayout = 1 | 2 | 3 | 4;

export interface ViewportTransformations {
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  inverted: boolean;
  contrast: number;
}

export interface TransformationsState {
  [viewportId: string]: ViewportTransformations;
}
