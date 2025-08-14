import paper from 'paper';
import { Zone, ZoneSelectorConfig, ViewportBounds, DragMode } from './types';
import { worldToCanvas, lassoContainsShape, pathIntersectsShape } from './geometry/IntersectionHelpers';

export class ZoneSelector {
  private zones: Zone[];
  private currentCategory: string;
  private categories: string[];
  private onSelectionChange?: (selectedZones: Zone[]) => void;
  private onCategoryChange?: (category: string) => void;
  private viewportBounds: ViewportBounds;
  private zoneShapes: Map<string, paper.Path> = new Map();
  private dragMode: DragMode;
  
  // Drag selection state
  private isDragging: boolean = false;
  private dragStart: paper.Point | null = null;
  private selectionShape: paper.Path | null = null; // Can be rectangle or draw path
  private clickedZoneId: string | null = null;
  private isShiftPressed: boolean = false;

  constructor(config: ZoneSelectorConfig) {
    this.zones = [...config.zones];
    this.onSelectionChange = config.onSelectionChange;
    this.onCategoryChange = config.onCategoryChange;
    this.viewportBounds = config.viewport;
    this.dragMode = config.dragMode || 'rectangle';
    
    // Extract unique categories
    this.categories = [...new Set(this.zones.map(zone => zone.category))];
    this.currentCategory = this.categories[0] || '';
    
    // Initialize Paper.js with the provided canvas
    paper.setup(config.canvas);
    
    // Initial render
    this.render();
    
    // Set up event handlers
    this.setupEventHandlers();
  }


  private setupEventHandlers(): void {
    // Track shift key state on document level to ensure it works
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    
    // Also make the canvas focusable and give it focus
    paper.view.element.setAttribute('tabindex', '0');
    paper.view.element.focus();
    
    paper.view.onMouseDown = (event: paper.MouseEvent) => {
      // Always prepare for potential drag selection
      this.dragStart = event.point.clone();
      
      // Store potential zone click for later
      const hitResult = paper.project.hitTest(event.point);
      const clickedZoneId = hitResult?.item?.data.zoneId || null;
      
      // Store the clicked zone ID for mouse up handling
      this.clickedZoneId = clickedZoneId;
    };

    paper.view.onMouseDrag = (event: paper.MouseEvent) => {
      if (!this.isDragging && this.dragStart) {
        // Start drag selection on first drag movement
        this.isDragging = true;
        this.createSelectionShape();
      }
      
      if (this.isDragging && this.dragStart && this.selectionShape) {
        this.updateSelectionShape(event.point);
      }
    };

    paper.view.onMouseUp = (_event: paper.MouseEvent) => {
      if (this.isDragging && this.dragStart && this.selectionShape) {
        // Complete drag selection
        this.completeDragSelection();
        
        // Clean up drag selection
        this.selectionShape.remove();
        this.selectionShape = null;
      } else if (!this.isDragging && this.clickedZoneId) {
        // Handle single zone click (no drag occurred)
        this.toggleZoneSelection(this.clickedZoneId);
      }
      
      // Reset drag state
      this.isDragging = false;
      this.dragStart = null;
      this.clickedZoneId = null;
    };
  }

  private render(): void {
    // Clear existing shapes
    paper.project.clear();
    this.zoneShapes.clear();

    // Only render zones from current category
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    
    console.log('Rendering', currentZones.length, 'zones from category:', this.currentCategory);
    console.log('Viewport bounds:', this.viewportBounds);
    console.log('Canvas size:', paper.view.size);
    
    currentZones.forEach(zone => {
      this.renderZone(zone);
    });

    paper.view.update();
  }

