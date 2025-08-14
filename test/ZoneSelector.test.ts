import { describe, it, expect, beforeEach, vi } from 'vitest';
import paper from 'paper';
import { ZoneSelector } from '../src/ZoneSelector';
import { CanvasRenderingProvider } from '../src/CanvasRenderingProvider';
import { Zone, ViewportBounds } from '../src/types';

describe('ZoneSelector', () => {
  let canvas: HTMLCanvasElement;
  let mockZones: Zone[];
  let viewport: ViewportBounds;
  let selector: ZoneSelector;

  beforeEach(() => {
    canvas = createTestCanvas();
    
    mockZones = [
      {
        id: 'zone1',
        name: 'Zone 1',
        category: 'h3-3',
        geometry: {
          type: 'Polygon',
          coordinates: [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        },
        selected: false
      },
      {
        id: 'zone2', 
        name: 'Zone 2',
        category: 'h3-3',
        geometry: {
          type: 'Point',
          coordinates: [2, 2]
        },
        selected: false
      },
      {
        id: 'zone3',
        name: 'Zone 3', 
        category: 'h3-4',
        geometry: {
          type: 'Polygon',
          coordinates: [[3, 3], [4, 3], [4, 4], [3, 4]]
        },
        selected: true
      }
    ];

    viewport = {
      minX: -5,
      maxX: 5,
      minY: -5,
      maxY: 5
    };
  });

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      const onSelectionChange = vi.fn();
      const onCategoryChange = vi.fn();

      const provider = new CanvasRenderingProvider(canvas, viewport);
      selector = new ZoneSelector({
        provider,
        zones: mockZones,
        dragMode: 'lasso',
        onSelectionChange,
        onCategoryChange
      });

      expect(selector.getDragMode()).toBe('lasso');
      expect(selector.getCategories()).toEqual(['h3-3', 'h3-4']);
      expect(selector.getCurrentCategory()).toBe('h3-3');
    });

    it('should default to lasso drag mode', () => {
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones
      });

      expect(selector.getDragMode()).toBe('lasso');
    });

    it('should handle empty zones array gracefully', () => {
      expect(() => {
        selector = new ZoneSelector({
          provider: new CanvasRenderingProvider(canvas, viewport),
          zones: []
        });
      }).not.toThrow();

      expect(selector.getCategories()).toEqual([]);
      expect(selector.getSelectedZones()).toEqual([]);
    });
  });

  describe('Zone Selection Behavior', () => {
    beforeEach(() => {
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones
      });
    });

    it('should toggle zone selection on click', () => {
      const onSelectionChange = vi.fn();
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones,
        onSelectionChange
      });

      // Toggle zone1 to selected
      selector.toggleZoneSelection('zone1');
      
      let selectedZones = selector.getSelectedZones();
      expect(selectedZones.some(z => z.id === 'zone1')).toBe(true);
      expect(onSelectionChange).toHaveBeenCalledWith(selectedZones);

      // Toggle zone1 back to unselected
      selector.toggleZoneSelection('zone1');
      
      selectedZones = selector.getSelectedZones();
      expect(selectedZones.some(z => z.id === 'zone1')).toBe(false);
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
    });

    it('should only select zones from current category', () => {
      // Set to h3-3 category (zone1, zone2)
      selector.setCategory('h3-3');
      
      // Try to toggle zone3 which is in h3-4 category
      const initialSelectedCount = selector.getSelectedZones().length;
      selector.toggleZoneSelection('zone3');
      
      // Should not change because zone3 is not in current category
      expect(selector.getSelectedZones().length).toBe(initialSelectedCount);
      
      // But zone1 should be toggleable
      selector.toggleZoneSelection('zone1');
      expect(selector.getSelectedZones().some(z => z.id === 'zone1')).toBe(true);
    });

    it('should handle invalid zone id gracefully', () => {
      const initialSelectedCount = selector.getSelectedZones().length;
      
      selector.toggleZoneSelection('nonexistent-zone');
      
      expect(selector.getSelectedZones().length).toBe(initialSelectedCount);
    });
  });

  describe('Selection State Management', () => {
    let onSelectionChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onSelectionChange = vi.fn();
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones,
        onSelectionChange
      });
    });

    it('should preserve selections when switching categories', () => {
      // Select zone1 in h3-3 category
      selector.setCategory('h3-3');
      selector.toggleZoneSelection('zone1');
      
      // Switch to h3-4 and back
      selector.setCategory('h3-4');
      selector.setCategory('h3-3');
      
      // Zone1 should still be selected
      expect(selector.getSelectedZones().some(z => z.id === 'zone1')).toBe(true);
    });

    it('should trigger onSelectionChange with all selected zones', () => {
      selector.toggleZoneSelection('zone1');
      
      const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
      const selectedZones = lastCall[0];
      
      // Should include both zone1 (newly selected) and zone3 (initially selected)
      expect(selectedZones).toHaveLength(2);
      expect(selectedZones.some((z: Zone) => z.id === 'zone1')).toBe(true);
      expect(selectedZones.some((z: Zone) => z.id === 'zone3')).toBe(true);
    });

    it('should clear all selections', () => {
      // First select some zones
      selector.toggleZoneSelection('zone1');
      
      // Then clear
      selector.clearSelection();
      
      expect(selector.getSelectedZones()).toHaveLength(0);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should get initial selected zones', () => {
      // zone3 starts as selected
      const selected = selector.getSelectedZones();
      expect(selected).toHaveLength(1);
      expect(selected[0].id).toBe('zone3');
    });
  });

  describe('Category Management', () => {
    let onCategoryChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onCategoryChange = vi.fn();
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones,
        onCategoryChange
      });
    });

    it('should get all unique categories', () => {
      const categories = selector.getCategories();
      expect(categories).toEqual(['h3-3', 'h3-4']);
      expect(categories.length).toBe(2); // Should not have duplicates
    });

    it('should set valid category and trigger callback', () => {
      selector.setCategory('h3-4');
      
      expect(selector.getCurrentCategory()).toBe('h3-4');
      expect(onCategoryChange).toHaveBeenCalledWith('h3-4');
    });

    it('should not set invalid category', () => {
      const currentCategory = selector.getCurrentCategory();
      
      selector.setCategory('invalid-category');
      
      expect(selector.getCurrentCategory()).toBe(currentCategory);
      expect(onCategoryChange).not.toHaveBeenCalled();
    });

    it('should start with first category by default', () => {
      expect(selector.getCurrentCategory()).toBe('h3-3');
    });
  });

  describe('Drag Mode Management', () => {
    beforeEach(() => {
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones
      });
    });

    it('should change drag modes', () => {
      expect(selector.getDragMode()).toBe('lasso');

      selector.setDragMode('path');
      expect(selector.getDragMode()).toBe('path');

      selector.setDragMode('lasso');
      expect(selector.getDragMode()).toBe('lasso');
    });
  });

  describe('Shift Key State', () => {
    beforeEach(() => {
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones
      });
    });

    it('should track shift key state', () => {
      // Initially false
      expect(selector.isShiftKeyPressed()).toBe(false);
      
      // Simulate shift key press
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      document.dispatchEvent(keyDownEvent);
      
      expect(selector.isShiftKeyPressed()).toBe(true);
      
      // Simulate shift key release
      const keyUpEvent = new KeyboardEvent('keyup', { key: 'Shift' });
      document.dispatchEvent(keyUpEvent);
      
      expect(selector.isShiftKeyPressed()).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle zones with various geometry types', () => {
      const mixedZones: Zone[] = [
        {
          id: 'point1',
          name: 'Point Zone',
          category: 'test',
          geometry: { type: 'Point', coordinates: [0, 0] },
          selected: false
        },
        {
          id: 'poly1',
          name: 'Polygon Zone',
          category: 'test',
          geometry: { 
            type: 'Polygon', 
            coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]] 
          },
          selected: false
        }
      ];

      expect(() => {
        selector = new ZoneSelector({
          provider: new CanvasRenderingProvider(canvas, viewport),
          zones: mixedZones
        });
      }).not.toThrow();

      expect(selector.getCategories()).toEqual(['test']);
    });

    it('should handle large numbers of zones', () => {
      const largeZoneSet: Zone[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `zone-${i}`,
        name: `Zone ${i}`,
        category: `category-${i % 10}`, // 10 categories
        geometry: {
          type: 'Point' as const,
          coordinates: [i % 100, Math.floor(i / 100)]
        },
        selected: false
      }));

      expect(() => {
        selector = new ZoneSelector({
          provider: new CanvasRenderingProvider(canvas, { minX: -10, maxX: 110, minY: -10, maxY: 110 }),
          zones: largeZoneSet
        });
      }).not.toThrow();

      expect(selector.getCategories().length).toBe(10);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      selector = new ZoneSelector({
        provider: new CanvasRenderingProvider(canvas, viewport),
        zones: mockZones
      });
    });

    it('should destroy and cleanup resources', () => {
      expect(() => selector.destroy()).not.toThrow();
      
      // After destroy, shift key events should not affect the destroyed instance
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
      expect(() => document.dispatchEvent(keyDownEvent)).not.toThrow();
    });
  });
});