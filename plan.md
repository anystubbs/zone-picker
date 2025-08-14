# Zone Selector Library - Development Plan

## Overview
Building a TypeScript frontend library for interactive geographic zone selection using Paper.js for vector graphics rendering. The library provides an interactive canvas-based interface for selecting geographic zones with support for multiple data types and categories.

## Phases 1-4: Core Implementation ✅ COMPLETED
All foundational work, Paper.js integration, selection logic, and data integration complete.

## Phase 5: Advanced Features 🎯 FUTURE
- [ ] Performance optimization (viewport culling, shape simplification)
- [ ] Responsive canvas sizing and zoom/pan controls
- [ ] Voronoi diagram generation for point zones
- [ ] Territory boundary creation using Paper.js paths

## Phase 6: Library Packaging 🎯 PENDING
- [ ] Bundle optimization (tree-shakeable)
- [ ] Type definitions export
- [ ] Documentation and examples
- [ ] NPM package preparation
- [ ] Unit test coverage

## Phase 7: Code Organization & Refactoring 📋 FUTURE
- [ ] Consider minimal extraction pattern instead of heavy modularization
- [ ] Extract pure geometry functions to `geometry/IntersectionHelpers.ts`
  - `lassoContainsShape()`, `pathIntersectsShape()`, `worldToCanvas()`
- [ ] Keep ZoneSelector as cohesive orchestrator to avoid leaky abstractions
- [ ] Maintain Paper.js encapsulation within main class
- [ ] Avoid state ownership confusion from over-modularization

## Technical Stack
- **Language**: TypeScript
- **Graphics**: Paper.js (vector graphics, canvas rendering)
- **Build**: Vite
- **Testing**: Vitest
- **Geometry**: Turf.js for geographic operations
- **Bundle**: ESM + CommonJS outputs

## Key Design Decisions
- Framework-agnostic vanilla TypeScript
- Canvas-based rendering via Paper.js
- Flexible target specification (user provides canvas element)
- Minimal dependencies beyond Paper.js
- Event-driven architecture
- Strong TypeScript support

## Library API Design
```typescript
const selector = new ZoneSelector({
  canvas: document.getElementById('map-canvas'),
  zones: zonesData,
  onSelectionChange: (selectedZones) => { /* callback */ }
});
```