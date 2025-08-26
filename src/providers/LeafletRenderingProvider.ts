import * as L from 'leaflet';
import * as PIXI from 'pixi.js';
import 'leaflet-pixi-overlay';

// Extend Leaflet namespace to include PixiOverlay
declare module 'leaflet' {
  function pixiOverlay(
    drawCallback: (utils: any, eventOrCustomData?: any) => void,
    pixiContainer: PIXI.Container,
    options?: any
  ): any;
}
import { 
  RenderingProvider, 
  Point, 
  RenderStyle, 
  SelectionStyle, 
  Shape, 
  SelectionShape, 
  MouseEvent 
} from './RenderingProvider';
import { ViewportBounds } from '../types';

interface LeafletPixiShape extends Shape {
  pixiObject: PIXI.Graphics;
  projectedCoords?: { x: number; y: number }[]; // Cache projected coordinates from firstDraw
}

interface LeafletPixiSelectionShape extends SelectionShape {
  pixiObject: PIXI.Graphics;
}

/**
 * High-performance WebGL rendering provider using Leaflet with Pixi.js overlay
 * Provides GPU-accelerated rendering for thousands of zones on interactive maps
 */
export class LeafletRenderingProvider implements RenderingProvider {
  private map!: L.Map;
  private pixiOverlay!: any; // L.PixiOverlay type
  private pixiContainer!: PIXI.Container;
  private renderer!: PIXI.Renderer;
  private utils!: any; // Leaflet.PixiOverlay utils
  
  // Official pattern tracking
  private firstDraw = true;
  private prevZoom: number | null = null;
  
  private zones: Map<string, LeafletPixiShape> = new Map();
  private selectionShapes: Map<string, LeafletPixiSelectionShape> = new Map();
  
  // Event handlers
  private mouseDownHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseMoveHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseUpHandlers: Array<(event: MouseEvent) => void> = [];
  private viewportChangeHandlers: Array<() => void> = [];
  
  private isInitialized = false;
  private selectionIdCounter = 0;

  constructor(private containerElement: HTMLElement) {}

  initialize(): void {
    if (this.isInitialized) return;
    
    // Ensure PIXI is available globally for leaflet-pixi-overlay
    (window as any).PIXI = PIXI;
    
    // Create Leaflet map
    this.map = L.map(this.containerElement, {
      center: [54.5, -2.5], // UK center
      zoom: 6,
      zoomControl: true
    });
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(this.map);
    
    // Create PIXI container for our zones
    this.pixiContainer = new PIXI.Container();
    
    // Create Leaflet PixiOverlay
    this.pixiOverlay = L.pixiOverlay(
      (utils: any) => {
        this.utils = utils;
        this.renderer = utils.getRenderer();
        this.handleRedraw();
      },
      this.pixiContainer,
      {
        doubleBuffering: false,
        autoPreventDefault: false,
        resolution: window.devicePixelRatio || 1
      }
    );
    
    this.pixiOverlay.addTo(this.map);
    this.setupEventHandlers();
    this.isInitialized = true;
  }

  private handleMouseEvent(e: L.LeafletMouseEvent, handlers: Array<(event: MouseEvent) => void>): void {
    const point = this.leafletPointToCanvasPoint(e.containerPoint);
    const worldCoords = this.canvasToWorld(point);
    const mouseEvent: MouseEvent = {
      point,
      worldCoordinates: worldCoords,
      originalEvent: e.originalEvent
    };
    
    // Check if Ctrl key is pressed for selection mode
    const isCtrlPressed = e.originalEvent && (e.originalEvent as any).ctrlKey;
    if (isCtrlPressed) {
      // Prevent default browser behavior (context menu, etc.) and Leaflet behavior
      e.originalEvent?.preventDefault();
      e.originalEvent?.stopPropagation();
      L.DomEvent.stop(e);
    }
    
    handlers.forEach(handler => handler(mouseEvent));
  }

