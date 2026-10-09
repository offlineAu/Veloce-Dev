import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LOGO_POLYGONS } from "@/components/brand/logo";
import { PixelLogoLoader } from "@/components/brand/pixel-logo-loader";
import { LOGO_CELLS, MARK_HEIGHT, MARK_WIDTH } from "@/components/brand/pixel-logo-loader-geometry";

const polygons = LOGO_POLYGONS.map((polygon) =>
  polygon.split(" ").map((pair) => pair.split(",").map(Number) as [number, number]),
);

it("renders distinct clip references for multiple server-rendered loaders", () => {
  const html = renderToStaticMarkup(createElement("div", null,
    createElement(PixelLogoLoader), createElement(PixelLogoLoader, { variant: "compact" }),
  ));
  const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((match) => match[1]);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  for (const id of ids) expect(html).toContain(`clip-path="url(#${id})"`);
  expect(html).not.toContain('role="status"');
});

// Independent scanline reference: every point of the artwork needs a revealing cell.
function inMark(x: number, y: number) {
  return polygons.some((polygon) => {
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i]!;
      const [bx, by] = polygon[(i + 1) % polygon.length]!;
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        crossings.push(ax + (y - ay) * (bx - ax) / (by - ay));
      }
    }
    return crossings.filter((crossing) => crossing > x).length % 2 === 1;
  });
}

describe.each(["page", "compact"] as const)("%s logo cell coverage", (variant) => {
  it("covers the thin tips and polygon boundaries", () => {
    for (const [x, y] of polygons.flat()) {
      expect(LOGO_CELLS[variant].some((cell) =>
        x >= cell.x - 1e-8 && x <= cell.x + cell.width + 1e-8 &&
        y >= cell.y - 1e-8 && y <= cell.y + cell.height + 1e-8,
      )).toBe(true);
    }
  });

  it("does not leave holes inside the mark when pruning cells", () => {
    const cells = LOGO_CELLS[variant];
    for (let row = 0; row < 100; row++) {
      for (let column = 0; column < 100; column++) {
        const x = (column + 0.5) * MARK_WIDTH / 100;
        const y = (row + 0.5) * MARK_HEIGHT / 100;
        if (inMark(x, y)) {
          expect(cells.some((cell) =>
            x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height,
          )).toBe(true);
        }
      }
    }
  });
});
