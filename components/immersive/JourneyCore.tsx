"use client";

import { useEffect, useId, useState } from "react";

/**
 * The Journey Core — the visual heart of Itinera.
 *
 * A translucent glass intelligence-sphere: a slowly rotating lat/long
 * wireframe, orbital rings with travelling nodes, glowing destination
 * points, animated travel routes, drifting particles and an atmospheric
 * glow. It never stops moving — the sense that the AI is always thinking.
 *
 *   state="idle"     → calm perpetual motion
 *   state="thinking" → quickened sweep + brighter breathing (replaces spinners)
 *   state="routing"  → travel arcs draw and flow between destination nodes
 *
 * `nodes` are normalised sphere coordinates (x,y ∈ [-1,1]); points outside
 * the disc are dropped. Routes are drawn between consecutive nodes.
 */
export interface CoreNode {
  x: number;
  y: number;
  /** Larger = the focal/active destination. */
  active?: boolean;
}

const R = 70; // sphere radius within the 200×200 viewBox
const C = 100; // centre

// Deterministic particle field (no random → stable across SSR/hydration).
const PARTICLES = [
  { x: 26, y: 42, r: 0.9, d: 0, dur: 9 },
  { x: 174, y: 54, r: 0.7, d: 1.6, dur: 11 },
  { x: 42, y: 152, r: 1.0, d: 2.4, dur: 10 },
  { x: 160, y: 150, r: 0.8, d: 0.8, dur: 12 },
  { x: 100, y: 22, r: 0.6, d: 3.4, dur: 10 },
  { x: 188, y: 106, r: 0.9, d: 2.1, dur: 11.5 },
  { x: 16, y: 98, r: 0.7, d: 3.0, dur: 9.5 },
  { x: 122, y: 184, r: 0.6, d: 1.2, dur: 13 },
  { x: 68, y: 30, r: 0.6, d: 3.8, dur: 10 },
  { x: 150, y: 26, r: 0.8, d: 0.4, dur: 11 },
  { x: 34, y: 74, r: 0.5, d: 2.7, dur: 12 },
  { x: 176, y: 132, r: 0.5, d: 1.9, dur: 12.5 },
];

// Latitude bands (static) — narrower toward the poles for a tilted-globe read.
const PARALLELS = [
  { cy: C - 44, rx: 44, ry: 7 },
  { cy: C - 23, rx: 62, ry: 10 },
  { cy: C, rx: 70, ry: 12 },
  { cy: C + 23, rx: 62, ry: 10 },
  { cy: C + 44, rx: 44, ry: 7 },
];

function toXY(n: CoreNode) {
  return { cx: C + n.x * R * 0.82, cy: C + n.y * R * 0.82 };
}

/** Quadratic arc between two points, bulging away from the sphere centre. */
function arc(a: { cx: number; cy: number }, b: { cx: number; cy: number }) {
  const mx = (a.cx + b.cx) / 2;
  const my = (a.cy + b.cy) / 2;
  const dx = mx - C;
  const dy = my - C;
  const len = Math.hypot(dx, dy) || 1;
  const lift = 24;
  const cxp = mx + (dx / len) * lift;
  const cyp = my + (dy / len) * lift;
  return `M${a.cx},${a.cy} Q${cxp},${cyp} ${b.cx},${b.cy}`;
}

