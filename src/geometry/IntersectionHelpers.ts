import paper from 'paper';
import { ViewportBounds } from '../types';

/**
 * Pure geometry helper functions for zone selection calculations.
 * These functions have no side effects and only perform geometric computations.
 */

/**
 * Converts world coordinates to canvas coordinates based on viewport bounds
 */
export function worldToCanvas(
  x: number, 
  y: number, 
  viewportBounds: ViewportBounds, 
  canvasSize: paper.Size
): paper.Point {
  const worldWidth = viewportBounds.maxX - viewportBounds.minX;
  const worldHeight = viewportBounds.maxY - viewportBounds.minY;
  
  const canvasX = ((x - viewportBounds.minX) / worldWidth) * canvasSize.width;
  const canvasY = canvasSize.height - ((y - viewportBounds.minY) / worldHeight) * canvasSize.height;
  
  return new paper.Point(canvasX, canvasY);
}

/**
 * Checks if a shape is contained within a lasso path using comprehensive containment logic
 */
export function lassoContainsShape(lasso: paper.Path, shape: paper.Path): boolean {
  try {
    // First check if the zone's center point is contained within the lasso
    if (lasso.contains(shape.position)) {
      return true;
    }
    
    // For polygon zones, check if any of the zone's vertices are contained within the lasso
    if (shape.segments && shape.segments.length > 0) {
      for (const segment of shape.segments) {
        if (lasso.contains(segment.point)) {
          return true;
        }
      }
    }
    
    // Also check if the zone's bounds corners are contained (for more coverage)
    const bounds = shape.bounds;
    const corners = [
      bounds.topLeft,
      bounds.topRight,
      bounds.bottomLeft,
      bounds.bottomRight,
      bounds.center
    ];
    
    for (const corner of corners) {
      if (lasso.contains(corner)) {
        return true;
      }
    }
    
    // Finally, check if the lasso intersects with the zone shape
    const intersections = lasso.getIntersections(shape);
    return intersections.length > 0;
    
  } catch (error) {
    // Fallback to center point containment if complex checks fail
    console.warn('Lasso containment calculation failed, using center fallback:', error);
    try {
      return lasso.contains(shape.position);
    } catch {
      return false;
    }
  }
}

/**
 * Checks if a drawn path intersects with a zone shape
 */
export function pathIntersectsShape(path: paper.Path, shape: paper.Path): boolean {
  try {
    // Check for actual path intersections using Paper.js intersection detection
    const intersections = path.getIntersections(shape);
    if (intersections.length > 0) {
      return true;
    }
    
    // Also check if path passes through the shape
    const pathLength = path.length;
    const sampleCount = Math.max(10, Math.floor(pathLength / 5)); // Sample along the path
    
    for (let i = 0; i <= sampleCount; i++) {
      const offset = (i / sampleCount) * pathLength;
      const point = path.getPointAt(offset);
      if (point && shape.contains(point)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    // Fallback to bounds intersection if Paper.js intersection fails
    console.warn('Path intersection calculation failed, using bounds fallback:', error);
    return path.bounds.intersects(shape.bounds);
  }
}