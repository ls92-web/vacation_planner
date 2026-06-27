"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthScreen } from "./screens/Auth";
import { RouteBuilder } from "./screens/RouteBuilder";
import { ExploreExperience } from "./explore/ExploreExperience";
import { GeneratingScreen } from "./screens/Generating";
import { Itinerary } from "./screens/Itinerary";
import { Toast } from "./Toast";
import { ThemeSwitcher } from "./ThemeSwitcher";

function Screens() {
  const { state } = useTrip();
  return (
    <div
      data-theme={state.theme.toLowerCase()}
      className="vp-scroll min-h-screen overflow-x-hidden font-body text-ink"
      style={{ background: "var(--bg)" }}
    >
      {state.screen === "auth" && <AuthScreen />}
      {state.screen === "form" && <RouteBuilder />}
      {state.screen === "explore" && <ExploreExperience />}
      {state.screen === "generating" && <GeneratingScreen />}
      {state.screen === "plan" && <Itinerary />}
      <Toast />
      <ThemeSwitcher />
    </div>
  );
}

export function App() {
  return (
    <TripProvider>
      <Screens />
    </TripProvider>
  );
}
