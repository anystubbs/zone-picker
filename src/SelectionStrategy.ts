import paper from 'paper';
import { DragMode } from './types';
import { lassoContainsShape, pathIntersectsShape } from './IntersectionHelpers';

export interface SelectionStrategy {
  createShape(start: paper.Point): paper.Path;
  updateShape(shape: paper.Path, current: paper.Point, start: paper.Point): void;
  applyStyle(shape: paper.Path, isShift: boolean): void;
  testIntersection(shape: paper.Path, selection: paper.Path): boolean;
  completeSelection(shape: paper.Path, start: paper.Point): void;
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
    case 'lasso':
      return new LassoSelectionStrategy();
    case 'path':
      return new PathSelectionStrategy();
    default:
      throw new Error(`Unknown drag mode: ${dragMode}`);
  }
}