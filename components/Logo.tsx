"use client";

import { useId } from "react";

/**
 * Itinera brandmark — the "Journey Core".
 *
 * An orbital glyph: a luminous intelligence at the centre with destination
 * nodes travelling tilted orbits around it. It says *intelligent journeys,
 * connected destinations, discovery, motion* — no planes, pins or luggage.
 * Retints per theme via `var(--accent)`; scales cleanly from favicon to splash.
 *
 *   variant="tile"  → mark on a deep glass tile (app icon / light surfaces)
 *   variant="plain" → mark only, on whatever sits behind it (dark surfaces)
 *   animated        → orbits sweep + core breathes (splash / loading / avatar)
 */
export function Logo({
  size = 32,
  variant = "tile",
  animated = false,
  className = "",
}: {
  size?: number;
  variant?: "tile" | "plain";
  animated?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const onTile = variant === "tile";
  const core = `core-${uid}`;
  const glow = `glow-${uid}`;
  const ring = `ring-${uid}`;
  const tileGrad = `tile-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${animated ? "logo-anim" : ""} ${className}`}
      role="img"
      aria-label="Itinera"
    >
      <defs>
        <radialGradient id={core} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="45%" stopColor="#FFE7C4" />
          <stop offset="100%" stopColor="var(--accent)" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={tileGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16233c" />
          <stop offset="100%" stopColor="#0a1424" />
        </linearGradient>
      </defs>

      {onTile && <rect width="100" height="100" rx="26" fill={`url(#${tileGrad})`} />}

      {/* atmospheric halo */}
      <circle cx="50" cy="50" r="42" fill={`url(#${glow})`} className="logo-halo" />

      {/* orbital system — sweeps as one when animated */}
      <g className="logo-orbits">
        <ellipse cx="50" cy="50" rx="38" ry="14" fill="none" stroke={`url(#${ring})`} strokeWidth="2.4" transform="rotate(-27 50 50)" opacity="0.9" />
        <ellipse cx="50" cy="50" rx="33" ry="12" fill="none" stroke={`url(#${ring})`} strokeWidth="1.8" transform="rotate(38 50 50)" opacity="0.5" />
        {/* destination nodes riding the orbits */}
        <circle cx="83.9" cy="34.8" r="4" fill="var(--accent)" className="logo-node" />
        <circle cx="16.1" cy="65.2" r="2.6" fill="var(--accent)" opacity="0.75" />
        <circle cx="24.4" cy="34" r="2.4" fill="#FFE7C4" opacity="0.85" />
      </g>

      {/* luminous intelligence at the centre */}
      <circle cx="50" cy="50" r="9.2" fill={`url(#${core})`} className="logo-core" />
      <circle cx="46.6" cy="46.4" r="2.6" fill="#fff" opacity="0.9" />
    </svg>
  );
}
