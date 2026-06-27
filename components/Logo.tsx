/**
 * Itinera brandmark — a journey path connecting two stops, forming a subtle "I",
 * with an AI sparkle. Minimal, flat, scalable.
 *
 *  variant="tile"  → mark on the rounded brand tile (use on light surfaces / app icon)
 *  variant="plain" → mark only, tinted with the current theme accent (use on dark tiles)
 */
export function Logo({
  size = 32,
  variant = "tile",
  tile = "#002B36",
  className = "",
}: {
  size?: number;
  variant?: "tile" | "plain";
  tile?: string;
  className?: string;
}) {
  const onTile = variant === "tile";
  const line = onTile ? "#FFFFFF" : "var(--accent)";
  const ring = onTile ? tile : "var(--surface)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Itinera">
      {onTile && <rect width="100" height="100" rx="27" fill={tile} />}
      {/* journey path */}
      <path d="M40 32 V50 C40 61 49 65 60 68" fill="none" stroke={line} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* stops */}
      <circle cx="40" cy="32" r="7.5" fill="#F5A623" stroke={ring} strokeWidth="2.5" />
      <circle cx="60" cy="68" r="7.5" fill="#0EA5A0" stroke={ring} strokeWidth="2.5" />
      {/* AI sparkle */}
      <path d="M71 21 Q71 31 81 31 Q71 31 71 41 Q71 31 61 31 Q71 31 71 21 Z" fill="#F5A623" />
    </svg>
  );
}
