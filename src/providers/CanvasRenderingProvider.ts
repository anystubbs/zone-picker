import paper from 'paper';
import { ViewportBounds } from '../types';
import { RenderingProvider, Point, MouseEvent, Shape, SelectionShape, RenderStyle, SelectionStyle } from './RenderingProvider';
import { lassoContainsShape, pathIntersectsShape } from '../IntersectionHelpers';

export class CanvasRenderingProvider implements RenderingProvider {
  private canvas: HTMLCanvasElement;
  private viewportBounds: ViewportBounds;
  private mouseDownHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseMoveHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseUpHandlers: Array<(event: MouseEvent) => void> = [];
  private viewportChangeHandlers: Array<() => void> = [];
  private isInitialized = false;
  
  // Internal shape management
  private zoneShapes: Map<string, paper.Path> = new Map();
  private selectionShapes: Map<string, paper.Path> = new Map();
  private nextSelectionId = 0;

  constructor(canvas: HTMLCanvasElement, viewportBounds: ViewportBounds) {
    this.canvas = canvas;
    this.viewportBounds = { ...viewportBounds };
  }

  initialize(): void {
    if (this.isInitialized) return;
    
    // Initialize Paper.js with our canvas
    paper.setup(this.canvas);
    
    // Make canvas focusable for keyboard events
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.focus();
    
    // Set up Paper.js event handling
    this.setupPaperEvents();
    
    this.isInitialized = true;
  }

  destroy(): void {
    if (!this.isInitialized) return;
    
    // Clear Paper.js project
    paper.project?.clear();
    
    // Clear handler arrays
    this.mouseDownHandlers.length = 0;
    this.mouseMoveHandlers.length = 0;
    this.mouseUpHandlers.length = 0;
    this.viewportChangeHandlers.length = 0;
    
    this.isInitialized = false;
  }

  worldToCanvas(x: number, y: number): Point {
    const canvasSize = this.getCanvasSize();
    const worldWidth = this.viewportBounds.maxX - this.viewportBounds.minX;
    const worldHeight = this.viewportBounds.maxY - this.viewportBounds.minY;
    
    const canvasX = ((x - this.viewportBounds.minX) / worldWidth) * canvasSize.width;
    const canvasY = canvasSize.height - ((y - this.viewportBounds.minY) / worldHeight) * canvasSize.height;
    
    return { x: canvasX, y: canvasY };
  }

  canvasToWorld(point: Point): [number, number] {
    const canvasSize = this.getCanvasSize();
    const worldWidth = this.viewportBounds.maxX - this.viewportBounds.minX;
    const worldHeight = this.viewportBounds.maxY - this.viewportBounds.minY;
    
    const worldX = this.viewportBounds.minX + (point.x / canvasSize.width) * worldWidth;
    const worldY = this.viewportBounds.minY + ((canvasSize.height - point.y) / canvasSize.height) * worldHeight;
    
    return [worldX, worldY];
  }

  getViewportBounds(): ViewportBounds {
    return { ...this.viewportBounds };
  }

  setViewportBounds(bounds: ViewportBounds): void {
    this.viewportBounds = { ...bounds };
    // Trigger viewport change handlers to update renderings
    this.viewportChangeHandlers.forEach(handler => handler());
  }

