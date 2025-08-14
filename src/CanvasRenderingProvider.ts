import paper from 'paper';
import { ViewportBounds } from './types';
import { RenderingProvider, Point, MouseEvent } from './RenderingProvider';

export class CanvasRenderingProvider implements RenderingProvider {
  private canvas: HTMLCanvasElement;
  private viewportBounds: ViewportBounds;
  private mouseDownHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseMoveHandlers: Array<(event: MouseEvent) => void> = [];
  private mouseUpHandlers: Array<(event: MouseEvent) => void> = [];
  private viewportChangeHandlers: Array<() => void> = [];
  private isInitialized = false;

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
    return {
      width: this.canvas.width,
      height: this.canvas.height
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

  hitTest(point: Point): string | null {
    if (!paper.project) return null;
    
    const paperPoint = new paper.Point(point.x, point.y);
    const hitResult = paper.project.hitTest(paperPoint);
    
    return hitResult?.item?.data?.zoneId || null;
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