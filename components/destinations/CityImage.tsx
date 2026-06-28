"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadCityImage } from "@/lib/geo";

/**
 * Background city photo for a destination card. Falls back to the brand deep-ink
 * tile while loading or when no photo is found. Pass `image` to skip the lookup
 * (e.g. a value already persisted with the destination).
 */
export function CityImage({
  name,
  country = "",
  image,
  className = "",
  scrim = true,
  children,
}: {
  name: string;
  country?: string;
  image?: string | null;
  className?: string;
  scrim?: boolean;
  children?: ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(image ?? null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (image) {
      setSrc(image);
      return;
    }
    if (!name) return;
    let cancelled = false;
    loadCityImage(name, country).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [name, country, image]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: "var(--brand-deep)" }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${name}${country ? `, ${country}` : ""}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setSrc(null)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
      {/* Scrim only over a real photo (for legible text). No photo → clean, flat
          deep-ink background, exactly like before. */}
      {scrim && src && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,43,54,.12) 0%, rgba(0,43,54,.18) 45%, rgba(0,43,54,.72) 100%)" }} />
      )}
      {children}
    </div>
  );
}
