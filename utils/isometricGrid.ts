export interface GridPosition {
  row: number;
  col: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface IsometricGridConfig {
  gridSize: number; // 10x10 grid
  tileWidth: number; // Width of each diamond tile
  tileHeight: number; // Height of each diamond tile
  offsetX: number; // Center offset X
  offsetY: number; // Center offset Y
}

// Default configuration for 10x10 isometric grid
export const DEFAULT_GRID_CONFIG: IsometricGridConfig = {
  gridSize: 10,
  tileWidth: 30,  // Smaller tiles to fit garden in screen
  tileHeight: 15,
  offsetX: 200,   // Center the grid in screen-sized canvas
  offsetY: 300,
};

/**
 * Convert grid coordinates (row, col) to screen position (x, y) in isometric view
 */
export function gridToScreen(
  gridPos: GridPosition, 
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): ScreenPosition {
  const { row, col } = gridPos;
  const { tileWidth, tileHeight, offsetX, offsetY } = config;
  
  // Isometric projection formulas
  const x = offsetX + (col - row) * (tileWidth / 2);
  const y = offsetY + (col + row) * (tileHeight / 2);
  
  return { x, y };
}

/**
 * Convert screen position (x, y) to grid coordinates (row, col)
 */
export function screenToGrid(
  screenPos: ScreenPosition, 
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): GridPosition {
  const { x, y } = screenPos;
  const { tileWidth, tileHeight, offsetX, offsetY } = config;
  
  // Reverse isometric projection
  const relativeX = x - offsetX;
  const relativeY = y - offsetY;
  
  // Convert back to grid coordinates
  const col = (relativeX / (tileWidth / 2) + relativeY / (tileHeight / 2)) / 2;
  const row = (relativeY / (tileHeight / 2) - relativeX / (tileWidth / 2)) / 2;
  
  // Round to nearest grid position
  return {
    row: Math.round(row),
    col: Math.round(col),
  };
}

/**
 * Check if a grid position is valid (within bounds)
 */
export function isValidGridPosition(
  gridPos: GridPosition, 
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): boolean {
  const { row, col } = gridPos;
  const { gridSize } = config;
  
  return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
}

/**
 * Get the nearest valid grid position to a screen coordinate
 */
export function snapToGrid(
  screenPos: ScreenPosition, 
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): GridPosition {
  const gridPos = screenToGrid(screenPos, config);
  const { gridSize } = config;
  
  // Clamp to valid range
  const clampedRow = Math.max(0, Math.min(gridSize - 1, gridPos.row));
  const clampedCol = Math.max(0, Math.min(gridSize - 1, gridPos.col));
  
  return { row: clampedRow, col: clampedCol };
}

/**
 * Check if a grid position is unlocked (available for planting)
 * In the simplified version, all positions in a 10x10 grid are always unlocked
 */
export function isGridPositionUnlocked(
  gridPos: GridPosition, 
  unlockedTiles?: Array<{ x: number; y: number; unlockedAt: string }>
): boolean {
  // All positions are unlocked in the simplified 10x10 grid
  return isValidGridPosition(gridPos);
}

/**
 * Get all grid positions in a 10x10 grid
 */
export function getAllGridPositions(
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): GridPosition[] {
  const positions: GridPosition[] = [];
  const { gridSize } = config;
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      positions.push({ row, col });
    }
  }
  
  return positions;
}

/**
 * Get screen positions for drawing grid lines/tiles
 */
export function getGridTileCorners(
  gridPos: GridPosition, 
  config: IsometricGridConfig = DEFAULT_GRID_CONFIG
): ScreenPosition[] {
  const center = gridToScreen(gridPos, config);
  const { tileWidth, tileHeight } = config;
  
  // Diamond shape corners (top, right, bottom, left)
  return [
    { x: center.x, y: center.y - tileHeight / 2 }, // top
    { x: center.x + tileWidth / 2, y: center.y }, // right
    { x: center.x, y: center.y + tileHeight / 2 }, // bottom
    { x: center.x - tileWidth / 2, y: center.y }, // left
  ];
}

/**
 * Calculate the visual depth (z-index) based on grid position for proper layering
 */
export function getGridDepth(gridPos: GridPosition): number {
  // Plants in higher rows and columns should appear in front
  return (gridPos.row + gridPos.col) * 10;
}
