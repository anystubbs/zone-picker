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

export interface MouseEvent {
  point: Point;
  worldCoordinates: [number, number];
  originalEvent: Event;
}

/**
 * Minimal rendering provider interface focused on coordinate transformation
 * and integration points rather than full rendering abstraction
 */
export interface RenderingProvider {
  // Core setup - each provider handles Paper.js setup differently
  initialize(): void;
  destroy(): void;
  
  // The key abstraction: coordinate transformation
  worldToCanvas(x: number, y: number): Point;
  canvasToWorld(point: Point): [number, number];
  
  // Viewport management - some providers (maps) manage this internally
  getViewportBounds(): ViewportBounds;
  setViewportBounds(bounds: ViewportBounds): void;
  
  // Canvas size for Paper.js calculations
  getCanvasSize(): { width: number; height: number };
  
  // Event handling integration
  onMouseDown(handler: (event: MouseEvent) => void): () => void; // Returns cleanup function
  onMouseMove(handler: (event: MouseEvent) => void): () => void;
  onMouseUp(handler: (event: MouseEvent) => void): () => void;
  
  // Map-specific updates (zoom, pan) - triggers re-render
  onViewportChange(handler: () => void): () => void;
  
  // Hit testing - provider can optimize this
  hitTest?(point: Point): string | null; // Optional - falls back to Paper.js
  
  // Provider-specific canvas/container access
  getContainer(): HTMLElement;
}