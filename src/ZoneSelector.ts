import paper from 'paper';
import { Zone, ZoneSelectorConfig, DragMode } from './types';
import { SelectionStrategy, createSelectionStrategy } from './SelectionStrategy';
import { RenderingProvider, MouseEvent as ProviderMouseEvent } from './RenderingProvider';

export class ZoneSelector {
  private zones: Zone[];
  private currentCategory: string;
  private categories: string[];
  private onSelectionChange?: (selectedZones: Zone[]) => void;
  private onCategoryChange?: (category: string) => void;
  private provider: RenderingProvider;
  private zoneShapes: Map<string, paper.Path> = new Map();
  private dragMode: DragMode;
  private selectionStrategy: SelectionStrategy;
  
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
    this.provider = config.provider;
    this.dragMode = config.dragMode || 'lasso';
    this.selectionStrategy = createSelectionStrategy(this.dragMode);
    
    // Extract unique categories
    this.categories = [...new Set(this.zones.map(zone => zone.category))];
    this.currentCategory = this.categories[0] || '';
    
    // Initialize the rendering provider
    this.provider.initialize();
    
    // Initial render
    this.render();
    
    // Set up event handlers
    this.setupEventHandlers();
  }


  private setupEventHandlers(): void {
    // Track shift key state on document level to ensure it works
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    
    // Make the provider's container focusable
    const container = this.provider.getContainer();
    container.setAttribute('tabindex', '0');
    container.focus();
    
    // Set up provider-based event handlers
    this.provider.onMouseDown((event: ProviderMouseEvent) => {
      // Always prepare for potential drag selection
      this.dragStart = new paper.Point(event.point.x, event.point.y);
      
      // Store potential zone click for later
      const clickedZoneId = this.provider.hitTest?.(event.point) || null;
      
      // Store the clicked zone ID for mouse up handling
      this.clickedZoneId = clickedZoneId;
    });

    this.provider.onMouseMove((event: ProviderMouseEvent) => {
      if (!this.isDragging && this.dragStart) {
        // Start drag selection on first drag movement
        this.isDragging = true;
        this.createSelectionShape();
      }
      
      if (this.isDragging && this.dragStart && this.selectionShape) {
        this.updateSelectionShape(new paper.Point(event.point.x, event.point.y));
      }
    });

    this.provider.onMouseUp((_event: ProviderMouseEvent) => {
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
    });

    // Handle viewport changes (zoom, pan, resize)
    this.provider.onViewportChange(() => {
      this.render(); // Re-render all zones when viewport changes
    });
  }

  private render(): void {
    // Clear existing shapes
    paper.project.clear();
    this.zoneShapes.clear();

    // Only render zones from current category
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    
    console.log('Rendering', currentZones.length, 'zones from category:', this.currentCategory);
    console.log('Viewport bounds:', this.provider.getViewportBounds());
    console.log('Canvas size:', this.provider.getCanvasSize());
    
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
      const point = this.provider.worldToCanvas(x, y);
      console.log('Point zone:', zone.id, 'coords:', [x, y], 'canvas:', point);
      shape = new paper.Path.Circle(new paper.Point(point.x, point.y), 15);
    } else {
      const coords = zone.geometry.coordinates as number[][]; // Polygon: [points][x,y]
      shape = new paper.Path();
      
      console.log('Polygon zone:', zone.id, 'first coord:', coords[0]);
      
      coords.forEach(([x, y], index) => {
        const point = this.provider.worldToCanvas(x, y);
        const paperPoint = new paper.Point(point.x, point.y);
        if (index === 0) {
          shape.moveTo(paperPoint);
        } else {
          shape.lineTo(paperPoint);
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
    this.selectionShape = this.selectionStrategy.createShape(this.dragStart!);
    this.selectionStrategy.applyStyle(this.selectionShape, this.isShiftPressed);
  }
  
  private updateSelectionShape(currentPoint: paper.Point): void {
    if (!this.selectionShape || !this.dragStart) return;
    
    this.selectionStrategy.updateShape(this.selectionShape, currentPoint, this.dragStart);
    this.selectionStrategy.applyStyle(this.selectionShape, this.isShiftPressed);
  }

  private completeDragSelection(): void {
    if (!this.selectionShape || !this.dragStart) return;
    
    this.selectionStrategy.completeSelection(this.selectionShape, this.dragStart);
    
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
    return this.selectionStrategy.testIntersection(shape, selectionShape);
  }

  public toggleZoneSelection(zoneId: string): void {
    const zone = this.zones.find(z => z.id === zoneId);
    if (!zone) return;

    // Only allow toggling zones in the current category (visible zones)
    if (zone.category !== this.currentCategory) return;

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
    this.selectionStrategy = createSelectionStrategy(mode);
  }

  public getDragMode(): DragMode {
    return this.dragMode;
  }

  public destroy(): void {
    // Clean up provider
    this.provider.destroy();
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