import { LOGO_POLYGONS } from "./logo";

export const MARK_WIDTH = 96.8;
export const MARK_HEIGHT = 100;

type Point = readonly [number, number];
const polygons = LOGO_POLYGONS.map((polygon) =>
  polygon.split(" ").map((pair) => pair.split(",").map(Number) as [number, number]),
);

function containsPoint([x, y]: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i]!;
    const [bx, by] = polygon[j]!;
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

// Clip a polygon edge to the cell, including thin intersections at its border.
function edgeIntersectsCell(a: Point, b: Point, x: number, y: number, width: number, height: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let enter = 0;
  let exit = 1;
  const bounds: Point[] = [
    [-dx, a[0] - x], [dx, x + width - a[0]],
    [-dy, a[1] - y], [dy, y + height - a[1]],
  ];
  for (const [direction, distance] of bounds) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const fraction = distance / direction;
    if (direction < 0) enter = Math.max(enter, fraction);
    else exit = Math.min(exit, fraction);
    if (enter > exit) return false;
  }
  return true;
}

function buildCells(grid: 8 | 16) {
  const width = MARK_HEIGHT / grid;
  const height = width;
  const cells = Array.from({ length: grid * grid }, (_, index) => {
    const column = index % grid;
    const row = Math.floor(index / grid);
    return {
      x: column * width, y: row * height, width, height,
      step: column + grid - 1 - row,
    };
  }).filter(({ x, y, width, height }) => polygons.some((polygon) => {
    const corners: Point[] = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]];
    return corners.some((corner) => containsPoint(corner, polygon)) ||
      polygon.some(([px, py]) => px >= x && px <= x + width && py >= y && py <= y + height) ||
      polygon.some((point, i) => edgeIntersectsCell(point, polygon[(i + 1) % polygon.length]!, x, y, width, height));
  }));
  const first = Math.min(...cells.map((cell) => cell.step));
  const last = Math.max(...cells.map((cell) => cell.step));
  // Normalize occupied diagonals so both sizes build over the entire shared interval.
  return cells.map((cell) => ({ ...cell, step: Math.round((cell.step - first) * 30 / (last - first)) }));
}

// Computed once per module; no DOM access, randomness, or work on animation frames.
export const LOGO_CELLS = { page: buildCells(16), compact: buildCells(8) } as const;
