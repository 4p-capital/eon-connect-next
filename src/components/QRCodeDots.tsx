"use client";

import React, { useMemo } from "react";
import QRCodeLib from "qrcode";

type QRCodeDotsProps = {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  dotColor?: string;
  bgColor?: string;
  /** SVG string to render in the center */
  logoSvg?: string;
  /** Logo size as fraction of QR size (0–1). Default 0.22 */
  logoScale?: number;
};

export function QRCodeDots({
  value,
  size = 180,
  level = "M",
  dotColor = "#322D67",
  bgColor = "transparent",
  logoSvg,
  logoScale = 0.22,
}: QRCodeDotsProps) {
  const { modules, moduleCount } = useMemo(() => {
    const qr = QRCodeLib.create(value, { errorCorrectionLevel: level });
    return {
      modules: qr.modules.data,
      moduleCount: qr.modules.size,
    };
  }, [value, level]);

  const cellSize = size / moduleCount;
  const dotRadius = cellSize * 0.42; // slightly smaller than half for gap

  // Logo exclusion zone (center square)
  const logoPixels = size * logoScale;
  const logoMargin = cellSize * 1.5; // extra clearance
  const logoAreaSize = logoPixels + logoMargin * 2;
  const logoStart = (size - logoAreaSize) / 2;
  const logoEnd = logoStart + logoAreaSize;

  const dots: React.ReactElement[] = [];

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row * moduleCount + col]) continue;

      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;

      // Skip dots that overlap the logo area
      if (logoSvg && cx > logoStart && cx < logoEnd && cy > logoStart && cy < logoEnd) {
        continue;
      }

      dots.push(
        <circle
          key={`${row}-${col}`}
          cx={cx}
          cy={cy}
          r={dotRadius}
          fill={dotColor}
        />,
      );
    }
  }

  // Logo positioning (centered)
  const logoX = (size - logoPixels) / 2;
  const logoY = (size - logoPixels) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {bgColor !== "transparent" && (
        <rect width={size} height={size} fill={bgColor} />
      )}
      {dots}
      {logoSvg && (
        <g
          transform={`translate(${logoX}, ${logoY})`}
          dangerouslySetInnerHTML={{
            __html: `<svg viewBox="0 0 26 40" width="${logoPixels}" height="${logoPixels}">${logoSvg}</svg>`,
          }}
        />
      )}
    </svg>
  );
}
