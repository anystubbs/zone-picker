export interface Zone {
  id: string;
  name: string;
  category: string;
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][];
  };
  selected: boolean;
}

export type DragMode = 'lasso' | 'path';

import { RenderingProvider } from './RenderingProvider';

export interface ZoneSelectorConfig {
  provider: RenderingProvider;
  zones: Zone[];
  dragMode?: DragMode; // Default: 'lasso'
  onSelectionChange?: (selectedZones: Zone[]) => void;
  onCategoryChange?: (category: string) => void;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Category = string;