import { describe, it, expect, beforeAll } from 'vitest';
import paper from 'paper';
import { worldToCanvas, lassoContainsShape, pathIntersectsShape } from '../src/IntersectionHelpers';
import { ViewportBounds } from '../src/types';

describe('IntersectionHelpers', () => {
  beforeAll(() => {
    const canvas = createTestCanvas();
    paper.setup(canvas);
  });

  describe('worldToCanvas', () => {
    const viewport: ViewportBounds = {
      minX: -10,
      maxX: 10,
      minY: -10,
      maxY: 10
    };
    const canvasSize = new paper.Size(800, 600);

    it('should convert world center to canvas center', () => {
      const result = worldToCanvas(0, 0, viewport, canvasSize);
      expect(result.x).toBe(400); // center X
      expect(result.y).toBe(300); // center Y
    });

    it('should convert world min bounds to canvas corners', () => {
      const result = worldToCanvas(-10, -10, viewport, canvasSize);
      expect(result.x).toBe(0);
      expect(result.y).toBe(600); // Y is flipped
    });

    it('should convert world max bounds to canvas corners', () => {
      const result = worldToCanvas(10, 10, viewport, canvasSize);
      expect(result.x).toBe(800);
      expect(result.y).toBe(0); // Y is flipped
    });
  });

  describe('lassoContainsShape', () => {
    it('should return true when shape center is inside lasso', () => {
      const lasso = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Point(100, 100));
      const shape = new paper.Path.Circle(new paper.Point(50, 50), 10);
      
      const result = lassoContainsShape(lasso, shape);
      expect(result).toBe(true);
    });

    it('should return false when shape is outside lasso', () => {
      const lasso = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Point(100, 100));
      const shape = new paper.Path.Circle(new paper.Point(200, 200), 10);
      
      const result = lassoContainsShape(lasso, shape);
      expect(result).toBe(false);
    });
  });

  describe('pathIntersectsShape', () => {
    it('should return true when path intersects shape', () => {
      const path = new paper.Path();
      path.moveTo(new paper.Point(0, 50));
      path.lineTo(new paper.Point(100, 50));
      
      const shape = new paper.Path.Circle(new paper.Point(50, 50), 20);
      
      const result = pathIntersectsShape(path, shape);
      expect(result).toBe(true);
    });

    it('should return false when path does not intersect shape', () => {
      const path = new paper.Path();
      path.moveTo(new paper.Point(0, 0));
      path.lineTo(new paper.Point(10, 10));
      
      const shape = new paper.Path.Circle(new paper.Point(100, 100), 10);
      
      const result = pathIntersectsShape(path, shape);
      expect(result).toBe(false);
    });
  });
});