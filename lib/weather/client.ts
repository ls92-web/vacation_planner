"use client";

import { useEffect, useState } from "react";
import { cachedGeo } from "@/lib/geo/cache";
import { callFn } from "@/lib/edge";

export interface WeatherDay {
  date: string;
  tMax: number;
  tMin: number;
  code: number;
  precip: number;
}
export interface WeatherData {
  mode: "forecast" | "seasonal";
  current: { temp: number; code: number } | null;
  summary: { tMax: number; tMin: number; code: number; precip: number };
  days: WeatherDay[];
  note: string | null;
}

const WEATHER_TTL = 3 * 60 * 60 * 1000; // 3h — keeps API calls low

export function loadWeather(lat: number, lng: number, start = "", end = ""): Promise<WeatherData> {
  const key = `weather:${lat.toFixed(2)},${lng.toFixed(2)}:${start}`;
  return cachedGeo(key, WEATHER_TTL, async () => {
    const data = await callFn<WeatherData>("geo-weather", { lat: String(lat), lng: String(lng), start, end });
    if (!data) throw new Error("weather request failed");
    return data;
  });
}

export type WeatherState = "idle" | "loading" | "ready" | "error";

export function useWeather(lat?: number, lng?: number, start = "", end = "") {
  const [state, setState] = useState<WeatherState>("idle");
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number" || (lat === 0 && lng === 0)) {
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    loadWeather(lat, lng, start, end)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, start, end]);

  return { state, data };
}
