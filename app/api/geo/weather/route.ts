import { NextResponse, type NextRequest } from "next/server";

// Weather via Open-Meteo (keyless). Within ~16 days of today we return the real
// daily forecast; further out we return seasonal averages (same month, prior
// year) so the card can say "forecast available closer to your travel date".

interface Day {
  date: string;
  tMax: number;
  tMin: number;
  code: number;
  precip: number; // chance of rain, %
}
interface WeatherPayload {
  mode: "forecast" | "seasonal";
  current: { temp: number; code: number } | null;
  summary: { tMax: number; tMin: number; code: number; precip: number };
  days: Day[];
  note: string | null;
}

const DAY_MS = 86_400_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const mode = (xs: number[]) => {
  const m = new Map<number, number>();
  let best = xs[0] ?? 0;
  let bestN = 0;
  for (const x of xs) {
    const n = (m.get(x) ?? 0) + 1;
    m.set(x, n);
    if (n > bestN) {
      bestN = n;
      best = x;
    }
  }
  return best;
};

async function forecast(lat: string, lng: string, start: string, end: string): Promise<WeatherPayload> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=16` +
    `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`forecast ${res.status}`);
  const d = (await res.json()) as {
    current?: { temperature_2m: number; weather_code: number };
    daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
  };
  const daily = d.daily;
  if (!daily) throw new Error("no daily");
  let all: Day[] = daily.time.map((date, i) => ({
    date,
    tMax: Math.round(daily.temperature_2m_max[i]),
    tMin: Math.round(daily.temperature_2m_min[i]),
    code: daily.weather_code[i],
    precip: Math.round(daily.precipitation_probability_max[i] ?? 0),
  }));
  // Limit to the trip window when it overlaps the forecast; otherwise next 7 days.
  if (start) {
    const inRange = all.filter((day) => day.date >= start && (!end || day.date <= end));
    all = inRange.length ? inRange.slice(0, 10) : all.slice(0, 7);
  } else {
    all = all.slice(0, 7);
  }
  const head = all[0];
  return {
    mode: "forecast",
    current: d.current ? { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code } : null,
    summary: head ? { tMax: head.tMax, tMin: head.tMin, code: head.code, precip: head.precip } : { tMax: 0, tMin: 0, code: 0, precip: 0 },
    days: all,
    note: null,
  };
}

async function seasonal(lat: string, lng: string, start: string): Promise<WeatherPayload> {
  const month = start.slice(5, 7) || "01";
  const year = new Date().getUTCFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&timezone=auto` +
    `&start_date=${year}-${month}-01&end_date=${year}-${month}-28` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!res.ok) throw new Error(`archive ${res.status}`);
  const d = (await res.json()) as {
    daily?: { weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
  };
  const daily = d.daily;
  if (!daily || !daily.temperature_2m_max?.length) throw new Error("no archive");
  const wetDays = daily.precipitation_sum.filter((p) => (p ?? 0) >= 1).length;
  const precipChance = Math.round((100 * wetDays) / daily.precipitation_sum.length);
  return {
    mode: "seasonal",
    current: null,
    summary: {
      tMax: Math.round(avg(daily.temperature_2m_max)),
      tMin: Math.round(avg(daily.temperature_2m_min)),
      code: mode(daily.weather_code),
      precip: precipChance,
    },
    days: [],
    note: "Forecast available closer to your travel date — showing typical conditions for this time of year.",
  };
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat") ?? "";
  const lng = req.nextUrl.searchParams.get("lng") ?? "";
  const start = (req.nextUrl.searchParams.get("start") ?? "").trim();
  const end = (req.nextUrl.searchParams.get("end") ?? "").trim();
  if (!lat || !lng) return NextResponse.json({ error: "missing coordinates" }, { status: 400 });

  const daysUntil = start ? Math.floor((new Date(`${start}T00:00:00Z`).getTime() - Date.now()) / DAY_MS) : 0;
  const useForecast = !start || (daysUntil >= -1 && daysUntil <= 15);

  try {
    const payload = useForecast ? await forecast(lat, lng, start, end) : await seasonal(lat, lng, start);
    return NextResponse.json(payload);
  } catch {
    // If a far-future seasonal lookup or forecast fails, try the other path before giving up.
    try {
      const fallback = useForecast ? await seasonal(lat, lng, start || `${new Date().getUTCFullYear()}-01-01`) : await forecast(lat, lng, "", "");
      return NextResponse.json(fallback);
    } catch {
      return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
    }
  }
}
