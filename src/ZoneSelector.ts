import paper from 'paper';
import { Zone, ZoneSelectorConfig, ViewportBounds } from './types';

export class ZoneSelector {
  private zones: Zone[];
  private currentCategory: string;
  private categories: string[];
  private onSelectionChange?: (selectedZones: Zone[]) => void;
  private onCategoryChange?: (category: string) => void;
  private viewportBounds: ViewportBounds;
  private zoneShapes: Map<string, paper.Path> = new Map();

  constructor(config: ZoneSelectorConfig) {
    this.zones = [...config.zones];
    this.onSelectionChange = config.onSelectionChange;
    this.onCategoryChange = config.onCategoryChange;
    this.viewportBounds = config.viewport;
    
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
    paper.view.onMouseDown = (event: paper.MouseEvent) => {
      const hitResult = paper.project.hitTest(event.point);
      if (hitResult?.item) {
        const zoneId = hitResult.item.data.zoneId;
        if (zoneId) {
          this.toggleZoneSelection(zoneId);
        }
      }
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
    let shape: paper.Path;

    if (zone.geometry.type === 'Point') {
      const [x, y] = zone.geometry.coordinates as number[];
      const point = this.worldToCanvas(x, y);
      console.log('Point zone:', zone.id, 'coords:', [x, y], 'canvas:', point);
      shape = new paper.Path.Circle(point, 15);
    } else {
      const coords = zone.geometry.coordinates as number[][]; // Polygon: [points][x,y]
      shape = new paper.Path();
      
      console.log('Polygon zone:', zone.id, 'first coord:', coords[0]);
      
      coords.forEach(([x, y], index) => {
        const point = this.worldToCanvas(x, y);
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

  private worldToCanvas(x: number, y: number): paper.Point {
    const canvasWidth = paper.view.size.width;
    const canvasHeight = paper.view.size.height;
    
    const worldWidth = this.viewportBounds.maxX - this.viewportBounds.minX;
    const worldHeight = this.viewportBounds.maxY - this.viewportBounds.minY;
    
    const canvasX = ((x - this.viewportBounds.minX) / worldWidth) * canvasWidth;
    const canvasY = canvasHeight - ((y - this.viewportBounds.minY) / worldHeight) * canvasHeight;
    
    return new paper.Point(canvasX, canvasY);
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

  public destroy(): void {
    paper.project.clear();
    this.zoneShapes.clear();
  }
}