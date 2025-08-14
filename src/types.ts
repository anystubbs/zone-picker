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

export type DragMode = 'rectangle' | 'lasso' | 'path';

export interface ZoneSelectorConfig {
  canvas: HTMLCanvasElement;
  zones: Zone[];
  viewport: ViewportBounds;
  dragMode?: DragMode; // Default: 'rectangle'
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