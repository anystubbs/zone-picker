export interface CategoryVariant {
  id: string;           // e.g., "level-4"
  minZoom?: number;     // Min zoom for auto-switching
  maxZoom?: number;     // Max zoom for auto-switching
}

export interface CategoryConfig {
  id: string;           // e.g., "h3"
  variants: CategoryVariant[];
  autoSwitch?: boolean; // Enable zoom-based switching
}

export class Zone {
  id: string;
  name: string;
  category: string;
  variant: string;
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][];
  };
  selected: boolean = false;
  
  private _bounds?: ViewportBounds;
  
  constructor(data: {
    id: string;
    name: string;
    category: string;
    variant: string;
    geometry: {
      type: 'Point' | 'Polygon';
      coordinates: number[] | number[][];
    };
  }) {
    this.id = data.id;
    this.name = data.name;
    this.category = data.category;
    this.variant = data.variant;
    this.geometry = data.geometry;
  }
  
  getBounds(): ViewportBounds {
    if (!this._bounds) {
      this._bounds = this.calculateBounds();
    }
    return this._bounds;
  }
  
  private calculateBounds(): ViewportBounds {
    if (this.geometry.type === 'Point') {
      const [lon, lat] = this.geometry.coordinates as number[];
      return { minX: lon, maxX: lon, minY: lat, maxY: lat };
    } else {
      const coords = this.geometry.coordinates as number[][];
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const [lon, lat] of coords) {
        minX = Math.min(minX, lon);
        maxX = Math.max(maxX, lon);
        minY = Math.min(minY, lat);
        maxY = Math.max(maxY, lat);
      }
      
      return { minX, maxX, minY, maxY };
    }
  }
}

export type DragMode = 'lasso' | 'path';

import { RenderingProvider } from './providers';

export interface ZoneSelectorConfig {
  provider: RenderingProvider;
  zones: Zone[];
  categories?: CategoryConfig[]; // Optional, derived from zones if not provided
  dragMode?: DragMode; // Default: 'lasso'
  onSelectionChange?: (selectedZones: Zone[]) => void;
  onCategoryChange?: (category: string, variant: string) => void;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Category = string;