  private renderZone(zone: Zone): void {
    // Remove existing shape if it exists
    const existingShape = this.zoneShapes.get(zone.id);
    if (existingShape) {
      existingShape.remove();
    }
    
    let shape: paper.Path;

    if (zone.geometry.type === 'Point') {
      const [x, y] = zone.geometry.coordinates as number[];
      const point = worldToCanvas(x, y, this.viewportBounds, paper.view.size);
      console.log('Point zone:', zone.id, 'coords:', [x, y], 'canvas:', point);
      shape = new paper.Path.Circle(point, 15);
    } else {
      const coords = zone.geometry.coordinates as number[][]; // Polygon: [points][x,y]
      shape = new paper.Path();
      
      console.log('Polygon zone:', zone.id, 'first coord:', coords[0]);
      
      coords.forEach(([x, y], index) => {
        const point = worldToCanvas(x, y, this.viewportBounds, paper.view.size);
        if (index === 0) {
          shape.moveTo(point);
        } else {
          shape.lineTo(point);
        }
      });
      
      shape.closePath();
    }

    // Style the zone based on selection state
    shape.fillColor = zone.selected 
      ? new paper.Color(0.2, 0.6, 1, 0.6) 
      : new paper.Color(0.8, 0.8, 0.8, 0.3);
    
    shape.strokeColor = new paper.Color(0.2, 0.2, 0.2);
    shape.strokeWidth = 2;

    // Store zone ID for hit detection
    shape.data = { zoneId: zone.id };
    
    this.zoneShapes.set(zone.id, shape);
  }

  private createSelectionShape(): void {
    if (this.dragMode === 'rectangle') {
      // Create rectangle selection
      this.selectionShape = new paper.Path.Rectangle(
        this.dragStart!, 
        this.dragStart!
      );
    } else {
      // Create lasso/path selection (both use path, different intersection logic)
      this.selectionShape = new paper.Path();
      this.selectionShape.moveTo(this.dragStart!);
    }
    
    this.applySelectionStyle();
  }
  
  private updateSelectionShape(currentPoint: paper.Point): void {
    if (!this.selectionShape || !this.dragStart) return;
    
    if (this.dragMode === 'rectangle') {
      // Update rectangle
      const rectangle = new paper.Rectangle(this.dragStart, currentPoint);
      this.selectionShape.remove();
      this.selectionShape = new paper.Path.Rectangle(rectangle);
      this.applySelectionStyle();
    } else {
      // Update lasso/path selection
      this.selectionShape.lineTo(currentPoint);
      this.selectionShape.strokeColor = this.isShiftPressed 
        ? new paper.Color(1, 0.2, 0.2) 
        : new paper.Color(0.2, 0.6, 1);
    }
  }
  
  private applySelectionStyle(): void {
    if (!this.selectionShape) return;
    
    if (this.isShiftPressed) {
      // Red styling for deselection
      this.selectionShape.strokeColor = new paper.Color(1, 0.2, 0.2);
      if (this.dragMode === 'rectangle') {
        this.selectionShape.fillColor = new paper.Color(1, 0.2, 0.2, 0.1);
      }
    } else {
      // Blue styling for selection
      this.selectionShape.strokeColor = new paper.Color(0.2, 0.6, 1);
      if (this.dragMode === 'rectangle') {
        this.selectionShape.fillColor = new paper.Color(0.2, 0.6, 1, 0.1);
      }
    }
    
    // Different stroke styles for different modes
    if (this.dragMode === 'rectangle') {
      this.selectionShape.strokeWidth = 2;
      this.selectionShape.dashArray = [5, 5];
    } else if (this.dragMode === 'lasso') {
      this.selectionShape.strokeWidth = 4;
      this.selectionShape.dashArray = [8, 4]; // Thick dashed line for lasso area selection
    } else { // path mode
      this.selectionShape.strokeWidth = 3;
      this.selectionShape.dashArray = []; // Solid line for path intersection
    }
  }
  
