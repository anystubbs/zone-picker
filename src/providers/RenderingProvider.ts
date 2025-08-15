import { ViewportBounds } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface RenderStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

export interface SelectionStyle {
  strokeColor: string;
  strokeWidth: number;
  dashArray?: number[];
  fillColor?: string;
}

// Generic shape interface for provider-agnostic rendering
export interface Shape {
  id: string;
  data?: any;
}

// Generic selection shape for drag operations
export interface SelectionShape {
  id: string;
  type: 'lasso' | 'path';
  points: Point[];
}

export interface MouseEvent {
  point: Point;
  worldCoordinates: [number, number];
  originalEvent: Event;
}

/**
 * Rendering provider interface that abstracts away Paper.js dependencies
 * Each provider can implement rendering using its own technology (Canvas2D, WebGL, SVG, etc.)
 */
export interface RenderingProvider {
  // Core setup
  initialize(): void;
  destroy(): void;
  
  // The key abstraction: coordinate transformation
  worldToCanvas(x: number, y: number): Point;
  canvasToWorld(point: Point): [number, number];
  
  // Viewport management - some providers (maps) manage this internally
  getViewportBounds(): ViewportBounds;
  setViewportBounds(bounds: ViewportBounds): void;
  
  // Canvas size for calculations
  getCanvasSize(): { width: number; height: number };
  
  // Event handling integration
  onMouseDown(handler: (event: MouseEvent) => void): () => void; // Returns cleanup function
  onMouseMove(handler: (event: MouseEvent) => void): () => void;
  onMouseUp(handler: (event: MouseEvent) => void): () => void;
  
  // Map-specific updates (zoom, pan) - triggers re-render
  onViewportChange(handler: () => void): () => void;
  
  // Provider-specific canvas/container access
  getContainer(): HTMLElement;
  
  // Rendering operations - provider handles the implementation details
  clear(): void;
  update(): void;
  
  // Zone rendering
  renderZone(zoneId: string, geometry: { type: 'Point' | 'Polygon'; coordinates: number[] | number[][] }, style: RenderStyle): Shape;
  removeZone(zoneId: string): void;
  
  // Selection shape operations
  createSelectionShape(type: 'lasso' | 'path', startPoint: Point): SelectionShape;
  updateSelectionShape(shape: SelectionShape, currentPoint: Point, startPoint: Point): void;
  completeSelectionShape(shape: SelectionShape, startPoint: Point): void;
  removeSelectionShape(shape: SelectionShape): void;
  applySelectionStyle(shape: SelectionShape, style: SelectionStyle): void;
  
  // Hit testing and intersection
  hitTest(point: Point): string | null;
  testIntersection(zoneId: string, selectionShape: SelectionShape): boolean;
  
  // Optional zoom level for variant switching
  getZoomLevel?(): number;
}