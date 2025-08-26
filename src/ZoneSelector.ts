import { Zone, ZoneSelectorConfig, DragMode, CategoryConfig } from './types';
import { SelectionStrategy, createSelectionStrategy } from './SelectionStrategy';
import { RenderingProvider, MouseEvent as ProviderMouseEvent, Point, SelectionShape, RenderStyle } from './providers';

export class ZoneSelector {
  private zones: Zone[];
  private currentCategory: string;
  private currentVariant: string = '';
  private categories: string[];
  private categoryConfigs: Map<string, CategoryConfig>;
  private onSelectionChange?: (selectedZones: Zone[]) => void;
  private onCategoryChange?: (category: string, variant: string) => void;
  private provider: RenderingProvider;
  private dragMode: DragMode;
  private selectionStrategy: SelectionStrategy;
  
  // Drag selection state
  private isDragging: boolean = false;
  private dragStart: Point | null = null;
  private selectionShape: SelectionShape | null = null;
  private clickedZoneId: string | null = null;
  private isShiftPressed: boolean = false;

  constructor(config: ZoneSelectorConfig) {
    this.zones = [...config.zones];
    this.onSelectionChange = config.onSelectionChange;
    this.onCategoryChange = config.onCategoryChange;
    this.provider = config.provider;
    this.dragMode = config.dragMode || 'lasso';
    this.selectionStrategy = createSelectionStrategy(this.dragMode);
    
    // Set up category configs
    this.categoryConfigs = new Map();
    if (config.categories) {
      config.categories.forEach(c => this.categoryConfigs.set(c.id, c));
    }
    
    // Extract unique categories
    this.categories = [...new Set(this.zones.map(zone => zone.category))];
    this.currentCategory = this.categories[0] || '';
    
    // Set initial variant for current category
    this.updateVariantForZoom();
    
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
      // Only handle selection when Ctrl key is pressed (for Leaflet provider)
      const isCtrlPressed = event.originalEvent && (event.originalEvent as any).ctrlKey;
      if (!isCtrlPressed && this.provider.constructor.name === 'LeafletRenderingProvider') {
        return; // Let Leaflet handle normal map interaction
      }
      
      // Always prepare for potential drag selection
      this.dragStart = { x: event.point.x, y: event.point.y };
      
      // Store potential zone click for later
      const clickedZoneId = this.provider.hitTest(event.point);
      
      // Store the clicked zone ID for mouse up handling
      this.clickedZoneId = clickedZoneId;
    });

    this.provider.onMouseMove((event: ProviderMouseEvent) => {
      // Only handle selection when Ctrl key is pressed (for Leaflet provider)
      const isCtrlPressed = event.originalEvent && (event.originalEvent as any).ctrlKey;
      if (!isCtrlPressed && this.provider.constructor.name === 'LeafletRenderingProvider') {
        return; // Let Leaflet handle normal map interaction
      }
      
      if (!this.isDragging && this.dragStart) {
        // Start drag selection on first drag movement
        this.isDragging = true;
        this.createSelectionShape();
      }
      
      if (this.isDragging && this.dragStart && this.selectionShape) {
        this.updateSelectionShape({ x: event.point.x, y: event.point.y });
      }
    });

    this.provider.onMouseUp((event: ProviderMouseEvent) => {
      // Only handle selection when Ctrl key is pressed (for Leaflet provider)
      const isCtrlPressed = event.originalEvent && (event.originalEvent as any).ctrlKey;
      if (!isCtrlPressed && this.provider.constructor.name === 'LeafletRenderingProvider') {
        return; // Let Leaflet handle normal map interaction
      }
      
      if (this.isDragging && this.dragStart && this.selectionShape) {
        // Complete drag selection
        this.completeDragSelection();
        
        // Clean up drag selection
        this.provider.removeSelectionShape(this.selectionShape);
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
      // Check if we need to switch variants based on zoom
      this.updateVariantForZoom();
      
      // Re-render (with viewport culling)
      this.render();
    });
  }

  private render(): void {
    // Clear existing shapes
    this.provider.clear();

    // Get viewport bounds for culling
    const viewportBounds = this.provider.getViewportBounds();
    
    // Filter zones: correct category/variant AND in viewport
    const visibleZones = this.zones.filter(zone => {
      // Category/variant filtering
      if (zone.category !== this.currentCategory) return false;
      if (this.currentVariant && zone.variant !== this.currentVariant) return false;
      
      // Viewport culling
      const zoneBounds = zone.getBounds();
      return !(
        zoneBounds.maxX < viewportBounds.minX ||
        zoneBounds.minX > viewportBounds.maxX ||
        zoneBounds.maxY < viewportBounds.minY ||
        zoneBounds.minY > viewportBounds.maxY
      );
    });
    
    // Render only visible zones
    visibleZones.forEach(zone => {
      this.renderZone(zone);
    });

    this.provider.update();
  }

  private renderZone(zone: Zone): void {
    const style: RenderStyle = {
      fillColor: zone.selected ? '#3399ff' : '#cccccc',
      strokeColor: '#333333',
      strokeWidth: 2,
      opacity: zone.selected ? 0.6 : 0.3
    };
    
    
    this.provider.renderZone(zone.id, zone.geometry, style);
  }

  private createSelectionShape(): void {
    this.selectionShape = this.selectionStrategy.createShape(this.provider, this.dragStart!);
    this.selectionStrategy.applyStyle(this.provider, this.selectionShape, this.isShiftPressed);
  }
  
  private updateSelectionShape(currentPoint: Point): void {
    if (!this.selectionShape || !this.dragStart) return;
    
    this.selectionStrategy.updateShape(this.provider, this.selectionShape, currentPoint, this.dragStart);
    this.selectionStrategy.applyStyle(this.provider, this.selectionShape, this.isShiftPressed);
  }

  private completeDragSelection(): void {
    if (!this.selectionShape || !this.dragStart) return;
    
    this.selectionStrategy.completeSelection(this.provider, this.selectionShape, this.dragStart);
    
    if (this.isShiftPressed) {
      console.log('Shift+drag detected - deselecting zones');
      this.deselectZonesInShape(this.selectionShape);
    } else {
      console.log('Normal drag - selecting zones');
      this.selectZonesInShape(this.selectionShape);
    }
  }
  
  private selectZonesInShape(selectionShape: SelectionShape): void {
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    let selectionChanged = false;
    
    currentZones.forEach(zone => {
      if (this.shapeIntersectsSelection(zone.id, selectionShape) && !zone.selected) {
        zone.selected = true;
        selectionChanged = true;
        this.renderZone(zone); // Re-render with selected style
      }
    });
    
    if (selectionChanged && this.onSelectionChange) {
      const selectedZones = this.zones.filter(z => z.selected);
      this.onSelectionChange(selectedZones);
    }
  }
  
  private deselectZonesInShape(selectionShape: SelectionShape): void {
    const currentZones = this.zones.filter(zone => zone.category === this.currentCategory);
    let selectionChanged = false;
    
    currentZones.forEach(zone => {
      if (this.shapeIntersectsSelection(zone.id, selectionShape) && zone.selected) {
        zone.selected = false;
        selectionChanged = true;
        this.renderZone(zone); // Re-render with unselected style
      }
    });
    
    if (selectionChanged && this.onSelectionChange) {
      const selectedZones = this.zones.filter(z => z.selected);
      this.onSelectionChange(selectedZones);
    }
  }
  
  private shapeIntersectsSelection(zoneId: string, selectionShape: SelectionShape): boolean {
    return this.selectionStrategy.testIntersection(this.provider, zoneId, selectionShape);
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

  // Variant management methods
  private updateVariantForZoom(): void {
    const config = this.categoryConfigs.get(this.currentCategory);
    if (!config || !config.autoSwitch) return;
    
    // Get current zoom from provider if it supports it
    const zoom = this.provider.getZoomLevel?.() || 0;
    
    // Find first matching variant
    for (const variant of config.variants) {
      if ((!variant.minZoom || zoom >= variant.minZoom) && 
          (!variant.maxZoom || zoom <= variant.maxZoom)) {
        if (this.currentVariant !== variant.id) {
          this.currentVariant = variant.id;
          this.render(); // Re-render with new variant
        }
        return;
      }
    }
    
    // Default to first variant
    const firstVariant = config.variants[0]?.id || '';
    if (this.currentVariant !== firstVariant) {
      this.currentVariant = firstVariant;
      this.render();
    }
  }

  public setCategory(categoryId: string, variantId?: string): void {
    if (!this.categories.includes(categoryId)) return;
    
    this.currentCategory = categoryId;
    if (variantId) {
      this.currentVariant = variantId;
    } else {
      this.updateVariantForZoom();
    }
    this.render();
    
    if (this.onCategoryChange) {
      this.onCategoryChange(categoryId, this.currentVariant);
    }
  }

  public setVariant(variantId: string): void {
    this.currentVariant = variantId;
    this.render();
  }

  public getCategories(): string[] {
    return [...this.categories];
  }

  public getCurrentCategory(): string {
    return this.currentCategory;
  }

  public getCurrentVariant(): string {
    return this.currentVariant;
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