  private completeDragSelection(): void {
    if (!this.selectionShape) return;
    
    // Close the lasso path to create a proper enclosed area
    if (this.dragMode === 'lasso' && this.dragStart) {
      this.selectionShape.lineTo(this.dragStart);
      this.selectionShape.closePath();
    }
    
    if (this.isShiftPressed) {
      console.log('Shift+drag detected - deselecting zones');
      this.deselectZonesInShape(this.selectionShape);
    } else {
      console.log('Normal drag - selecting zones');
      this.selectZonesInShape(this.selectionShape);
    }
  }
  
  private selectZonesInShape(selectionShape: paper.Path): void {
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    let selectionChanged = false;
    
    currentZones.forEach(zone => {
      const shape = this.zoneShapes.get(zone.id);
      if (shape && this.shapeIntersectsSelection(shape, selectionShape) && !zone.selected) {
        zone.selected = true;
        selectionChanged = true;
        shape.fillColor = new paper.Color(0.2, 0.6, 1, 0.6);
      }
    });
    
    if (selectionChanged && this.onSelectionChange) {
      const selectedZones = this.zones.filter(z => z.selected);
      this.onSelectionChange(selectedZones);
    }
  }
  
  private deselectZonesInShape(selectionShape: paper.Path): void {
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    let selectionChanged = false;
    
    currentZones.forEach(zone => {
      const shape = this.zoneShapes.get(zone.id);
      if (shape && this.shapeIntersectsSelection(shape, selectionShape) && zone.selected) {
        zone.selected = false;
        selectionChanged = true;
        shape.fillColor = new paper.Color(0.8, 0.8, 0.8, 0.3);
      }
    });
    
    if (selectionChanged && this.onSelectionChange) {
      const selectedZones = this.zones.filter(z => z.selected);
      this.onSelectionChange(selectedZones);
    }
  }
  
  private shapeIntersectsSelection(shape: paper.Path, selectionShape: paper.Path): boolean {
    if (this.dragMode === 'rectangle') {
      // Rectangle mode: use bounds intersection
      return shape.bounds.intersects(selectionShape.bounds) || 
             selectionShape.bounds.contains(shape.bounds);
    } else if (this.dragMode === 'lasso') {
      // Lasso mode: check if zone is actually contained within the lasso area
      return lassoContainsShape(selectionShape, shape);
    } else {
      // Path mode: check if the drawn line actually intersects the zone shape
      return pathIntersectsShape(selectionShape, shape);
    }
  }

  public toggleZoneSelection(zoneId: string): void {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone) return;

    zone.selected = !zone.selected;
    
    // Update visual representation
    this.renderZone(zone);
    
    // Trigger callback
    if (this.onSelectionChange) {
      const selectedZones = this.zones.filter(z => z.selected);
      this.onSelectionChange(selectedZones);
    }
  }

  public setCategory(category: string): void {
    if (!this.categories.includes(category)) return;
    
    this.currentCategory = category;
    this.render();
    
    if (this.onCategoryChange) {
      this.onCategoryChange(category);
    }
  }

  public getCategories(): string[] {
    return [...this.categories];
  }

  public getCurrentCategory(): string {
    return this.currentCategory;
  }

  public getSelectedZones(): Zone[] {
    return this.zones.filter(zone => zone.selected);
  }

  public clearSelection(): void {
    this.zones.forEach(zone => zone.selected = false);
    this.render();
    
    if (this.onSelectionChange) {
      this.onSelectionChange([]);
    }
  }

  public isShiftKeyPressed(): boolean {
    return this.isShiftPressed;
  }

  public setDragMode(mode: DragMode): void {
    this.dragMode = mode;
  }

  public getDragMode(): DragMode {
    return this.dragMode;
  }

  public destroy(): void {
    paper.project.clear();
    this.zoneShapes.clear();
    
    // Clean up event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }
  
  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      this.isShiftPressed = true;
      console.log('Shift pressed - deselection mode active');
    }
  };
  
  private handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      this.isShiftPressed = false;
      console.log('Shift released - selection mode active');
    }
  };
}