export function JourneyCore({
  size = 340,
  state = "idle",
  nodes,
  className = "",
}: {
  /** px (number) or any CSS length, e.g. "clamp(260px,44vw,420px)". */
  size?: number | string;
  state?: "idle" | "thinking" | "routing";
  nodes?: CoreNode[];
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const id = (s: string) => `${s}-${uid}`;
  // SMIL <animateMotion> can't be stopped by CSS, so honour reduced-motion here:
  // render the orbit nodes at rest instead of travelling.
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false); }, []);

  const pts = (nodes ?? [
    { x: -0.15, y: -0.42, active: true },
    { x: 0.5, y: 0.05 },
    { x: -0.02, y: 0.5 },
    { x: 0.42, y: -0.5 },
  ])
    .filter((n) => n.x * n.x + n.y * n.y <= 1)
    .map((n) => ({ ...n, ...toXY(n) }));

  const routes = pts.slice(1).map((p, i) => arc(pts[i], p));

  return (
    <div className={`jc jc-${state} ${className}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: "visible" }}>
        <defs>
          {/* glass body — cool sheen top-left falling to a deep, dim base */}
          <radialGradient id={id("glass")} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#a9ccff" stopOpacity="0.34" />
            <stop offset="38%" stopColor="#3a5c93" stopOpacity="0.18" />
            <stop offset="78%" stopColor="#0d1830" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#04070f" stopOpacity="0.46" />
          </radialGradient>
          {/* edge shading → gives the disc real volume */}
          <radialGradient id={id("rim")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="72%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#02060d" stopOpacity="0.6" />
          </radialGradient>
          {/* thin rim light around the glass */}
          <radialGradient id={id("edge")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bcd6ff" stopOpacity="0" />
            <stop offset="88%" stopColor="#bcd6ff" stopOpacity="0" />
            <stop offset="97%" stopColor="#cfe2ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#cfe2ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("atmo")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
            <stop offset="52%" stopColor="var(--accent)" stopOpacity="0.09" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("sheen")} cx="32%" cy="24%" r="46%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("wire")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b3d0ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#5f86c8" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id={id("route")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.08" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFE7C4" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={id("pdot")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eaf2ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#eaf2ff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={id("disc")}>
            <circle cx={C} cy={C} r={R} />
          </clipPath>
          <filter id={id("soft")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          <filter id={id("bloom")} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* atmospheric glow */}
        <circle cx={C} cy={C} r={94} fill={`url(#${id("atmo")})`} className="jc-atmo" />

        {/* orbits behind the glass (show through for depth) */}
        <g className="jc-orbit jc-orbit-a">
          <g transform={`rotate(-24 ${C} ${C})`}>
            <ellipse cx={C} cy={C} rx={94} ry={31} fill="none" stroke="var(--accent)" strokeOpacity="0.26" strokeWidth="0.9" />
            {still ? (
              <circle cx={194} cy={100} r="2.4" fill="var(--accent)" filter={`url(#${id("soft")})`} />
            ) : (
              <circle r="2.4" fill="var(--accent)" filter={`url(#${id("soft")})`}>
                <animateMotion dur="17s" repeatCount="indefinite" path="M6,100 a94,31 0 1,0 188,0 a94,31 0 1,0 -188,0" />
              </circle>
            )}
          </g>
        </g>
        <g className="jc-orbit jc-orbit-b">
          <g transform={`rotate(33 ${C} ${C})`}>
            <ellipse cx={C} cy={C} rx={88} ry={25} fill="none" stroke="var(--accent)" strokeOpacity="0.15" strokeWidth="0.9" />
            {still ? (
              <circle cx={12} cy={100} r="1.8" fill="#FFE7C4" filter={`url(#${id("soft")})`} />
            ) : (
              <circle r="1.8" fill="#FFE7C4" filter={`url(#${id("soft")})`}>
                <animateMotion dur="24s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="M12,100 a88,25 0 1,0 176,0 a88,25 0 1,0 -176,0" />
              </circle>
            )}
          </g>
        </g>

        {/* the glass sphere */}
        <circle cx={C} cy={C} r={R} fill={`url(#${id("glass")})`} />

        {/* rotating lat/long wireframe */}
        <g clipPath={`url(#${id("disc")})`} className="jc-wire">
          {PARALLELS.map((p, i) => (
            <ellipse key={`p${i}`} cx={C} cy={p.cy} rx={p.rx} ry={p.ry} fill="none" stroke={`url(#${id("wire")})`} strokeWidth="0.7" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse
              key={`m${i}`}
              cx={C}
              cy={C}
              rx={R}
              ry={R}
              fill="none"
              stroke={`url(#${id("wire")})`}
              strokeWidth="0.7"
              className="jc-meridian"
              style={{ animationDelay: `${(i * -4.4).toFixed(2)}s` }}
            />
          ))}
        </g>

        {/* volume + rim light + glassy sheen */}
        <circle cx={C} cy={C} r={R} fill={`url(#${id("rim")})`} />
        <circle cx={C} cy={C} r={R} fill={`url(#${id("edge")})`} />
        <ellipse cx={C - 20} cy={C - 24} rx={32} ry={22} fill={`url(#${id("sheen")})`} className="jc-sheen" />

        {/* travel routes */}
        <g className="jc-routes" clipPath={`url(#${id("disc")})`}>
          {routes.map((d, i) => (
            <path key={i} d={d} pathLength={100} fill="none" stroke={`url(#${id("route")})`} strokeWidth="1.5" strokeLinecap="round" className="jc-route" style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
        </g>

        {/* destination nodes */}
        {pts.map((p, i) => (
          <g key={i} className="jc-node" style={{ animationDelay: `${i * 0.4}s` }}>
            <circle cx={p.cx} cy={p.cy} r={p.active ? 10 : 6.5} fill="var(--accent)" opacity="0.2" className="jc-node-halo" filter={`url(#${id("soft")})`} />
            <circle cx={p.cx} cy={p.cy} r={p.active ? 3.2 : 2.2} fill={p.active ? "#FFF4E2" : "var(--accent)"} />
          </g>
        ))}

        {/* drifting particles (soft glows) */}
        <g filter={`url(#${id("soft")})`}>
          {PARTICLES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r * 2.2} fill={`url(#${id("pdot")})`} className="jc-particle" style={{ animationDelay: `${p.d}s`, animationDuration: `${p.dur}s` }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
