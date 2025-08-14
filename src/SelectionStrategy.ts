import { DragMode } from './types';
import { Point, SelectionShape, SelectionStyle, RenderingProvider } from './providers/RenderingProvider';

export interface SelectionStrategy {
  createShape(provider: RenderingProvider, start: Point): SelectionShape;
  updateShape(provider: RenderingProvider, shape: SelectionShape, current: Point, start: Point): void;
  applyStyle(provider: RenderingProvider, shape: SelectionShape, isShift: boolean): void;
  testIntersection(provider: RenderingProvider, zoneId: string, selection: SelectionShape): boolean;
  completeSelection(provider: RenderingProvider, shape: SelectionShape, start: Point): void;
}


export class LassoSelectionStrategy implements SelectionStrategy {
  createShape(provider: RenderingProvider, start: Point): SelectionShape {
    return provider.createSelectionShape('lasso', start);
  }

  updateShape(provider: RenderingProvider, shape: SelectionShape, current: Point, start: Point): void {
    provider.updateSelectionShape(shape, current, start);
  }

  applyStyle(provider: RenderingProvider, shape: SelectionShape, isShift: boolean): void {
    const style: SelectionStyle = {
      strokeWidth: 4,
      dashArray: [8, 4], // Thick dashed line for lasso area selection
      strokeColor: isShift ? '#ff3333' : '#3399ff'
    };
    provider.applySelectionStyle(shape, style);
  }

  testIntersection(provider: RenderingProvider, zoneId: string, selection: SelectionShape): boolean {
    return provider.testIntersection(zoneId, selection);
  }

  completeSelection(provider: RenderingProvider, shape: SelectionShape, start: Point): void {
    provider.completeSelectionShape(shape, start);
  }
}

export class PathSelectionStrategy implements SelectionStrategy {
  createShape(provider: RenderingProvider, start: Point): SelectionShape {
    return provider.createSelectionShape('path', start);
  }

  updateShape(provider: RenderingProvider, shape: SelectionShape, current: Point, start: Point): void {
    provider.updateSelectionShape(shape, current, start);
  }

  applyStyle(provider: RenderingProvider, shape: SelectionShape, isShift: boolean): void {
    const style: SelectionStyle = {
      strokeWidth: 3,
      dashArray: [], // Solid line for path intersection
      strokeColor: isShift ? '#ff3333' : '#3399ff'
    };
    provider.applySelectionStyle(shape, style);
  }

  testIntersection(provider: RenderingProvider, zoneId: string, selection: SelectionShape): boolean {
    return provider.testIntersection(zoneId, selection);
  }

  completeSelection(provider: RenderingProvider, shape: SelectionShape, start: Point): void {
    provider.completeSelectionShape(shape, start);
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