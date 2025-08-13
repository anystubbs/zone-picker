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

export interface ZoneSelectorConfig {
  canvas: HTMLCanvasElement;
  zones: Zone[];
  viewport: ViewportBounds;
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