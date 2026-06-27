"use client";

import { ExternalLink } from "lucide-react";

/**
 * External link that opens a location or a directions route in Google Maps.
 * Works with or without an API key (it's just a maps.google.com URL).
 */
export function OpenInMapsButton({
  href,
  label = "Open in Google Maps",
  size = "md",
  className = "",
}: {
  href: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-[11.5px]" : "px-3 py-2 text-[12.5px]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={label}
      className={`inline-flex items-center justify-center gap-1.5 ${pad} rounded-[10px] border border-line bg-white text-accent font-bold cursor-pointer transition hover:border-accent hover:bg-tint ${className}`}
    >
      <ExternalLink size={size === "sm" ? 13 : 14} strokeWidth={2} />
      {label}
    </a>
  );
}