  getCanvasSize(): { width: number; height: number } {
    // Use the CSS display size, not the buffer size, for coordinate transformation
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  onMouseDown(handler: (event: MouseEvent) => void): () => void {
    this.mouseDownHandlers.push(handler);
    return () => {
      const index = this.mouseDownHandlers.indexOf(handler);
      if (index > -1) {
        this.mouseDownHandlers.splice(index, 1);
      }
    };
  }

  onMouseMove(handler: (event: MouseEvent) => void): () => void {
    this.mouseMoveHandlers.push(handler);
    return () => {
      const index = this.mouseMoveHandlers.indexOf(handler);
      if (index > -1) {
        this.mouseMoveHandlers.splice(index, 1);
      }
    };
  }

  onMouseUp(handler: (event: MouseEvent) => void): () => void {
    this.mouseUpHandlers.push(handler);
    return () => {
      const index = this.mouseUpHandlers.indexOf(handler);
      if (index > -1) {
        this.mouseUpHandlers.splice(index, 1);
      }
    };
  }

  onViewportChange(handler: () => void): () => void {
    this.viewportChangeHandlers.push(handler);
    return () => {
      const index = this.viewportChangeHandlers.indexOf(handler);
      if (index > -1) {
        this.viewportChangeHandlers.splice(index, 1);
      }
    };
  }

  // Rendering operations
  clear(): void {
    paper.project.clear();
    this.zoneShapes.clear();
    this.selectionShapes.clear();
  }
  
  update(): void {
    paper.view.update();
  }
  
  // Zone rendering
  renderZone(zoneId: string, geometry: { type: 'Point' | 'Polygon'; coordinates: number[] | number[][] }, style: RenderStyle): Shape {
    // Remove existing shape if it exists
    const existingShape = this.zoneShapes.get(zoneId);
    if (existingShape) {
      existingShape.remove();
    }
    
    let shape: paper.Path;

    if (geometry.type === 'Point') {
      const [x, y] = geometry.coordinates as number[];
      const point = this.worldToCanvas(x, y);
      shape = new paper.Path.Circle(new paper.Point(point.x, point.y), 15);
    } else {
      const coords = geometry.coordinates as number[][];
      shape = new paper.Path();
      
      coords.forEach(([x, y], index) => {
        const point = this.worldToCanvas(x, y);
        const paperPoint = new paper.Point(point.x, point.y);
        if (index === 0) {
          shape.moveTo(paperPoint);
        } else {
          shape.lineTo(paperPoint);
        }
      });
      
      shape.closePath();
    }

    // Apply style
    shape.fillColor = new paper.Color(style.fillColor);
    shape.fillColor.alpha = style.opacity;
    shape.strokeColor = new paper.Color(style.strokeColor);
    shape.strokeWidth = style.strokeWidth;

    // Store zone ID for hit detection
    shape.data = { zoneId };
    
    this.zoneShapes.set(zoneId, shape);
    
    return { id: zoneId, data: { zoneId } };
  }
  
  removeZone(zoneId: string): void {
    const shape = this.zoneShapes.get(zoneId);
    if (shape) {
      shape.remove();
      this.zoneShapes.delete(zoneId);
    }
  }
  
  // Selection shape operations
  createSelectionShape(type: 'lasso' | 'path', startPoint: Point): SelectionShape {
    const id = `selection_${this.nextSelectionId++}`;
    const paperPoint = new paper.Point(startPoint.x, startPoint.y);
    
    // Both lasso and path start the same way - as a path
    const shape = new paper.Path();
    shape.moveTo(paperPoint);
    
    this.selectionShapes.set(id, shape);
    
    return {
      id,
      type,
      points: [startPoint]
    };
  }
  
  updateSelectionShape(shape: SelectionShape, currentPoint: Point, _startPoint: Point): void {
    const paperShape = this.selectionShapes.get(shape.id);
    if (!paperShape) return;
    
    // Both lasso and path draw the same way - just add points to the path
    paperShape.lineTo(new paper.Point(currentPoint.x, currentPoint.y));
    shape.points.push(currentPoint);
  }
  
  completeSelectionShape(shape: SelectionShape, startPoint: Point): void {
    const paperShape = this.selectionShapes.get(shape.id);
    if (!paperShape) return;
    
    // Check if it's a zero-length drag (single point click)
    if (shape.points.length === 1) {
      // Create small circular area for click selection
      paperShape.remove();
      const circle = new paper.Path.Circle(new paper.Point(startPoint.x, startPoint.y), 10);
      this.selectionShapes.set(shape.id, circle);
    } else if (shape.type === 'lasso') {
      // Close the lasso path to create an enclosed area
      paperShape.lineTo(new paper.Point(startPoint.x, startPoint.y));
      paperShape.closePath();
    }
    // Path doesn't close - it remains an open path for intersection testing
  }
  
  removeSelectionShape(shape: SelectionShape): void {
    const paperShape = this.selectionShapes.get(shape.id);
    if (paperShape) {
      paperShape.remove();
      this.selectionShapes.delete(shape.id);
    }
  }
  
  applySelectionStyle(shape: SelectionShape, style: SelectionStyle): void {
    const paperShape = this.selectionShapes.get(shape.id);
    if (!paperShape) return;
    
    paperShape.strokeColor = new paper.Color(style.strokeColor);
    paperShape.strokeWidth = style.strokeWidth;
    if (style.dashArray) {
      paperShape.dashArray = style.dashArray;
    }
    if (style.fillColor) {
      paperShape.fillColor = new paper.Color(style.fillColor);
    }
  }
  
  // Hit testing
  hitTest(point: Point): string | null {
    if (!paper.project) return null;
    
    const paperPoint = new paper.Point(point.x, point.y);
    const hitResult = paper.project.hitTest(paperPoint);
    
    return hitResult?.item?.data?.zoneId || null;
  }
  
  // Intersection testing
  testIntersection(zoneId: string, selectionShape: SelectionShape): boolean {
    const zoneShape = this.zoneShapes.get(zoneId);
    const selShape = this.selectionShapes.get(selectionShape.id);
    
    if (!zoneShape || !selShape) {
      return false;
    }
    
    if (selectionShape.type === 'lasso') {
      return lassoContainsShape(selShape, zoneShape);
    } else {
      return pathIntersectsShape(selShape, zoneShape);
    }
  }

  getContainer(): HTMLElement {
    return this.canvas;
  }

  private setupPaperEvents(): void {
    if (!paper.view) return;

    paper.view.onMouseDown = (event: paper.MouseEvent) => {
      const worldCoords = this.canvasToWorld({ x: event.point.x, y: event.point.y });
      const mouseEvent: MouseEvent = {
        point: { x: event.point.x, y: event.point.y },
        worldCoordinates: worldCoords,
        originalEvent: (event as any).event || new Event('mouse')
      };
      
      this.mouseDownHandlers.forEach(handler => handler(mouseEvent));
    };

    paper.view.onMouseDrag = (event: paper.MouseEvent) => {
      const worldCoords = this.canvasToWorld({ x: event.point.x, y: event.point.y });
      const mouseEvent: MouseEvent = {
        point: { x: event.point.x, y: event.point.y },
        worldCoordinates: worldCoords,
        originalEvent: (event as any).event || new Event('mouse')
      };
      
      this.mouseMoveHandlers.forEach(handler => handler(mouseEvent));
    };

    paper.view.onMouseUp = (event: paper.MouseEvent) => {
      const worldCoords = this.canvasToWorld({ x: event.point.x, y: event.point.y });
      const mouseEvent: MouseEvent = {
        point: { x: event.point.x, y: event.point.y },
        worldCoordinates: worldCoords,
        originalEvent: (event as any).event || new Event('mouse')
      };
      
      this.mouseUpHandlers.forEach(handler => handler(mouseEvent));
    };
  }
}