  private setupEventHandlers(): void {
    // Mouse events
    this.map.on('mousedown', (e: L.LeafletMouseEvent) => {
      this.handleMouseEvent(e, this.mouseDownHandlers);
    });
    
    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.handleMouseEvent(e, this.mouseMoveHandlers);
    });
    
    this.map.on('mouseup', (e: L.LeafletMouseEvent) => {
      this.handleMouseEvent(e, this.mouseUpHandlers);
    });
    
    // Prevent context menu when Ctrl is pressed
    this.map.getContainer().addEventListener('contextmenu', (e: Event) => {
      const mouseEvent = e as globalThis.MouseEvent;
      if (mouseEvent.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    });
    
    // Viewport change events
    this.map.on('moveend zoomend', () => {
      this.viewportChangeHandlers.forEach(handler => handler());
    });
  }
  
  private handleRedraw(): void {
    if (!this.utils) return;
    
    const zoom = this.utils.getMap().getZoom();
    const scale = this.utils.getScale();
    const project = this.utils.latLngToLayerPoint;
    
    if (this.firstDraw) {
      // Project all coordinates once on first draw
      this.zones.forEach((shape) => {
        this.projectZoneCoordinates(shape, project);
      });
    }
    
    if (this.firstDraw || this.prevZoom !== zoom) {
      // Only redraw graphics when zoom changes (for scale-dependent styles)
      this.zones.forEach((shape) => {
        this.redrawZoneGraphics(shape, scale);
      });
    }
    
    // Selection shapes don't need coordinate projection
    this.selectionShapes.forEach((shape) => {
      this.redrawSelectionShape(shape);
    });
    
    this.renderer.render(this.pixiContainer);
    
    this.firstDraw = false;
    this.prevZoom = zoom;
  }

  destroy(): void {
    if (!this.isInitialized) return;
    
    this.clear();
    this.pixiOverlay.destroy();
    this.map.remove();
    this.isInitialized = false;
  }

  worldToCanvas(x: number, y: number): Point {
    if (!this.utils) return { x: 0, y: 0 };
    
    const layerPoint = this.utils.latLngToLayerPoint([y, x]); // Note: lat/lng order
    return { x: layerPoint.x, y: layerPoint.y };
  }

  canvasToWorld(point: Point): [number, number] {
    if (!this.utils) return [0, 0];
    
    const latLng = this.utils.layerPointToLatLng({ x: point.x, y: point.y });
    return [latLng.lng, latLng.lat]; // Return as [longitude, latitude]
  }
  
  private leafletPointToCanvasPoint(leafletPoint: L.Point): Point {
    return { x: leafletPoint.x, y: leafletPoint.y };
  }

  getViewportBounds(): ViewportBounds {
    const bounds = this.map.getBounds();
    return {
      minX: bounds.getWest(),
      minY: bounds.getSouth(),
      maxX: bounds.getEast(),
      maxY: bounds.getNorth()
    };
  }

  setViewportBounds(bounds: ViewportBounds): void {
    const leafletBounds = L.latLngBounds(
      [bounds.minY, bounds.minX],
      [bounds.maxY, bounds.maxX]
    );
    this.map.fitBounds(leafletBounds);
  }

  getCanvasSize(): { width: number; height: number } {
    const size = this.map.getSize();
    return { width: size.x, height: size.y };
  }

  onMouseDown(handler: (event: MouseEvent) => void): () => void {
    this.mouseDownHandlers.push(handler);
    return () => {
      const index = this.mouseDownHandlers.indexOf(handler);
      if (index > -1) this.mouseDownHandlers.splice(index, 1);
    };
  }

  onMouseMove(handler: (event: MouseEvent) => void): () => void {
    this.mouseMoveHandlers.push(handler);
    return () => {
      const index = this.mouseMoveHandlers.indexOf(handler);
      if (index > -1) this.mouseMoveHandlers.splice(index, 1);
    };
  }

  onMouseUp(handler: (event: MouseEvent) => void): () => void {
    this.mouseUpHandlers.push(handler);
    return () => {
      const index = this.mouseUpHandlers.indexOf(handler);
      if (index > -1) this.mouseUpHandlers.splice(index, 1);
    };
  }

  onViewportChange(handler: () => void): () => void {
    this.viewportChangeHandlers.push(handler);
    return () => {
      const index = this.viewportChangeHandlers.indexOf(handler);
      if (index > -1) this.viewportChangeHandlers.splice(index, 1);
    };
  }

  getContainer(): HTMLElement {
    return this.containerElement;
  }

  clear(): void {
    // Remove all zones
    this.zones.clear();
    
    // Remove all selection shapes
    this.selectionShapes.clear();
    
    // Clear PIXI container
    this.pixiContainer.removeChildren();
    
    if (this.renderer) {
      this.renderer.render(this.pixiContainer);
    }
  }

  update(): void {
    if (this.renderer) {
      this.renderer.render(this.pixiContainer);
    }
  }

  renderZone(zoneId: string, geometry: { type: 'Point' | 'Polygon'; coordinates: number[] | number[][] }, style: RenderStyle): Shape {
    // Remove existing zone if it exists
    if (this.zones.has(zoneId)) {
      this.removeZone(zoneId);
    }
    
    // Create new PIXI Graphics object
    const pixiGraphics = new PIXI.Graphics();
    
    // Store geometry data for redraw operations
    const shape: LeafletPixiShape = {
      id: zoneId,
      pixiObject: pixiGraphics,
      data: { geometry, style }
    };
    
    // If utils are available, project coordinates immediately
    if (this.utils) {
      const project = this.utils.latLngToLayerPoint;
      this.projectZoneCoordinates(shape, project);
      
      const scale = this.utils.getScale();
      this.redrawZoneGraphics(shape, scale);
    }
    
    // Add to container and track
    this.pixiContainer.addChild(pixiGraphics);
    this.zones.set(zoneId, shape);
    this.update();
    
    return shape;
  }

  removeZone(zoneId: string): void {
    const shape = this.zones.get(zoneId);
    if (shape) {
      this.pixiContainer.removeChild(shape.pixiObject);
      this.zones.delete(zoneId);
      this.update();
    }
  }
  
  private projectZoneCoordinates(shape: LeafletPixiShape, project: (latLng: [number, number]) => L.Point): void {
    const geometry = shape.data.geometry;
    
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as number[];
      const projected = project([coords[1], coords[0]]);
      shape.projectedCoords = [{ x: projected.x, y: projected.y }];
    } else if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as number[][];
      
      if (coords.length > 0) {
        // Simplify polygon for performance
        const simplificationFactor = Math.max(1, Math.floor(coords.length / 500));
        const simplifiedCoords = coords.filter((_, index) => 
          index === 0 || index === coords.length - 1 || index % simplificationFactor === 0
        );
        
        // Project coordinates once and cache them
        shape.projectedCoords = simplifiedCoords.map(coord => {
          const projected = project([coord[1], coord[0]]);
          return { x: projected.x, y: projected.y };
        });
      } else {
        shape.projectedCoords = [];
      }
    }
  }
  
  private redrawZoneGraphics(shape: LeafletPixiShape, scale: number): void {
    if (!shape.projectedCoords) return;
    
    const graphics = shape.pixiObject;
    const style = shape.data.style;
    const geometry = shape.data.geometry;
    
    graphics.clear();
    this.applyStyleToPixiGraphics(graphics, style, scale);
    
    if (geometry.type === 'Point' && shape.projectedCoords.length > 0) {
      const point = shape.projectedCoords[0];
      graphics.drawCircle(point.x, point.y, 5 / scale);
      graphics.endFill();
    } else if (geometry.type === 'Polygon' && shape.projectedCoords.length > 0) {
      // Draw polygon using cached projected coordinates
      graphics.moveTo(shape.projectedCoords[0].x, shape.projectedCoords[0].y);
      
      for (let i = 1; i < shape.projectedCoords.length; i++) {
        graphics.lineTo(shape.projectedCoords[i].x, shape.projectedCoords[i].y);
      }
      
      graphics.closePath();
      graphics.endFill();
    }
  }
  
  private applyStyleToPixiGraphics(graphics: PIXI.Graphics, style: RenderStyle, scale: number): void {
    const fillColor = parseInt(style.fillColor.replace('#', ''), 16);
    const strokeColor = parseInt(style.strokeColor.replace('#', ''), 16);
    
    graphics.lineStyle(style.strokeWidth / scale, strokeColor, 1);
    graphics.beginFill(fillColor, style.opacity);
  }

  createSelectionShape(type: 'lasso' | 'path', startPoint: Point): SelectionShape {
    const id = `selection_${++this.selectionIdCounter}`;
    const pixiGraphics = new PIXI.Graphics();
    
    const shape: LeafletPixiSelectionShape = {
      id,
      type,
      points: [startPoint],
      pixiObject: pixiGraphics
    };
    
    this.pixiContainer.addChild(pixiGraphics);
    this.selectionShapes.set(id, shape);
    
    return shape;
  }

  updateSelectionShape(shape: SelectionShape, currentPoint: Point, startPoint: Point): void {
    const pixiShape = this.selectionShapes.get(shape.id);
    if (!pixiShape) return;
    
    if (shape.type === 'lasso') {
      // Add point to path for lasso
      shape.points.push(currentPoint);
    } else {
      // Path selection - just update end point
      shape.points = [startPoint, currentPoint];
    }
    
    this.redrawSelectionShape(pixiShape);
  }

  completeSelectionShape(shape: SelectionShape, startPoint: Point): void {
    const pixiShape = this.selectionShapes.get(shape.id);
    if (!pixiShape) return;
    
    if (shape.type === 'lasso') {
      // Close the lasso by connecting to start
      if (shape.points.length === 1) {
        // Zero-length drag - create small circle
        const radius = 10;
        shape.points = [
          { x: startPoint.x - radius, y: startPoint.y - radius },
          { x: startPoint.x + radius, y: startPoint.y - radius },
          { x: startPoint.x + radius, y: startPoint.y + radius },
          { x: startPoint.x - radius, y: startPoint.y + radius }
        ];
      } else {
        // Close the path
        shape.points.push(startPoint);
      }
    } else {
      // Path selection
      if (shape.points.length === 1) {
        // Zero-length drag - create small circle
        const radius = 10;
        shape.points = [
          { x: startPoint.x - radius, y: startPoint.y - radius },
          { x: startPoint.x + radius, y: startPoint.y - radius },
          { x: startPoint.x + radius, y: startPoint.y + radius },
          { x: startPoint.x - radius, y: startPoint.y + radius }
        ];
      }
    }
    
    this.redrawSelectionShape(pixiShape);
  }

  removeSelectionShape(shape: SelectionShape): void {
    const pixiShape = this.selectionShapes.get(shape.id);
    if (pixiShape) {
      this.pixiContainer.removeChild(pixiShape.pixiObject);
      this.selectionShapes.delete(shape.id);
      this.update();
    }
  }

  applySelectionStyle(shape: SelectionShape, style: SelectionStyle): void {
    const pixiShape = this.selectionShapes.get(shape.id);
    if (!pixiShape) return;
    
    const graphics = pixiShape.pixiObject;
    const strokeColor = parseInt(style.strokeColor.replace('#', ''), 16);
    
    // Apply style
    graphics.clear();
    graphics.lineStyle(style.strokeWidth, strokeColor, 1);
    
    if (style.fillColor) {
      const fillColor = parseInt(style.fillColor.replace('#', ''), 16);
      graphics.beginFill(fillColor, 0.2);
    }
    
    this.redrawSelectionShape(pixiShape);
  }
  
  private redrawSelectionShape(shape: LeafletPixiSelectionShape): void {
    const graphics = shape.pixiObject;
    
    if (shape.points.length < 2) return;
    
    graphics.moveTo(shape.points[0].x, shape.points[0].y);
    
    for (let i = 1; i < shape.points.length; i++) {
      graphics.lineTo(shape.points[i].x, shape.points[i].y);
    }
    
    if (shape.type === 'lasso' && shape.points.length > 2) {
      graphics.closePath();
    }
    
    graphics.endFill();
    this.update();
  }
  

  hitTest(point: Point): string | null {
    // Test against all zones
    for (const [zoneId, shape] of this.zones) {
      if (this.testPointInPixiGraphics(point, shape.pixiObject)) {
        return zoneId;
      }
    }
    return null;
  }
  
  private testPointInPixiGraphics(point: Point, graphics: PIXI.Graphics): boolean {
    return graphics.containsPoint(new PIXI.Point(point.x, point.y));
  }

  testIntersection(zoneId: string, selectionShape: SelectionShape): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return false;
    
    // Simple bounds intersection test for now
    const zoneBounds = zone.pixiObject.getBounds();
    
    // Get selection bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectionShape.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    return !(
      zoneBounds.right < minX ||
      zoneBounds.left > maxX ||
      zoneBounds.bottom < minY ||
      zoneBounds.top > maxY
    );
  }
  
  getZoomLevel(): number {
    return this.map.getZoom();
  }
}