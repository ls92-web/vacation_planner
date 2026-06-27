"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Coins,
  Compass,
  Globe2,
  Languages,
  Loader2,
  MapPin,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { loadCities, loadCountries, searchCountries } from "@/lib/geo";
import type { GeoCity, GeoCountry, SelectedDestination } from "@/lib/geo";
import { CityImage } from "./CityImage";

function fmtPopulation(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function clientId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

type CountriesState = "loading" | "ready" | "error";
type CitiesState = "idle" | "loading" | "ready" | "empty" | "error";

const Flag = ({ src, label }: { src?: string; label: string }) =>
  src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${label} flag`} className="w-[22px] h-[15px] rounded-[3px] object-cover shrink-0 border border-line" loading="lazy" />
  ) : (
    <Globe2 size={15} className="text-muted shrink-0" />
  );

export function DestinationPicker({
  value,
  onChange,
}: {
  value: SelectedDestination[];
  onChange: (next: SelectedDestination[]) => void;
}) {
  // ----- countries -----
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [countriesState, setCountriesState] = useState<CountriesState>("loading");
  const [countryQuery, setCountryQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<GeoCountry | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ----- cities -----
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [citiesState, setCitiesState] = useState<CitiesState>("idle");
  const [cityQuery, setCityQuery] = useState("");

  const fetchCountries = useCallback(() => {
    setCountriesState("loading");
    loadCountries()
      .then((cs) => {
        setCountries(cs);
        setCountriesState("ready");
      })
      .catch(() => setCountriesState("error"));
  }, []);

  useEffect(fetchCountries, [fetchCountries]);

  // close the dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => searchCountries(countries, countryQuery), [countries, countryQuery]);

  const fetchCities = useCallback((c: GeoCountry, q: string) => {
    setCitiesState("loading");
    loadCities(c.code, q)
      .then((res) => {
        let list = res.cities;
        // Seed the capital when there are no suggestions and the user hasn't searched.
        if (!list.length && !q && c.capital) {
          const ll = c.capitalLatlng ?? c.latlng;
          list = [{ name: c.capital, countryCode: c.code, countryName: c.name, lat: ll?.[0] ?? 0, lng: ll?.[1] ?? 0 }];
        }
        setCities(list);
        setCitiesState(list.length ? "ready" : "empty");
      })
      .catch(() => setCitiesState("error"));
  }, []);

  // (re)load city suggestions when a country is chosen or the city search changes
  useEffect(() => {
    if (!country) return;
    const q = cityQuery.trim();
    const t = setTimeout(() => fetchCities(country, q), q ? 350 : 0);
    return () => clearTimeout(t);
  }, [country, cityQuery, fetchCities]);

  function selectCountry(c: GeoCountry) {
    setCountry(c);
    setCountryQuery(c.name);
    setOpen(false);
    setCityQuery("");
  }

  const isAdded = (city: GeoCity) =>
    value.some((v) => v.cityName === city.name && v.countryCode === city.countryCode);

  function addCity(city: GeoCity) {
    if (isAdded(city)) return;
    onChange([
      ...value,
      {
        id: clientId(),
        cityName: city.name,
        countryName: city.countryName || country?.name || "",
        countryCode: city.countryCode,
        lat: city.lat,
        lng: city.lng,
        image: null,
      },
    ]);
  }

  function removeDest(id: string) {
    onChange(value.filter((v) => v.id !== id));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const flagFor = (code: string) => countries.find((c) => c.code === code)?.flagSvg;

  return (
    <div className="flex flex-col gap-6">
      {/* ============ STEP 1 — country ============ */}
      <div>
        <label className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
          <Globe2 size={14} strokeWidth={2} className="text-accent" /> Country
        </label>
        <p className="text-[12px] text-muted mt-0.5">Search for a country to begin building your route.</p>

        <div ref={boxRef} className="relative mt-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={countryQuery}
              onChange={(e) => {
                setCountryQuery(e.target.value);
                setOpen(true);
                if (country) setCountry(null);
              }}
              onFocus={() => setOpen(true)}
              placeholder={countriesState === "loading" ? "Loading countries…" : "e.g. Spain, Japan, Morocco"}
              disabled={countriesState === "loading"}
              className="w-full pl-10 pr-10 py-[12px] border border-line rounded-xl text-[14.5px] bg-surface outline-none vp-input disabled:opacity-60"
              autoComplete="off"
            />
            {countriesState === "loading" && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted vp-spin" />}
            {country && countriesState === "ready" && (
              <Check size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--accent)" }} />
            )}
          </div>

          {/* countries error */}
          {countriesState === "error" && (
            <div className="mt-2 flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-line bg-surface">
              <span className="text-[13px] text-muted flex items-center gap-2"><AlertCircle size={15} style={{ color: "#9A6512" }} />Couldn&apos;t load countries.</span>
              <button onClick={fetchCountries} className="text-[13px] font-semibold text-accent flex items-center gap-1.5 cursor-pointer hover:underline"><RotateCw size={13} />Retry</button>
            </div>
          )}

          {/* autocomplete dropdown */}
          {open && countriesState === "ready" && countryQuery.trim() && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-surface border border-line rounded-xl overflow-hidden vp-pop" style={{ boxShadow: "0 18px 40px -18px rgba(0,0,0,.28)" }}>
              {results.length === 0 ? (
                <div className="px-4 py-3.5 text-[13px] text-muted">No country matches &ldquo;{countryQuery.trim()}&rdquo;.</div>
              ) : (
                <ul className="max-h-[260px] overflow-y-auto vp-scroll py-1">
                  {results.map((c) => (
                    <li key={c.code}>
                      <button
                        onClick={() => selectCountry(c)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left cursor-pointer hover:bg-tint transition"
                      >
                        <Flag src={c.flagSvg} label={c.name} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-semibold text-ink truncate">{c.name}</span>
                          <span className="block text-[11.5px] text-muted truncate">{[c.region, c.subregion].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="text-[11px] font-mono text-muted">{c.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* selected-country meta */}
        {country && (
          <div className="mt-3 flex flex-wrap items-center gap-2 vp-fade">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-tint text-[12.5px] font-semibold text-ink">
              <Flag src={country.flagSvg} label={country.name} />
              {country.name}
            </span>
            {country.region && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-muted">
                <Globe2 size={13} /> {country.region}
              </span>
            )}
            {country.currency && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-muted">
                <Coins size={13} /> {country.currency}
              </span>
            )}
            {country.languages.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line text-[12px] text-muted">
                <Languages size={13} /> {country.languages.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ============ STEP 2 — cities ============ */}
      {country && (
        <div className="vp-fade">
          <label className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
            <MapPin size={14} strokeWidth={2} className="text-accent" /> Cities in {country.name}
          </label>
          <p className="text-[12px] text-muted mt-0.5">Add one or more cities — search by name or pick from the suggestions.</p>

          <div className="relative mt-2">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={`Search a city in ${country.name}`}
              className="w-full pl-10 pr-4 py-[12px] border border-line rounded-xl text-[14.5px] bg-surface outline-none vp-input"
              autoComplete="off"
            />
          </div>

          {/* city states */}
          <div className="mt-3">
            {citiesState === "loading" && (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[42px] w-[150px] rounded-xl border border-line vp-shimmer" />
                ))}
              </div>
            )}

            {citiesState === "error" && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-line bg-surface">
                <span className="text-[13px] text-muted flex items-center gap-2"><AlertCircle size={15} style={{ color: "#9A6512" }} />Couldn&apos;t load cities.</span>
                <button onClick={() => country && fetchCities(country, cityQuery.trim())} className="text-[13px] font-semibold text-accent flex items-center gap-1.5 cursor-pointer hover:underline"><RotateCw size={13} />Retry</button>
              </div>
            )}

            {citiesState === "empty" && (
              <div className="px-4 py-6 rounded-xl border border-dashed border-line text-center">
                <MapPin size={20} className="mx-auto text-muted" />
                <p className="text-[13px] text-muted mt-1.5">{cityQuery.trim() ? `No cities match “${cityQuery.trim()}”.` : "No suggestions yet — try searching a city name."}</p>
              </div>
            )}

            {citiesState === "ready" && (
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => {
                  const added = isAdded(city);
                  const pop = fmtPopulation(city.population);
                  return (
                    <button
                      key={`${city.name}-${city.lat}-${city.lng}`}
                      onClick={() => addCity(city)}
                      disabled={added}
                      className="group inline-flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-xl border bg-surface text-left transition cursor-pointer disabled:cursor-default"
                      style={{ borderColor: added ? "var(--accent)" : "var(--line)", background: added ? "var(--tint)" : "var(--surface)" }}
                    >
                      <MapPin size={15} strokeWidth={2} style={{ color: added ? "var(--accent)" : "var(--muted)" }} />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate max-w-[180px]">{city.name}</span>
                        {(city.admin || pop) && (
                          <span className="block text-[11px] text-muted truncate max-w-[180px]">{[city.admin, pop ? `${pop} people` : null].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                      <span className="w-6 h-6 rounded-lg grid place-items-center shrink-0" style={{ background: added ? "var(--accent)" : "color-mix(in oklab, var(--accent) 12%, transparent)", color: added ? "#fff" : "var(--accent)" }}>
                        {added ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 3 — selected destinations ============ */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
            <Compass size={14} strokeWidth={2} className="text-accent" /> Your destinations
            {value.length > 0 && <span className="text-muted font-normal">({value.length})</span>}
          </label>
          {value.length > 1 && <span className="text-[11.5px] text-muted">Reorder with the arrows — this is your travel order.</span>}
        </div>

        {value.length === 0 ? (
          <div className="mt-2 px-4 py-7 rounded-xl border border-dashed border-line text-center">
            <Compass size={22} className="mx-auto text-muted" />
            <p className="text-[13.5px] font-semibold text-ink mt-2">No destinations yet</p>
            <p className="text-[12.5px] text-muted mt-0.5">Pick a country, then add the cities you&apos;ll visit.</p>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {value.map((d, i) => (
              <li
                key={d.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line bg-surface vp-pop"
              >
                <span className="w-7 h-7 rounded-lg grid place-items-center text-[12.5px] font-bold shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}>{i + 1}</span>
                <CityImage name={d.cityName} country={d.countryName} image={d.image ?? undefined} scrim={false} className="w-[52px] h-[40px] rounded-lg shrink-0" />
                <Flag src={flagFor(d.countryCode)} label={d.countryName} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-ink truncate">{d.cityName}</span>
                  <span className="block text-[11.5px] text-muted truncate">{d.countryName}</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-ink disabled:opacity-30 disabled:cursor-default"><ArrowUp size={14} strokeWidth={2} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === value.length - 1} title="Move down" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-ink disabled:opacity-30 disabled:cursor-default"><ArrowDown size={14} strokeWidth={2} /></button>
                  <button onClick={() => removeDest(d.id)} title="Remove" className="w-7 h-7 rounded-lg border border-line bg-surface text-muted grid place-items-center cursor-pointer hover:text-[#9A6512] hover:border-[#9A6512]"><X size={14} strokeWidth={2} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
