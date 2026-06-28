"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Palette, Route, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/store";
import { useTrip } from "@/lib/store";
import { CURRENCIES } from "@/lib/budget/estimate";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { applyThemeToDocument, normalizeTheme, type ThemeId } from "@/lib/theme/themes";
import { acctInput, Field, PageHeader, Segmented, SelectInput, SettingCard, Toggle } from "./ui";
import { useUnsavedChanges } from "@/lib/ui/useUnsavedChanges";

const opt = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
const PACE = opt(["Relaxed", "Balanced", "Fast-paced"]);
const TRANSPORT = opt(["Driving", "Walking", "Public Transport", "Taxi"]);
const STYLE = opt(["Luxury", "Mid-range", "Budget"]);
const ACCOM = opt(["Hotel", "Apartment", "Resort", "Villa"]);
const FOOD = opt(["Halal", "Vegetarian", "Vegan", "No preference"]);
const DISTANCE = [{ value: "km", label: "Kilometers" }, { value: "mi", label: "Miles" }];
const TEMP = [{ value: "C", label: "Celsius" }, { value: "F", label: "Fahrenheit" }];
const PAPER = opt(["A4", "Letter"]);
const LAYOUT = opt(["Timeline", "Compact", "Detailed"]);
const TEMPLATES = opt(["Luxury", "Explorer", "Minimal", "Family", "Adventure", "Dark"]);
const EXPORT_LANG = opt(["English", "Arabic", "French"]);
const CURRENCY_OPTS = Object.values(CURRENCIES).map((c) => ({ value: c.code, label: c.label }));

