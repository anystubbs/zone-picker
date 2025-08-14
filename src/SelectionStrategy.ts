import paper from 'paper';
import { DragMode } from './types';
import { lassoContainsShape, pathIntersectsShape } from './geometry/IntersectionHelpers';

export interface SelectionStrategy {
  createShape(start: paper.Point): paper.Path;
  updateShape(shape: paper.Path, current: paper.Point, start: paper.Point): void;
  applyStyle(shape: paper.Path, isShift: boolean): void;
  testIntersection(shape: paper.Path, selection: paper.Path): boolean;
  completeSelection(shape: paper.Path, start: paper.Point): void;
}

export class RectangleSelectionStrategy implements SelectionStrategy {
  createShape(start: paper.Point): paper.Path {
    return new paper.Path.Rectangle(start, start);
  }

  updateShape(shape: paper.Path, current: paper.Point, start: paper.Point): void {
    const rectangle = new paper.Rectangle(start, current);
    shape.remove();
    const newShape = new paper.Path.Rectangle(rectangle);
    // Copy properties to maintain reference
    shape.segments = newShape.segments;
    shape.bounds = newShape.bounds;
    newShape.remove();
  }

  applyStyle(shape: paper.Path, isShift: boolean): void {
    shape.strokeWidth = 2;
    shape.dashArray = [5, 5];
    
    if (isShift) {
      shape.strokeColor = new paper.Color(1, 0.2, 0.2);
      shape.fillColor = new paper.Color(1, 0.2, 0.2, 0.1);
    } else {
      shape.strokeColor = new paper.Color(0.2, 0.6, 1);
      shape.fillColor = new paper.Color(0.2, 0.6, 1, 0.1);
    }
  }

  testIntersection(shape: paper.Path, selection: paper.Path): boolean {
    return shape.bounds.intersects(selection.bounds) || 
           selection.bounds.contains(shape.bounds);
  }

  completeSelection(_shape: paper.Path, _start: paper.Point): void {
    // Rectangle doesn't need completion logic
  }
}

export class LassoSelectionStrategy implements SelectionStrategy {
  createShape(start: paper.Point): paper.Path {
    const path = new paper.Path();
    path.moveTo(start);
    return path;
  }

  updateShape(shape: paper.Path, current: paper.Point, _start: paper.Point): void {
    shape.lineTo(current);
  }

  applyStyle(shape: paper.Path, isShift: boolean): void {
    shape.strokeWidth = 4;
    shape.dashArray = [8, 4]; // Thick dashed line for lasso area selection
    
    shape.strokeColor = isShift 
      ? new paper.Color(1, 0.2, 0.2)
      : new paper.Color(0.2, 0.6, 1);
  }

  testIntersection(shape: paper.Path, selection: paper.Path): boolean {
    return lassoContainsShape(selection, shape);
  }

  completeSelection(shape: paper.Path, start: paper.Point): void {
    // Close the lasso path to create a proper enclosed area
    shape.lineTo(start);
    shape.closePath();
  }
}

export class PathSelectionStrategy implements SelectionStrategy {
  createShape(start: paper.Point): paper.Path {
    const path = new paper.Path();
    path.moveTo(start);
    return path;
  }

  updateShape(shape: paper.Path, current: paper.Point, _start: paper.Point): void {
    shape.lineTo(current);
  }

  applyStyle(shape: paper.Path, isShift: boolean): void {
    shape.strokeWidth = 3;
    shape.dashArray = []; // Solid line for path intersection
    
    shape.strokeColor = isShift 
      ? new paper.Color(1, 0.2, 0.2)
      : new paper.Color(0.2, 0.6, 1);
  }

  testIntersection(shape: paper.Path, selection: paper.Path): boolean {
    return pathIntersectsShape(selection, shape);
  }

  completeSelection(_shape: paper.Path, _start: paper.Point): void {
    // Path doesn't need completion logic
  }
}

export function createSelectionStrategy(dragMode: DragMode): SelectionStrategy {
  switch (dragMode) {
    case 'rectangle':
      return new RectangleSelectionStrategy();
    case 'lasso':
      return new LassoSelectionStrategy();
    case 'path':
      return new PathSelectionStrategy();
    default:
      throw new Error(`Unknown drag mode: ${dragMode}`);
  }
}