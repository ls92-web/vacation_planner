"use client";

/** Loading placeholder shown while the Maps script / tiles load. */
export function MapSkeleton({ label = "Loading map…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#eef3ec] overflow-hidden">
      <div className="absolute inset-0 vp-shimmer opacity-60" />
      <div className="relative flex items-center gap-2 text-[12px] font-mono text-[#5d7068] bg-white/80 px-3 py-1.5 rounded-lg">
        <span className="w-3 h-3 border-2 border-[#cfd9d2] border-t-accent rounded-full vp-spin" />
        {label}
      </div>
    </div>
  );
}
