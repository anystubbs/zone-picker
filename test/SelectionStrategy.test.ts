import { describe, it, expect, beforeAll } from 'vitest';
import paper from 'paper';
import { 
  RectangleSelectionStrategy, 
  LassoSelectionStrategy, 
  PathSelectionStrategy,
  createSelectionStrategy 
} from '../src/SelectionStrategy';

describe('SelectionStrategy', () => {
  beforeAll(() => {
    const canvas = createTestCanvas();
    paper.setup(canvas);
  });

  describe('createSelectionStrategy', () => {
    it('should create RectangleSelectionStrategy for rectangle mode', () => {
      const strategy = createSelectionStrategy('rectangle');
      expect(strategy).toBeInstanceOf(RectangleSelectionStrategy);
    });

    it('should create LassoSelectionStrategy for lasso mode', () => {
      const strategy = createSelectionStrategy('lasso');
      expect(strategy).toBeInstanceOf(LassoSelectionStrategy);
    });

    it('should create PathSelectionStrategy for path mode', () => {
      const strategy = createSelectionStrategy('path');
      expect(strategy).toBeInstanceOf(PathSelectionStrategy);
    });
  });

  describe('RectangleSelectionStrategy', () => {
    const strategy = new RectangleSelectionStrategy();
    const start = new paper.Point(10, 10);

    it('should create rectangle shape', () => {
      const shape = strategy.createShape(start);
      expect(shape).toBeInstanceOf(paper.Path);
    });

    it('should apply rectangle styling', () => {
      const shape = strategy.createShape(start);
      strategy.applyStyle(shape, false);
      
      expect(shape.strokeWidth).toBe(2);
      expect(shape.dashArray).toEqual([5, 5]);
    });

    it('should apply red styling when shift is pressed', () => {
      const shape = strategy.createShape(start);
      strategy.applyStyle(shape, true);
      
      expect(shape.strokeColor?.red).toBe(1);
      expect(shape.strokeColor?.green).toBe(0.2);
      expect(shape.strokeColor?.blue).toBe(0.2);
    });

    it('should test intersection using bounds', () => {
      const selection = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Point(50, 50));
      const shape = new paper.Path.Circle(new paper.Point(25, 25), 10);
      
      const result = strategy.testIntersection(shape, selection);
      expect(result).toBe(true);
    });
  });

  describe('LassoSelectionStrategy', () => {
    const strategy = new LassoSelectionStrategy();
    const start = new paper.Point(10, 10);

    it('should create path shape', () => {
      const shape = strategy.createShape(start);
      expect(shape).toBeInstanceOf(paper.Path);
      expect(shape.segments.length).toBe(1);
    });

    it('should apply lasso styling', () => {
      const shape = strategy.createShape(start);
      strategy.applyStyle(shape, false);
      
      expect(shape.strokeWidth).toBe(4);
      expect(shape.dashArray).toEqual([8, 4]);
    });

    it('should complete selection by closing path', () => {
      const shape = strategy.createShape(start);
      shape.lineTo(new paper.Point(50, 10));
      shape.lineTo(new paper.Point(50, 50));
      
      strategy.completeSelection(shape, start);
      expect(shape.closed).toBe(true);
    });
  });

  describe('PathSelectionStrategy', () => {
    const strategy = new PathSelectionStrategy();
    const start = new paper.Point(10, 10);

    it('should create path shape', () => {
      const shape = strategy.createShape(start);
      expect(shape).toBeInstanceOf(paper.Path);
      expect(shape.segments.length).toBe(1);
    });

    it('should apply path styling', () => {
      const shape = strategy.createShape(start);
      strategy.applyStyle(shape, false);
      
      expect(shape.strokeWidth).toBe(3);
      expect(shape.dashArray).toEqual([]);
    });

    it('should not modify path on completion', () => {
      const shape = strategy.createShape(start);
      const originalSegmentCount = shape.segments.length;
      
      strategy.completeSelection(shape, start);
      expect(shape.segments.length).toBe(originalSegmentCount);
    });
  });
});