import * as paper from 'paper';
import { Zone, ZoneSelectorConfig, ViewportBounds } from './types';

export class ZoneSelector {
  private paper: paper.PaperScope;
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
    
    // Extract unique categories
    this.categories = [...new Set(this.zones.map(zone => zone.category))];
    this.currentCategory = this.categories[0] || '';
    
    // Initialize Paper.js with the provided canvas
    this.paper = new paper.PaperScope();
    this.paper.setup(config.canvas);
    
    // Calculate initial viewport bounds
    this.viewportBounds = this.calculateViewportBounds();
    
    // Initial render
    this.render();
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  private calculateViewportBounds(): ViewportBounds {
    const coords = this.zones.flatMap(zone => {
      if (zone.geometry.type === 'Point') {
        return [zone.geometry.coordinates as number[]];
      } else {
        return zone.geometry.coordinates as number[][];
      }
    }).flat();

    const x_coords = coords.filter((_, i) => i % 2 === 0);
    const y_coords = coords.filter((_, i) => i % 2 === 1);

    return {
      minX: Math.min(...x_coords),
      minY: Math.min(...y_coords),
      maxX: Math.max(...x_coords),
      maxY: Math.max(...y_coords)
    };
  }

  private setupEventHandlers(): void {
    this.paper.view.onMouseDown = (event: paper.MouseEvent) => {
      const hitResult = this.paper.project.hitTest(event.point);
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
    this.paper.project.clear();
    this.zoneShapes.clear();

    // Only render zones from current category
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    
    currentZones.forEach(zone => {
      this.renderZone(zone);
    });

    this.paper.view.update();
  }

  private renderZone(zone: Zone): void {
    let shape: paper.Path;

    if (zone.geometry.type === 'Point') {
      const [x, y] = zone.geometry.coordinates as number[];
      const point = this.worldToCanvas(x, y);
      shape = new this.paper.Path.Circle(point, 10);
    } else {
      const coords = zone.geometry.coordinates as number[][];
      const pathData = coords.map(([x, y], index) => {
        const point = this.worldToCanvas(x, y);
        return index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`;
      }).join(' ') + 'Z';
      
      shape = new this.paper.Path(pathData);
    }

    // Style the zone based on selection state
    shape.fillColor = zone.selected 
      ? new this.paper.Color(0.2, 0.6, 1, 0.6) 
      : new this.paper.Color(0.8, 0.8, 0.8, 0.3);
    
    shape.strokeColor = new this.paper.Color(0.2, 0.2, 0.2);
    shape.strokeWidth = 1;

    // Store zone ID for hit detection
    shape.data = { zoneId: zone.id };
    
    this.zoneShapes.set(zone.id, shape);
  }

  private worldToCanvas(x: number, y: number): paper.Point {
    const canvasWidth = this.paper.view.size.width;
    const canvasHeight = this.paper.view.size.height;
    
    const worldWidth = this.viewportBounds.maxX - this.viewportBounds.minX;
    const worldHeight = this.viewportBounds.maxY - this.viewportBounds.minY;
    
    const canvasX = ((x - this.viewportBounds.minX) / worldWidth) * canvasWidth;
    const canvasY = canvasHeight - ((y - this.viewportBounds.minY) / worldHeight) * canvasHeight;
    
    return new this.paper.Point(canvasX, canvasY);
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
    this.paper.project.clear();
    this.zoneShapes.clear();
  }
}