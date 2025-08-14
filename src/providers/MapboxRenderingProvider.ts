import paper from 'paper';
import { ViewportBounds } from '../types';
import { RenderingProvider, Point, MouseEvent as ProviderMouseEvent } from './RenderingProvider';

// Type definitions for Mapbox GL JS
interface MapboxMap {
  project(lngLat: [number, number]): { x: number; y: number };
  unproject(point: { x: number; y: number }): { lng: number; lat: number };
  getBounds(): { 
    getNorthEast(): { lng: number; lat: number }; 
    getSouthWest(): { lng: number; lat: number }; 
  };
  setBounds(bounds: [[number, number], [number, number]], options?: any): void;
  getCanvas(): HTMLCanvasElement;
  getContainer(): HTMLElement;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  resize(): void;
}

/**
 * Mapbox GL JS rendering provider that overlays Paper.js canvas on top of a Mapbox map
 * Handles coordinate transformation between world coordinates and Mapbox pixel coordinates
 */
export class MapboxRenderingProvider implements RenderingProvider {
  private map: MapboxMap;
  private canvas: HTMLCanvasElement;
  private paperCanvas: HTMLCanvasElement;
  private mouseDownHandlers: Set<(event: ProviderMouseEvent) => void> = new Set();
  private mouseMoveHandlers: Set<(event: ProviderMouseEvent) => void> = new Set();
  private mouseUpHandlers: Set<(event: ProviderMouseEvent) => void> = new Set();
  private viewportChangeHandlers: Set<() => void> = new Set();
  
  // Event handler references for cleanup
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMapMove: (() => void) | null = null;
  private boundMapZoom: (() => void) | null = null;

  constructor(map: MapboxMap) {
    this.map = map;
    this.canvas = map.getCanvas();
    
    // Create overlay canvas for Paper.js
    this.paperCanvas = document.createElement('canvas');
    this.paperCanvas.style.position = 'absolute';
    this.paperCanvas.style.top = '0';
    this.paperCanvas.style.left = '0';
    this.paperCanvas.style.pointerEvents = 'none'; // Let map handle interactions
    this.paperCanvas.style.zIndex = '1000';
    
    this.updateCanvasSize();
  }

  initialize(): void {
    // Add overlay canvas to map container
    const mapContainer = this.map.getContainer();
    mapContainer.appendChild(this.paperCanvas);
    
    // Setup Paper.js with overlay canvas
    paper.setup(this.paperCanvas);
    
    this.setupEventHandlers();
  }

  destroy(): void {
    // Remove overlay canvas
    if (this.paperCanvas.parentNode) {
      this.paperCanvas.parentNode.removeChild(this.paperCanvas);
    }
    
    // Clean up event listeners
    this.cleanupEventHandlers();
    
    // Clear handlers
    this.mouseDownHandlers.clear();
    this.mouseMoveHandlers.clear();
    this.mouseUpHandlers.clear();
    this.viewportChangeHandlers.clear();
  }

  worldToCanvas(lng: number, lat: number): Point {
    // Use Mapbox's project method to convert lng/lat to pixel coordinates
    return this.map.project([lng, lat]);
  }

  canvasToWorld(point: Point): [number, number] {
    // Use Mapbox's unproject method to convert pixel coordinates to lng/lat
    const lngLat = this.map.unproject(point);
    return [lngLat.lng, lngLat.lat];
  }

  getViewportBounds(): ViewportBounds {
    const bounds = this.map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    return {
      minX: sw.lng,
      maxX: ne.lng,
      minY: sw.lat,
      maxY: ne.lat
    };
  }

  setViewportBounds(bounds: ViewportBounds): void {
    // Set map bounds using Mapbox's setBounds method
    this.map.setBounds([
      [bounds.minX, bounds.minY], // Southwest corner
      [bounds.maxX, bounds.maxY]  // Northeast corner
    ], { 
      padding: 20,
      linear: true
    });
  }

  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.paperCanvas.width,
      height: this.paperCanvas.height
    };
  }

  onMouseDown(handler: (event: ProviderMouseEvent) => void): () => void {
    this.mouseDownHandlers.add(handler);
    return () => this.mouseDownHandlers.delete(handler);
  }

  onMouseMove(handler: (event: ProviderMouseEvent) => void): () => void {
    this.mouseMoveHandlers.add(handler);
    return () => this.mouseMoveHandlers.delete(handler);
  }

  onMouseUp(handler: (event: ProviderMouseEvent) => void): () => void {
    this.mouseUpHandlers.add(handler);
    return () => this.mouseUpHandlers.delete(handler);
  }

  onViewportChange(handler: () => void): () => void {
    this.viewportChangeHandlers.add(handler);
    return () => this.viewportChangeHandlers.delete(handler);
  }

  hitTest(point: Point): string | null {
    // Use Paper.js hit testing on the overlay canvas
    const hitResult = paper.project.hitTest(new paper.Point(point.x, point.y));
    return hitResult?.item?.data?.zoneId || null;
  }

  getContainer(): HTMLElement {
    return this.map.getContainer();
  }

  private updateCanvasSize(): void {
    const mapCanvas = this.canvas;
    this.paperCanvas.width = mapCanvas.width;
    this.paperCanvas.height = mapCanvas.height;
    this.paperCanvas.style.width = mapCanvas.style.width;
    this.paperCanvas.style.height = mapCanvas.style.height;
  }

  private setupEventHandlers(): void {
    // Mouse event handlers on the map container (since overlay has pointer-events: none)
    const container = this.map.getContainer();
    
    this.boundMouseDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldCoordinates = this.canvasToWorld(point);
      
      const event: ProviderMouseEvent = {
        point,
        worldCoordinates,
        originalEvent: e
      };
      
      this.mouseDownHandlers.forEach(handler => handler(event));
    };
    
    this.boundMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldCoordinates = this.canvasToWorld(point);
      
      const event: ProviderMouseEvent = {
        point,
        worldCoordinates,
        originalEvent: e
      };
      
      this.mouseMoveHandlers.forEach(handler => handler(event));
    };
    
    this.boundMouseUp = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldCoordinates = this.canvasToWorld(point);
      
      const event: ProviderMouseEvent = {
        point,
        worldCoordinates,
        originalEvent: e
      };
      
      this.mouseUpHandlers.forEach(handler => handler(event));
    };
    
    container.addEventListener('mousedown', this.boundMouseDown);
    container.addEventListener('mousemove', this.boundMouseMove);
    container.addEventListener('mouseup', this.boundMouseUp);
    
    // Map viewport change handlers
    this.boundMapMove = () => {
      this.updateCanvasSize();
      this.viewportChangeHandlers.forEach(handler => handler());
    };
    
    this.boundMapZoom = () => {
      this.updateCanvasSize();
      this.viewportChangeHandlers.forEach(handler => handler());
    };
    
    this.map.on('move', this.boundMapMove);
    this.map.on('zoom', this.boundMapZoom);
    this.map.on('resize', this.boundMapMove);
  }

  private cleanupEventHandlers(): void {
    const container = this.map.getContainer();
    
    if (this.boundMouseDown) {
      container.removeEventListener('mousedown', this.boundMouseDown);
    }
    if (this.boundMouseMove) {
      container.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      container.removeEventListener('mouseup', this.boundMouseUp);
    }
    
    if (this.boundMapMove) {
      this.map.off('move', this.boundMapMove);
      this.map.off('resize', this.boundMapMove);
    }
    if (this.boundMapZoom) {
      this.map.off('zoom', this.boundMapZoom);
    }
  }
}