export function SettingsPage() {
  const { state, actions } = useAuth();
  const trip = useTrip();
  const flash = trip.actions.flash;
  const p = state.preferences;
  const g = (v: string | null | undefined, d: string) => v ?? d;

  // ---- appearance ----
  const [theme, setTheme] = useState<ThemeId>(normalizeTheme(p?.theme));
  const pickTheme = (id: ThemeId) => { setTheme(id); applyThemeToDocument(id); };
  const savedThemeRef = useRef(p?.theme);
  savedThemeRef.current = p?.theme;
  useEffect(() => () => applyThemeToDocument(savedThemeRef.current), []);
  const themeDirty = theme !== normalizeTheme(p?.theme);

  // ---- travel defaults ----
  const [pace, setPace] = useState(g(p?.pace, "Balanced"));
  const [transport, setTransport] = useState(g(p?.transport, "Driving"));
  const [travelers, setTravelers] = useState(p?.travelers != null ? String(p.travelers) : "2");
  const [currency, setCurrency] = useState(g(p?.currency, "KWD"));
  const [distance, setDistance] = useState(g(p?.distance_unit, "km"));
  const [temp, setTemp] = useState(g(p?.temperature_unit, "C"));
  const travelDirty =
    pace !== g(p?.pace, "Balanced") || transport !== g(p?.transport, "Driving") ||
    travelers !== (p?.travelers != null ? String(p.travelers) : "2") || currency !== g(p?.currency, "KWD") ||
    distance !== g(p?.distance_unit, "km") || temp !== g(p?.temperature_unit, "C");

  // ---- AI preferences ----
  const [family, setFamily] = useState(p?.family_friendly ?? true);
  const [withKids, setWithKids] = useState(p?.with_children ?? false);
  const [kidsAges, setKidsAges] = useState(g(p?.children_ages, ""));
  const [style, setStyle] = useState(g(p?.travel_style, "Mid-range"));
  const [accom, setAccom] = useState(g(p?.accommodation, "Hotel"));
  const [food, setFood] = useState(g(p?.food_pref, "No preference"));
  const [access, setAccess] = useState(g(p?.accessibility, ""));
  const aiDirty =
    family !== (p?.family_friendly ?? true) || withKids !== (p?.with_children ?? false) || kidsAges !== g(p?.children_ages, "") ||
    style !== g(p?.travel_style, "Mid-range") || accom !== g(p?.accommodation, "Hotel") || food !== g(p?.food_pref, "No preference") ||
    access !== g(p?.accessibility, "");

  // ---- export preferences ----
  const [template, setTemplate] = useState(g(p?.export_template, "Luxury"));
  const [paper, setPaper] = useState(g(p?.paper_size, "A4"));
  const [layout, setLayout] = useState(g(p?.itinerary_layout, "Timeline"));
  const [exLang, setExLang] = useState(g(p?.export_language, "English"));
  const exportDirty =
    template !== g(p?.export_template, "Luxury") || paper !== g(p?.paper_size, "A4") ||
    layout !== g(p?.itinerary_layout, "Timeline") || exLang !== g(p?.export_language, "English");

  const anyDirty = themeDirty || travelDirty || aiDirty || exportDirty;
  useUnsavedChanges(anyDirty);

  const save = async (patch: Record<string, unknown>) => {
    const r = await actions.updatePreferences(patch);
    if (!r.ok) { flash(r.error); return false; }
    return true;
  };

  return (
    <div className="vp-scroll min-h-full" style={{ background: "var(--bg)" }}>
      <div className="max-w-[820px] mx-auto px-[clamp(16px,3vw,28px)] py-6 vp-fade">
        <PageHeader title="Settings" subtitle="Configure how Itinera looks and plans your trips." />

        <div className="flex flex-col gap-5">
          {/* appearance */}
          <SettingCard icon={Palette} title="Appearance" description="Choose a colour theme for the whole app." dirty={themeDirty} saveLabel="Save theme" onSave={() => save({ theme })}>
            <ThemePicker value={theme} onChange={pickTheme} />
          </SettingCard>

          {/* travel defaults */}
          <SettingCard icon={Route} title="Travel defaults" description="Sensible defaults applied to every new trip." dirty={travelDirty} onSave={() => save({ pace, transport, travelers: travelers ? Number(travelers) : null, currency, distance_unit: distance, temperature_unit: temp })}>
            <div className="flex flex-col gap-4">
              <Field label="Preferred travel pace"><Segmented value={pace} onChange={setPace} options={PACE} /></Field>
              <Field label="Preferred transport"><Segmented value={transport} onChange={setTransport} options={TRANSPORT} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Default number of travelers"><input type="number" min={1} max={16} value={travelers} onChange={(e) => setTravelers(e.target.value)} className={acctInput} /></Field>
                <Field label="Default currency" hint="All budgets and costs use this currency."><SelectInput value={currency} onChange={setCurrency} options={CURRENCY_OPTS} /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Distance units"><Segmented value={distance} onChange={setDistance} options={DISTANCE} /></Field>
                <Field label="Temperature units"><Segmented value={temp} onChange={setTemp} options={TEMP} /></Field>
              </div>
            </div>
          </SettingCard>

          {/* AI preferences */}
          <SettingCard icon={Sparkles} title="AI preferences" description="Shape the recommendations the AI makes for you." dirty={aiDirty} onSave={() => save({ family_friendly: family, with_children: withKids, children_ages: kidsAges.trim() || null, travel_style: style, accommodation: accom, food_pref: food, accessibility: access.trim() || null })}>
            <div className="flex flex-col gap-4">
              <div className="rounded-[12px] border border-line p-3.5 flex flex-col gap-3">
                <Toggle on={family} onChange={setFamily} label="Family-friendly recommendations" />
                <div className="border-t border-line" />
                <Toggle on={withKids} onChange={setWithKids} label="Traveling with children" />
                {withKids && <div className="vp-slide-down"><Field label="Children's ages"><input value={kidsAges} onChange={(e) => setKidsAges(e.target.value)} placeholder="e.g. 6, 9" className={acctInput} /></Field></div>}
              </div>
              <Field label="Preferred travel style"><Segmented value={style} onChange={setStyle} options={STYLE} /></Field>
              <Field label="Accommodation preference"><Segmented value={accom} onChange={setAccom} options={ACCOM} /></Field>
              <Field label="Food preference"><Segmented value={food} onChange={setFood} options={FOOD} /></Field>
              <Field label="Accessibility needs" hint="Optional — e.g. step-free access, ground-floor rooms."><input value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Any accessibility requirements" className={acctInput} /></Field>
            </div>
          </SettingCard>

          {/* export preferences */}
          <SettingCard icon={FileDown} title="Export preferences" description="Defaults for your exported travel book." dirty={exportDirty} onSave={() => save({ export_template: template, paper_size: paper, itinerary_layout: layout, export_language: exLang })}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Default PDF template"><SelectInput value={template} onChange={setTemplate} options={TEMPLATES} /></Field>
              <Field label="Default language"><SelectInput value={exLang} onChange={setExLang} options={EXPORT_LANG} /></Field>
              <Field label="Paper size"><Segmented value={paper} onChange={setPaper} options={PAPER} /></Field>
              <Field label="Itinerary layout"><Segmented value={layout} onChange={setLayout} options={LAYOUT} /></Field>
            </div>
          </SettingCard>
        </div>
      </div>
    </div>
  );
}
